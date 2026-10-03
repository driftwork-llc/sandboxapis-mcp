// THE AGENT PATH — what a tool result says about the wall, and what `orient`
// says before an agent ever reaches one.
//
// Everything here runs against a STUB TRANSPORT rather than the in-process
// renderers, for one reason: the facts under test are carried by HEADERS the
// gateway stamps, and the renderers do not stamp them (the gateway does, on its
// way out). A test that could only produce a 200 from a renderer could not
// exercise a single line of `hintsOf`. So each case states the exact response
// the gateway would have produced, and asserts what the tool makes of it.

import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createSandboxMcpServer } from "./server.js";
import { buildOrientation } from "./discovery.js";
import { McpUniverse } from "./universe.js";
import { readHints, type McpTransport, type RestResult } from "./transport.js";
import { ANON_HOURLY_LIMIT, FREE_HOURLY_LIMIT, PRICING_URL, UPGRADE_URL_ANONYMOUS } from "./config.js";
import { readBudget, resetsInSeconds, toAccess } from "./budget.js";

const NOW_SEC = 1_900_000_000;

/** GitHub's `/rate_limit` body, in the shape the renderer serves it: one
 *  enforced bucket reported under every resource name. */
const rateLimitBody = (limit: number, remaining: number, reset: number): unknown => ({
  resources: { core: { limit, remaining, used: limit - remaining, reset } },
  rate: { limit, remaining, used: limit - remaining, reset },
});

/** A transport that answers each path from a fixture table, so a test can state
 *  a whole gateway response — status, body AND headers — in one place. */
function stubTransport(
  routes: Record<string, { status: number; body: unknown; headers?: Record<string, string> }>,
  opts: { keyed?: boolean } = {},
): McpTransport {
  const answer = (path: string): RestResult => {
    const hit = routes[path] ?? { status: 404, body: { message: "Not Found" } };
    return {
      status: hit.status,
      body: hit.body,
      ok: hit.status >= 200 && hit.status < 300,
      hints: readHints(new Headers(hit.headers ?? {})),
    };
  };
  return {
    ...(opts.keyed === undefined ? {} : { keyed: opts.keyed }),
    restGet: (_provider, path) => Promise.resolve(answer(path)),
    gqlPost: (_provider) => Promise.resolve(answer("/graphql")),
  };
}

/** The over-limit response the gateway produces for an anonymous caller on the
 *  GitHub host — status, body and both error-only headers, as captured in
 *  `packages/gateway/src/tiered-refusal.test.ts`. */
const REFUSED = {
  status: 403,
  body: {
    message:
      "API rate limit exceeded. This MCP server is running without a key (60 requests/hour). " +
      "Set SANDBOXAPIS_API_KEY to a free key for 600/hour — https://sandboxapis.dev/upgrade?from=anonymous",
    documentation_url: "https://sandboxapis.dev/upgrade?from=anonymous",
    status: "403",
  },
  headers: {
    "x-sandboxapis-tier": "anonymous",
    "x-sandboxapis-upgrade": "https://sandboxapis.dev/upgrade?from=anonymous",
    "retry-after": "600",
  },
};

/** Talk to the server the way an agent does — over the protocol, not by calling
 *  the handler — so the tool registration is under test too. */
