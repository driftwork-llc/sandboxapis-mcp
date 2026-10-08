// How the MCP server reaches the universe.
//
// It reaches it over the SAME PUBLIC API we tell devs and agents to use — no
// private endpoint, no local artifact, no privileged access. If the MCP server
// can orient itself and answer every tool with nothing but the documented base
// URLs, that is a live proof the product claim holds; a back door would quietly
// disprove it.
//
// The interface is injectable so tests and build-time content generation can
// dispatch to in-process renderer apps instead of the network, without the
// published bundle ever importing a renderer.

import type { McpConfig } from "./config.js";
import type { Provider } from "./provider-ids.js";
import { SERVER_VERSION } from "./server.js";

/**
 * The response headers a TOOL RESULT can be built from — a small, typed subset,
 * never the whole `Headers` object.
 *
 * WHY A SUBSET. Every field here is one this package knows what to do with, and
 * the type is the documentation of that contract: `x-sandboxapis-tier` and
 * `x-sandboxapis-upgrade` become `upgrade` on an error result (tools.ts), and
 * `x-sandboxapis-coverage` becomes `coverage`. Handing the raw Headers along
 * instead would put every provider's rate-limit family, every ETag and every
 * cookie into a payload an agent has to read, and would make "what does a tool
 * result contain" unanswerable from the type.
 *
 * ALL OPTIONAL, and normally all absent: the gateway stamps its two upgrade
 * headers on over-limit refusals only (DECISIONS 2026-09-09 `[upsell]`), and
 * the coverage header on coverage boundaries only.
 */
export interface ResponseHints {
  /** `x-sandboxapis-tier` — the rung that refused. Over-limit responses only. */
  tier?: string;
  /** `x-sandboxapis-upgrade` — the counting route to the next rung, when there is one. */
  upgrade?: string;
  /** `x-sandboxapis-reason` — the prose channel for dialects whose error body has no message field (Slack, Teams). */
  reason?: string;
  /** `x-sandboxapis-coverage` — the coverage manifest, on an uncovered surface. */
  coverage?: string;
  /** `retry-after`, verbatim (seconds, per every dialect the gateway sends). */
  retryAfter?: string;
}

export interface RestResult {
  status: number;
  /** Parsed body (provider-shaped JSON), or the raw text if not JSON. */
  body: unknown;
  ok: boolean;
  /** The headers above, when the transport has any. Absent on a transport that
   *  cannot produce them (a hand-built stub) — tools.ts treats absent exactly
   *  as it treats empty. */
  hints?: ResponseHints;
}

export interface McpTransport {
  restGet(provider: Provider, path: string): Promise<RestResult>;
  gqlPost(provider: Provider, query: string, variables?: Record<string, unknown>): Promise<RestResult>;
  /**
   * Was this server started with a key? The transport is the only thing that
   * holds one, so it is the only honest place to ask — deriving it anywhere
   * else would be a second copy of a fact that can go stale.
   *
   * `orient`'s `access` block and `check_budget` report it, because "you are
   * anonymous at 60/hour" is the single most useful thing an agent can learn
   * BEFORE a loop rather than at request 61. Absent means unkeyed.
   */
  readonly keyed?: boolean;
}

/**
 * Each provider's own credential convention — the exact header a real client
 * for that provider would send. Dogfooding again: the key travels the way the
 * docs tell a human to send it, so anything that works here works there.
 */
function authHeaders(provider: Provider, apiKey: string): Record<string, string> {
  switch (provider) {
    case "gitlab":
      return { "private-token": apiKey };
    case "linear":
      // Linear's convention: the raw key as the Authorization value, no scheme.
      return { authorization: apiKey };
    case "jira":
    case "bitbucket":
      // Basic, key as the password half (email is ignored by the gateway).
      return { authorization: `Basic ${Buffer.from(`sandboxapis:${apiKey}`).toString("base64")}` };
    default:
      return { authorization: `token ${apiKey}` };
  }
}

/**
 * Lift the handful of headers a tool result is allowed to carry.
 *
 * Shared with the in-process transport (`testing/in-process.ts`) on purpose: a
 * test whose transport dropped these would prove nothing about the bundle that
 * ships, since the whole point of `upgrade` is that it survives the real
 * response.
 *
 * Only keys that are actually PRESENT are set — `exactOptionalPropertyTypes` is
 * on, and "absent" and "undefined" must stay distinguishable so tools.ts can
 * decide on presence alone.
 */
export function readHints(headers: Headers): ResponseHints {
  const hints: ResponseHints = {};
  const take = (header: string, field: keyof ResponseHints): void => {
    const value = headers.get(header);
    if (value !== null && value !== "") hints[field] = value;
  };
  take("x-sandboxapis-tier", "tier");
  take("x-sandboxapis-upgrade", "upgrade");
  take("x-sandboxapis-reason", "reason");
  take("x-sandboxapis-coverage", "coverage");
  take("retry-after", "retryAfter");
  return hints;
}

async function toResult(res: Response): Promise<RestResult> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON (an HTML error page from a proxy, say) — keep the raw text */
  }
  return { status: res.status, body, ok: res.status >= 200 && res.status < 300, hints: readHints(res.headers) };
}

/** A network failure, shaped like a result so tool bodies never see a throw. */
function unreachable(baseUrl: string, err: unknown): RestResult {
  const detail = err instanceof Error ? err.message : String(err);
  return {
    status: 0,
    ok: false,
    body: {
      error: `Could not reach ${baseUrl}: ${detail}`,
      hint: "SandboxAPIs is a hosted service — this MCP server needs network access to it. Check connectivity, or set SANDBOXAPIS_BASE_URL_* to point at a local instance.",
    },
  };
}

export interface HttpTransportOptions {
  /** Sent using each provider's own credential convention. Lifts the anonymous
   *  limit (60/hr) to the key's tier — agents exhaust 60/hr quickly. */
  apiKey?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** The real transport: plain HTTPS against the documented base URLs. */
export function httpTransport(cfg: McpConfig, opts: HttpTransportOptions = {}): McpTransport {
  const doFetch = opts.fetchImpl ?? fetch;
  const headersFor = (provider: Provider): Record<string, string> => ({
    accept: "application/json",
    // `sandboxapis-mcp/<version>` — the same version the `initialize` handshake
    // announces. The gateway files this prefix as its own client class, "mcp"
    // (packages/gateway/src/client-class.ts), so `pnpm traffic` can count
    // agents; the bare token used to fall through to "unknown".
    "user-agent": `sandboxapis-mcp/${SERVER_VERSION}`,
    ...(opts.apiKey ? authHeaders(provider, opts.apiKey) : {}),
  });

  return {
    keyed: Boolean(opts.apiKey),
    async restGet(provider, path) {
      const baseUrl = cfg.providers[provider].baseUrl;
      try {
        return await toResult(await doFetch(`${baseUrl}${path}`, { headers: headersFor(provider) }));
      } catch (err) {
        return unreachable(baseUrl, err);
      }
    },
    async gqlPost(provider, query, variables) {
      const baseUrl = cfg.providers[provider].baseUrl;
      try {
        const res = await doFetch(`${baseUrl}/graphql`, {
          method: "POST",
          headers: { ...headersFor(provider), "content-type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });
        return await toResult(res);
      } catch (err) {
        return unreachable(baseUrl, err);
      }
    },
  };
}