async function connect(transport: McpTransport): Promise<Client> {
  const { server } = createSandboxMcpServer({ transport });
  const client = new Client({ name: "budget-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  return client;
}

/** The JSON payload out of a tool result. */
function payload(result: unknown): Record<string, unknown> {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  const first = content[0];
  if (!first || first.type !== "text" || !first.text) throw new Error("expected text content");
  return JSON.parse(first.text) as Record<string, unknown>;
}

describe("A — a refused tool result carries the upgrade as data", () => {
  it("a 403 with both headers yields upgrade with the rung, the URL and retry-after", async () => {
    const client = await connect(stubTransport({ "/users/athena": REFUSED }));
    const result = await client.callTool({ name: "get_user", arguments: { provider: "github", login: "athena" } });
    expect(result.isError).toBe(true);
    const p = payload(result);
    // The four fields that were always there are untouched — `upgrade` is
    // additive, never a replacement for the provider's own body.
    expect(p["provider"]).toBe("github");
    expect(p["path"]).toBe("/users/athena");
    expect(p["status"]).toBe(403);
    expect(p["body"]).toEqual(REFUSED.body);
    expect(p["upgrade"]).toEqual({
      tier: "anonymous",
      url: "https://sandboxapis.dev/upgrade?from=anonymous",
      retryAfterSeconds: 600,
    });
  });

  it("a 403 with only the tier header yields upgrade with no url — Scale's hourly burst", async () => {
    // The gateway omits `x-sandboxapis-upgrade` entirely when there is nothing
    // to offer, and the tool must reproduce that ABSENCE rather than an empty
    // string: a client that checks presence would read `""` as "unavailable".
    const client = await connect(
      stubTransport({
        "/users/athena": {
          status: 403,
          body: { message: "API rate limit exceeded. This is your HOURLY burst, not your daily allowance." },
          headers: { "x-sandboxapis-tier": "scale" },
        },
      }),
    );
    const p = payload(await client.callTool({ name: "get_user", arguments: { provider: "github", login: "athena" } }));
    expect(p["upgrade"]).toEqual({ tier: "scale" });
    expect(Object.keys(p["upgrade"] as object)).toEqual(["tier"]);
  });

  it("a 200 carries no upgrade at all", async () => {
    const client = await connect(stubTransport({ "/users/athena": { status: 200, body: { login: "athena" } } }));
    const p = payload(await client.callTool({ name: "get_user", arguments: { provider: "github", login: "athena" } }));
    expect(Object.keys(p).sort()).toEqual(["body", "path", "provider", "status"]);
    expect(p["upgrade"]).toBeUndefined();
  });

  it("a coverage 404 carries no upgrade — it sells nothing — but does hand over the manifest", async () => {
    // DECISIONS 2026-08-11: the coverage 404's BODY is an exact provider
    // mirror and the pointer is the header. Nothing about that changes; the
    // tool simply reads the header the caller would otherwise have to.
    const client = await connect(
      stubTransport({
        "/users/athena": {
          status: 404,
          body: { message: "Not Found", documentation_url: "https://docs.github.com/rest" },
          headers: { "x-sandboxapis-coverage": "https://sandboxapis.dev/coverage" },
        },
      }),
    );
    const p = payload(await client.callTool({ name: "get_user", arguments: { provider: "github", login: "athena" } }));
    expect(p["upgrade"]).toBeUndefined();
    expect(p["coverage"]).toBe("https://sandboxapis.dev/coverage");
    expect(p["body"]).toEqual({ message: "Not Found", documentation_url: "https://docs.github.com/rest" });
  });

  it("a read-only 403 carries no upgrade — no tier ever grants a write", async () => {
    const client = await connect(
      stubTransport({
        "/users/athena": { status: 403, body: { message: "This universe is read-only." } },
      }),
    );
    const p = payload(await client.callTool({ name: "get_user", arguments: { provider: "github", login: "athena" } }));
    expect(p["upgrade"]).toBeUndefined();
    expect(p["coverage"]).toBeUndefined();
  });

  it("the GraphQL tool and search_commits_by_author carry it too", async () => {
    // The three error paths in tools.ts, all of which an agent can reach.
    const gql = await connect(stubTransport({ "/graphql": REFUSED }));
    const gqlPayload = payload(await gql.callTool({ name: "list_issues", arguments: { provider: "linear" } }));
    expect(gqlPayload["transport"]).toBe("graphql");
    expect((gqlPayload["upgrade"] as { tier: string }).tier).toBe("anonymous");

    const commits = await connect(stubTransport({}));
    const commitsPayload = payload(await commits.callTool({ name: "search_commits_by_author", arguments: { author: "athena" } }));
    // The stub answers every unknown path with a bare 404 and no headers, so
    // there is nothing to offer — and the tool must not invent one.
    expect(commitsPayload["error"]).toContain("Could not read commits");
    expect(commitsPayload["upgrade"]).toBeUndefined();

    const refusedCommits = await connect(
      stubTransport({ "/repos/olympus-labs/parthenon/commits?per_page=100&page=1": REFUSED }),
    );
    const refusedPayload = payload(await refusedCommits.callTool({ name: "search_commits_by_author", arguments: { author: "athena" } }));
    expect(refusedPayload["upgrade"]).toEqual({
      tier: "anonymous",
      url: "https://sandboxapis.dev/upgrade?from=anonymous",
      retryAfterSeconds: 600,
    });
  });
});

describe("B — orient states the budget up front", () => {
  const orgRoutes = {
    "/orgs/olympus-labs": { status: 200, body: { login: "olympus-labs", name: "Olympus Labs" } },
    "/orgs/olympus-labs/teams?per_page=100": { status: 200, body: [] },
    "/orgs/olympus-labs/repos?sort=pushed&per_page=100": { status: 200, body: [] },
  };

  it("an UNKEYED server reports the anonymous rung, the live numbers, and the counting route", async () => {
    const u = new McpUniverse({
      transport: stubTransport(
        { ...orgRoutes, "/rate_limit": { status: 200, body: rateLimitBody(60, 12, NOW_SEC + 900) } },
        { keyed: false },
      ),
    });
    const o = await buildOrientation(u);
    expect(o.access).toEqual({
      keyed: false,
      limit: 60,
      remaining: 12,
      reset: NOW_SEC + 900,
      upgradeUrl: UPGRADE_URL_ANONYMOUS,
      note:
        `Anonymous: ${ANON_HOURLY_LIMIT} requests/hour shared across every provider host; ` +
        `set SANDBOXAPIS_API_KEY to a free key for ${FREE_HOURLY_LIMIT}/hour.`,
    });
  });

  it("a KEYED server reports its real limit and points at the plans page, not a guessed rung", async () => {
    // The rung a key is on is knowable only from a REFUSAL
    // (`x-sandboxapis-tier`). Inferring "free" from 600/hour would be a guess
    // presented as a fact, so the note says what IS known and the URL is the
    // page that states every rung honestly.
    const u = new McpUniverse({
      transport: stubTransport(
        { ...orgRoutes, "/rate_limit": { status: 200, body: rateLimitBody(6000, 5999, NOW_SEC + 60) } },
        { keyed: true },
      ),
    });
    const o = await buildOrientation(u);
    expect(o.access.keyed).toBe(true);
    expect(o.access.limit).toBe(6000);
    expect(o.access.upgradeUrl).toBe(PRICING_URL);
    // Grouped, like every figure the refusal prose quotes.
    expect(o.access.note).toBe("Keyed: 6,000/hour; when a refusal arrives, tool results carry `upgrade` with the next rung.");
    expect(o.access.note).not.toContain("free tier");
  });

  it("omits the numbers rather than inventing them when the budget read fails, and says so", async () => {
    const u = new McpUniverse({
      transport: stubTransport({ ...orgRoutes, "/rate_limit": { status: 503, body: { message: "unavailable" } } }, { keyed: false }),
    });
    const o = await buildOrientation(u);
    expect(o.access.limit).toBeUndefined();
    expect(o.access.remaining).toBeUndefined();
    expect(o.access.reset).toBeUndefined();
    expect(o.access.upgradeUrl).toBe(UPGRADE_URL_ANONYMOUS);
    expect(o.access.note).toContain("could not be read");
    expect(o.access.note).toContain("503");
    // Everything else about orientation still resolves — a budget read that
    // failed must not cost an agent its base URLs.
    expect(o.providers.length).toBeGreaterThan(0);
  });

  it("a body without a numeric resources.core is treated as unreadable, not as zero", async () => {
    const u = new McpUniverse({
      transport: stubTransport({ "/rate_limit": { status: 200, body: { resources: {} } } }, { keyed: true }),
    });
    const budget = await readBudget(u);
    expect(budget.numbers).toBeUndefined();
    expect(toAccess(budget).limit).toBeUndefined();
    expect(toAccess(budget).note).toContain("could not be read");
  });

  it("a transport that states no key is unkeyed — the safe direction to be wrong in", async () => {
    const u = new McpUniverse({ transport: stubTransport({}) });
    expect(u.keyed).toBe(false);
  });
});

describe("C — check_budget", () => {
  it("is registered, takes no required argument, and says in its first sentence that it is free", async () => {
    const client = await connect(stubTransport({}));
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "check_budget");
    expect(tool, "check_budget must appear in tools/list").toBeDefined();
    expect(tool!.description!.split(".")[0]!.toLowerCase()).toContain("costs nothing");
    expect(tool!.description!.toLowerCase()).toContain("before any loop");
    // `provider` is optional: an agent must be able to call this with `{}`.
    expect(tool!.inputSchema.required ?? []).toEqual([]);
  });

  it("returns the window, the countdown and the upgrade route", async () => {
    const client = await connect(
      stubTransport({ "/rate_limit": { status: 200, body: rateLimitBody(60, 3, NOW_SEC + 300) } }, { keyed: false }),
    );
    const p = payload(await client.callTool({ name: "check_budget", arguments: {} }));
    expect(p["keyed"]).toBe(false);
    expect(p["limit"]).toBe(60);
    expect(p["remaining"]).toBe(3);
    expect(p["reset"]).toBe(NOW_SEC + 300);
    expect(typeof p["resetsInSeconds"]).toBe("number");
    expect(p["upgradeUrl"]).toBe(UPGRADE_URL_ANONYMOUS);
    // The read is GitHub's, whichever host the agent named — stated, not implied.
    expect(p["readFrom"]).toBe("github");
    expect(p["readPath"]).toBe("/rate_limit");
    expect(p["provider"]).toBe("github");
  });

  it("names the host the agent asked about while still reading the one shared window", async () => {
    const client = await connect(
      stubTransport({ "/rate_limit": { status: 200, body: rateLimitBody(600, 600, NOW_SEC) } }, { keyed: true }),
    );
    const p = payload(await client.callTool({ name: "check_budget", arguments: { provider: "gitlab" } }));
    expect(p["provider"]).toBe("gitlab");
    expect(p["readFrom"]).toBe("github");
    expect(p["upgradeUrl"]).toBe(PRICING_URL);
  });

  it("computes resetsInSeconds from the clock, and never counts backwards", () => {
    // A fixed clock, so the arithmetic is asserted rather than the wall time.
    expect(resetsInSeconds(NOW_SEC + 300, NOW_SEC * 1000)).toBe(300);
    expect(resetsInSeconds(NOW_SEC + 1, NOW_SEC * 1000 + 999)).toBe(1);
    // A window that has already rolled is 0 remaining seconds, not a negative
    // countdown an agent would sleep on.
    expect(resetsInSeconds(NOW_SEC - 42, NOW_SEC * 1000)).toBe(0);
  });

  it("refuses to guess when the budget cannot be read", async () => {
    const client = await connect(stubTransport({ "/rate_limit": { status: 500, body: {} } }, { keyed: false }));
    const result = await client.callTool({ name: "check_budget", arguments: {} });
    expect(result.isError).toBe(true);
    const p = payload(result);
    expect(p["limit"]).toBeUndefined();
    expect(p["remaining"]).toBeUndefined();
    expect(p["error"]).toContain("Could not read the budget");
    // Still useful: the two facts that do not depend on the read.
    expect(p["keyed"]).toBe(false);
    expect(p["upgradeUrl"]).toBe(UPGRADE_URL_ANONYMOUS);
  });
});
