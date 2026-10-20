// MCP tool registrations. Discovery (orient) + query tools that answer through
// the renderers (REST-identical, provider-form ids) + a snapshot-pinning tool.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { PROVIDER_IDS } from "./provider-ids.js";
import { LINK_ACCOUNT_DESCRIPTION, OAUTH_SCOPE, snapshotBaseUrl, type McpConfig } from "./config.js";
import { buildOrientation } from "./discovery.js";
import { mcpProviderById } from "./providers.js";
import { BUDGET_PATH, BUDGET_PROVIDER, hostedAnonymousRefusalMessage, keyRemedy, readBudget, resetsInSeconds, upgradeUrlFor } from "./budget.js";
import type { McpUniverse, Provider, RestResult } from "./universe.js";

const providerArg = z.enum(PROVIDER_IDS as unknown as [Provider, ...Provider[]]);

/** The git hosts, named in the `provider` descriptions of the git-shaped tools.
 *  Every other id answers those tools with an explanation (`requireGit`). */
const GIT_HOSTS = "'github', 'gitlab', 'bitbucket' or 'ado'";

/**
 * The MCP tool annotations every tool carries. Truthful for all ten: no tool
 * writes (the server is read-only even for a scratch-enabled key, see
 * `orient`'s description), nothing a tool reads can change under it (the data
 * set is an immutable artifact, invariant #3), so a repeat call has no further
 * effect. `openWorld` is true for the tools that call the hosted service over
 * the network and false for `get_snapshot`, which answers from the pin list
 * compiled into this package. `title` repeats the tool's top-level title for
 * clients on the 2025-03-26 protocol, where the annotation was the only place
 * a title could go. decisions/2026-10-17-1504-mcp-tool-annotations.md.
 */
export function readOnlyAnnotations(title: string, openWorld: boolean): ToolAnnotations {
  return { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: openWorld };
}

/** Wrap any JSON-able payload as a tool result. */
function json(payload: unknown, isError = false): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError };
}

// ---- OAuth, in the dialect OpenAI's Apps SDK reads --------------------------
//
// Two OpenAI extensions, neither in the MCP spec (design §2 and §10,
// decisions/2026-10-14-1849-oauth-on-the-hosted-mcp-endpoint-design.md). Both
// are emitted ONLY when the config names a protected-resource metadata URL,
// which only the hosted endpoint's does (`McpConfig.oauthResourceMetadataUrl`):
// the stdio package has no endpoint to authorise against, so it advertises no
// oauth2 scheme and no linking challenge, and its tool list is unchanged.

/** The `_meta` key a tool result carries an RFC 7235 challenge under, to open
 *  ChatGPT's account-linking UI (developers.openai.com/apps-sdk/build/auth). */
export const WWW_AUTHENTICATE_META_KEY = "mcp/www_authenticate";

/**
 * Per-tool `securitySchemes`: anonymous works, linking an account raises the
 * budget, so every tool declares both.
 *
 * UNDER `_meta`, NOT AT THE TOP LEVEL. OpenAI documents a top-level
 * `securitySchemes` field on the tool descriptor, with `_meta.securitySchemes`
 * as the "back-compat mirror for clients that only read _meta". The MCP SDK's
 * `tools/list` handler builds each descriptor from a fixed field list (name,
 * title, description, inputSchema, annotations, execution, _meta) and drops
 * anything else, and replacing that handler would mean reaching into the
 * SDK's private request-handler map. So the mirror is the one emitted.
 */
export function securitySchemesFor(cfg: McpConfig): { _meta: { securitySchemes: Array<Record<string, unknown>> } } | Record<string, never> {
  if (cfg.oauthResourceMetadataUrl === undefined) return {};
  return { _meta: { securitySchemes: [{ type: "noauth" }, { type: "oauth2", scopes: [OAUTH_SCOPE] }] } };
}

/**
 * The linking challenge an ANONYMOUS over-limit refusal carries on the hosted
 * endpoint, beside `upgrade`. OpenAI's documented shape: an array of
 * `WWW-Authenticate` values, each with `resource_metadata`, `error` and
 * `error_description`. Undefined for a keyed refusal (linking would change
 * nothing: the caller already draws on a key), for any result that is not an
 * over-limit refusal, and on the stdio package.
 */
export function authChallengeMeta(cfg: McpConfig, keyed: boolean, upgrade: UpgradeHint | undefined): Record<string, unknown> | undefined {
  if (cfg.oauthResourceMetadataUrl === undefined || keyed || upgrade?.tier !== "anonymous") return undefined;
  return {
    [WWW_AUTHENTICATE_META_KEY]: [
      `Bearer resource_metadata="${cfg.oauthResourceMetadataUrl}", error="insufficient_scope", error_description="${LINK_ACCOUNT_DESCRIPTION}"`,
    ],
  };
}

/** A tool result built from a provider response: the payload, plus the linking
 *  challenge when `authChallengeMeta` says the refusal earns one, plus, for an
 *  ANONYMOUS over-limit refusal on the HOSTED endpoint only, a leading
 *  `message` in plain words (budget.ts `hostedAnonymousRefusalMessage`). The
 *  stdio package (not `remote`) and every keyed refusal are unchanged. */
function refusable(u: McpUniverse, payload: Record<string, unknown> & { upgrade?: UpgradeHint }, isError: boolean): CallToolResult {
  const hostedAnonymous = u.remote && !u.keyed && payload.upgrade?.tier === "anonymous";
  const result = json(hostedAnonymous ? { message: hostedAnonymousRefusalMessage(payload.upgrade?.retryAfterSeconds), ...payload } : payload, isError);
  const meta = authChallengeMeta(u.config, u.keyed, payload.upgrade);
  return meta ? { ...result, _meta: meta } : result;
}

/** Tracker providers (Jira/Linear) have no git surfaces — git-shaped tools
 *  explain instead of 404ing. Returns an error result, or undefined to proceed. */
function requireGit(provider: Provider): CallToolResult | undefined {
  const def = mcpProviderById[provider];
  if (def.projectPath) return undefined;
  return json({ error: `${provider} has no git surfaces here: ${def.notGitReason ?? "not a git host."}` }, true);
}

/** The provider path addressing a repo (per-provider grammar in the registry). */
function projectPath(u: McpUniverse, provider: Provider, repo: string): string {
  return mcpProviderById[provider].projectPath!(u.config.orgLogin, repo);
}

/**
 * What a refusal offers, as DATA rather than as a sentence to parse.
 *
 * The gateway stamps `x-sandboxapis-tier` on every over-limit refusal and
 * `x-sandboxapis-upgrade` whenever there is a rung to offer (DECISIONS
 * 2026-09-09 `[upsell]`). Both are error-only, so this object is too: an agent
 * that reads `upgrade` knows it hit a BUDGET wall, not a coverage boundary or a
 * write attempt, without matching prose in twenty-one dialects — six of which
 * (Slack's `{"ok":false,"error":"ratelimited"}`, Teams') have no prose slot at
 * all.
 */
export interface UpgradeHint {
  /** The rung that refused: `anonymous`, `free`, `founding`, `solo`, `scale`. */
  tier: string;
  /** The counting route to the next rung. ABSENT, not empty, when there is
   *  nothing to offer (Scale's hourly burst is a loop guard, not a boundary) —
   *  absence reads as what it is; an empty string would read as "unavailable". */
  url?: string;
  /** `retry-after` in seconds, when the dialect sent one. */
  retryAfterSeconds?: number;
}

/**
 * The additive fields a tool result carries when the response said something an
 * agent can act on. `undefined` on everything else, so a 2xx, a coverage 404
 * and a read-only 403 keep exactly the `{provider, path, status, body}` they
 * have always had.
 */
function hintsOf(r: RestResult): { upgrade?: UpgradeHint; coverage?: string } {
  const h = r.hints;
  if (!h || r.ok) return {};
  const out: { upgrade?: UpgradeHint; coverage?: string } = {};
  // The TIER header is the trigger, not the status: it is the one thing present
  // on every over-limit refusal in every dialect (GitHub's 403, Linear's 400,
  // the other nineteen 429s), and present on nothing else.
  if (h.tier !== undefined) {
    const retry = h.retryAfter === undefined ? Number.NaN : Number(h.retryAfter);
    out.upgrade = {
      tier: h.tier,
      ...(h.upgrade === undefined ? {} : { url: h.upgrade }),
      ...(Number.isFinite(retry) ? { retryAfterSeconds: retry } : {}),
    };
  }
  // The coverage manifest, on an uncovered surface — the same pointer the
  // header carries, surfaced where an agent will actually read it. Independent
  // of `upgrade`: a coverage 404 sells nothing and never carries one.
  if (h.coverage !== undefined) out.coverage = h.coverage;
  return out;
}

/** A REST passthrough tool result: the exact provider body + status + path,
 *  plus `upgrade`/`coverage` when the refusal carried one. */
async function passthrough(u: McpUniverse, provider: Provider, path: string): Promise<CallToolResult> {
  const r = await u.restGet(provider, path);
  return refusable(u, { provider, path, status: r.status, body: r.body, ...hintsOf(r) }, !r.ok);
}

export function registerTools(server: McpServer, u: McpUniverse): void {
  const cfg = u.config;
  // Spread into every registration below: `_meta.securitySchemes` on the
  // hosted endpoint, nothing at all on the stdio package.
  const toolMeta = securitySchemesFor(cfg);

  // ---- Discovery ----------------------------------------------------------
  server.registerTool(
    "orient",
    {
      ...toolMeta,
      title: "Orient in the SandboxAPIs universe",
      annotations: readOnlyAnnotations("Orient in the SandboxAPIs universe", true),
      description:
        "START HERE. Returns everything needed to use SandboxAPIs with no docs: the universe/theme, every API surface and its base URL (git hosts and issue trackers), live-vs-snapshot modes and how to pin, the org and its teams/repos, notable entry points (each with a ready-to-run REST path), where the coverage manifest lives, and this server's access block: whether a key is set and how many requests are left this hour. " +
        // SCRATCH WRITES, phase 1: the REST surface accepts them and THIS SERVER
        // DOES NOT. Said here, in the one description every agent reads first,
        // because an agent that discovers the capability from the docs and then
        // cannot find a tool for it will assume the tool list is stale. When
        // `list_issues` learns to merge and `create_issue` appears, this
        // sentence is what changes.
        "Writes: this server is READ-ONLY, including for a scratch-enabled key. The scratch layer (a per-key, 24-hour overlay: GitHub issues and issue comments, Jira comments and transitions, and Slack messages into existing channels) is a REST feature, so use the GitHub, Jira or Slack base URL above with your key for it, and expect the tools here to answer from the shared data set alone.",
      inputSchema: {},
    },
    async () => json(await buildOrientation(u)),
  );

  // ---- Budget -------------------------------------------------------------
  //
  // The tool an agent should call before a loop. Its FIRST SENTENCE says the
  // call is free and says when to use it, because a tool description is the
  // only documentation an agent reads — and a budget check an agent believes
  // is expensive is a budget check it skips, which is the whole failure this
  // exists to prevent.
  server.registerTool(
    "check_budget",
    {
      ...toolMeta,
      title: "Check the remaining request budget",
      annotations: readOnlyAnnotations("Check the remaining request budget", true),
      description:
        "Costs nothing. Call it before any loop of more than a handful of requests. Returns this server's real hourly window (limit, remaining, when it resets) read from the provider's own budget endpoint, which is exempt from the budget it reports, plus whether a key is set and where to raise the limit. The window is ONE bucket per caller shared across every provider host, so the numbers apply to all of them.",
      inputSchema: {
        provider: providerArg
          .optional()
          .describe("The provider host you are about to call, one of the ids orient lists, e.g. 'github'. Optional: the budget is one shared window, so the numbers are the same for every provider."),
      },
    },
    async ({ provider }) => {
      const budget = await readBudget(u);
      const asked: Provider = provider ?? BUDGET_PROVIDER;
      const upgradeUrl = upgradeUrlFor(budget.keyed);
      if (!budget.numbers) {
        // Honest absence, never a plausible 60: an agent pacing itself off a
        // number nobody enforced is worse off than one that knows it cannot
        // tell (invariant #4).
        return json(
          {
            keyed: budget.keyed,
            provider: asked,
            readFrom: BUDGET_PROVIDER,
            upgradeUrl,
            error: `Could not read the budget: ${budget.unavailable}.`,
          },
          true,
        );
      }
      const { limit, remaining, reset } = budget.numbers;
      return json({
        keyed: budget.keyed,
        limit,
        remaining,
        reset,
        resetsInSeconds: resetsInSeconds(reset, Date.now()),
        upgradeUrl,
        // Which host answered, stated rather than implied: only the GitHub
        // dialect publishes a budget endpoint that is itself exempt from the
        // budget, so that is where the read goes whatever `provider` names.
        provider: asked,
        readFrom: BUDGET_PROVIDER,
        readPath: BUDGET_PATH,
        note: budget.keyed
          ? "One shared hourly window across every provider host. A refusal carries `upgrade` in the tool result with the rung that refused and where to go next."
          : budget.remote === true
            ? `One shared hourly window across every provider host. To raise it, ${keyRemedy(true)}.`
            : "One shared hourly window across every provider host. Set SANDBOXAPIS_API_KEY on this MCP server to raise it.",
      });
    },
  );

  // ---- Query: repositories ------------------------------------------------
  server.registerTool(
    "list_repositories",
    {
      ...toolMeta,
      title: "List the org's repositories",
      annotations: readOnlyAnnotations("List the org's repositories", true),
      description: "List repositories for the universe's org. Results are identical to the provider's REST API and carry provider-form ids (node_id / numeric id).",
      inputSchema: {
        provider: providerArg.describe(`The git host to list repositories from, one of the ids orient lists: ${GIT_HOSTS}, e.g. 'github'.`),
      },
    },
    async ({ provider }) => requireGit(provider) ?? passthrough(u, provider, mcpProviderById[provider].orgReposPath!(cfg.orgLogin)),
  );

  server.registerTool(
    "get_repository",
    {
      ...toolMeta,
      title: "Get a repository",
      annotations: readOnlyAnnotations("Get a repository", true),
      description: "Fetch one repository by name (default: the flagship repo). Provider-shaped, with provider-form ids.",
      inputSchema: {
        provider: providerArg.describe(`The git host to read the repository from, one of the ids orient lists: ${GIT_HOSTS}, e.g. 'github'.`),
        repo: z.string().optional().describe("The repository name without the organisation, e.g. 'parthenon', the flagship repo, which is used when omitted."),
      },
    },
    async ({ provider, repo }) => requireGit(provider) ?? passthrough(u, provider, projectPath(u, provider, repo ?? cfg.flagshipRepo)),
  );

  // ---- Query: pull requests ----------------------------------------------
  server.registerTool(
    "list_pull_requests",
    {
      ...toolMeta,
      title: "List pull requests / merge requests",
      annotations: readOnlyAnnotations("List pull requests / merge requests", true),
      description: "List a repo's pull requests (GitHub) or merge requests (GitLab). Optional state filter.",
      inputSchema: {
        provider: providerArg.describe(`The git host to read from, one of the ids orient lists: ${GIT_HOSTS}, e.g. 'gitlab' for merge requests.`),
        repo: z.string().optional().describe("The repository name without the organisation, e.g. 'parthenon', the flagship repo, which is used when omitted."),
        state: z
          .enum(["open", "closed", "merged", "all"])
          .optional()
          .describe("Filter by state, one of 'open', 'closed', 'merged' or 'all', e.g. 'merged'; when omitted the provider's own default applies."),
      },
    },
    async ({ provider, repo, state }) => {
      const guard = requireGit(provider);
      if (guard) return guard;
      const base = projectPath(u, provider, repo ?? cfg.flagshipRepo);
      return passthrough(u, provider, mcpProviderById[provider].pullsPath!(base, state));
    },
  );

  server.registerTool(
    "get_pull_request",
    {
      ...toolMeta,
      title: "Get a pull/merge request with its reviews",
      annotations: readOnlyAnnotations("Get a pull/merge request with its reviews", true),
      description:
        "Fetch one PR (GitHub) / MR (GitLab) plus its reviews (GitHub) / approvals (GitLab). Returns both in one result; each carries provider-form ids for cross-referencing.",
      inputSchema: {
        provider: providerArg.describe(`The git host to read from, one of the ids orient lists: ${GIT_HOSTS}, e.g. 'github'.`),
        number: z
          .number()
          .int()
          .positive()
          .describe("The pull request number as the provider shows it (the merge request iid on GitLab), a positive integer, e.g. 47."),
        repo: z.string().optional().describe("The repository name without the organisation, e.g. 'parthenon', the flagship repo, which is used when omitted."),
      },
    },
    async ({ provider, number, repo }) => {
      const guard = requireGit(provider);
      if (guard) return guard;
      const base = projectPath(u, provider, repo ?? cfg.flagshipRepo);
      const bundle = await mcpProviderById[provider].pullBundle!((p, path) => u.restGet(p, path), base, number);
      return json(bundle.payload, !bundle.ok);
    },
  );

  // ---- Query: issues ------------------------------------------------------
  server.registerTool(
    "list_issues",
    {
      ...toolMeta,
      title: "List issues",
      annotations: readOnlyAnnotations("List issues", true),
      description: "List a repo's issues. Optional state filter (open/closed/all).",
      inputSchema: {
        provider: providerArg.describe(
          "The provider to read issues from, one of the ids orient lists: 'github' or 'gitlab' (per repository), or 'jira' or 'linear' (across the whole tracker), e.g. 'jira'.",
        ),
        repo: z
          .string()
          .optional()
          .describe("The repository name without the organisation, e.g. 'parthenon', the flagship repo, which is used when omitted; ignored by 'jira' and 'linear'."),
        state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state, one of 'open', 'closed' or 'all', e.g. 'closed'; when omitted the provider's own default applies."),
      },
    },
    async ({ provider, repo, state }) => {
      const def = mcpProviderById[provider];
      // GraphQL-only trackers (Linear) answer with a query, not a path.
      if (def.issuesGraphql) {
        const r = await u.gqlPost(provider, def.issuesGraphql(state));
        return refusable(u, { provider, transport: "graphql", status: r.status, body: r.body, ...hintsOf(r) }, !r.ok);
      }
      if (!def.issuesPath) {
        return json({ error: `${provider} has no issue surface here: ${def.noIssuesReason ?? "not served."}` }, true);
      }
      // Trackers address issues without a repo (JQL/filters), git hosts per-repo.
      const base = def.projectPath ? projectPath(u, provider, repo ?? cfg.flagshipRepo) : "";
      return passthrough(u, provider, def.issuesPath(base, state));
    },
  );

  // ---- Query: users -------------------------------------------------------
  server.registerTool(
    "get_user",
    {
      ...toolMeta,
      title: "Get a user",
      annotations: readOnlyAnnotations("Get a user", true),
      description: "Fetch a user by login/username. Provider-shaped, with provider-form ids.",
      inputSchema: {
        provider: providerArg.describe(`The git host to read the user from, one of the ids orient lists: ${GIT_HOSTS}, e.g. 'github'.`),
        login: z.string().describe("The user's login (GitHub) or username (GitLab), e.g. 'athena'."),
      },
    },
    async ({ provider, login }) => requireGit(provider) ?? passthrough(u, provider, mcpProviderById[provider].userPath!(login)),
  );

  // ---- Query: commits by author (read straight from the artifact) ---------
  server.registerTool(
    "search_commits_by_author",
    {
      ...toolMeta,
      title: "Search commits by author",
      annotations: readOnlyAnnotations("Search commits by author", true),
      description:
        "Find commits authored by a given login in a repo. Returns SHAs (identical across GitHub and GitLab, invariant #5) with a REST path to fetch each, so you can cross-reference against either provider.",
      inputSchema: {
        author: z.string().describe("The author's login, matched without regard to case, e.g. 'athena'."),
        repo: z.string().optional().describe("The repository name without the organisation, e.g. 'parthenon', the flagship repo, which is used when omitted."),
        provider: providerArg
          .optional()
          .describe(
            `The git host whose REST path each returned commit carries, ${GIT_HOSTS}, defaulting to 'github'; commits are read from GitHub either way, because the SHAs are identical on every host.`,
          ),
      },
    },
    async ({ author, repo, provider }) => {
      const prov: Provider = provider ?? "github";
      const guard = requireGit(prov);
      if (guard) return guard;
      const repoName = repo ?? cfg.flagshipRepo;

      // Read the repo's recent commits through the public API and filter here.
      // GitHub's own `?author=` parameter is NOT honoured by the mirror today
      // (it returns the unfiltered list), so relying on it would silently
      // return every commit as if it matched. Filtering client-side is slower
      // but never wrong — and `scanned`/`truncated` below say exactly how far
      // the answer looked, rather than implying it saw all of history.
      const perPage = 100;
      const maxPages = 5;
      const collected: Array<Record<string, unknown>> = [];
      let truncated = false;
      for (let page = 1; page <= maxPages; page++) {
        const res = await u.restGet("github", `/repos/${cfg.orgLogin}/${repoName}/commits?per_page=${perPage}&page=${page}`);
        if (!res.ok) {
          return refusable(u, { error: `Could not read commits for "${repoName}".`, status: res.status, body: res.body, ...hintsOf(res) }, true);
        }
        const batch = Array.isArray(res.body) ? (res.body as Array<Record<string, unknown>>) : [];
        collected.push(...batch);
        if (batch.length < perPage) break;
        if (page === maxPages) truncated = true;
      }

      const base = projectPath(u, prov, repoName);
      const matches = collected.filter((c) => {
        const login = ((c["author"] as { login?: string } | null) ?? {}).login;
        return typeof login === "string" && login.toLowerCase() === author.toLowerCase();
      });

      if (matches.length === 0) {
        const seen = [
          ...new Set(
            collected
              .map((c) => ((c["author"] as { login?: string } | null) ?? {}).login)
              .filter((l): l is string => typeof l === "string"),
          ),
        ].slice(0, 8);
        return json(
          { error: `No commits by "${author}" in ${repoName} within the ${collected.length} most recent commits.`, authorsSeen: seen, truncated },
          true,
        );
      }

      return json({
        provider: prov,
        repo: repoName,
        author,
        count: matches.length,
        scanned: collected.length,
        truncated,
        commits: matches.map((c) => {
          const sha = String(c["sha"]);
          const message = String((c["commit"] as { message?: string } | undefined)?.message ?? "").split("\n")[0];
          return { sha, message, restPath: mcpProviderById[prov].commitPath!(base, sha) };
        }),
      });
    },
  );

  // ---- Snapshot pinning ---------------------------------------------------
  server.registerTool(
    "get_snapshot",
    {
      ...toolMeta,
      title: "Get a pinned snapshot hostname",
      annotations: readOnlyAnnotations("Get a pinned snapshot hostname", false),
      description:
        "Return the pinned, reproducible hostname for a provider. Point your client's base URL at it for drift-free CI. A snapshot regenerates byte-identically on every request.",
      inputSchema: {
        provider: providerArg.describe("The provider to pin, one of the ids orient lists, e.g. 'github'; the newest frozen generation for it is returned, with any older ones listed beside it."),
      },
    },
    async ({ provider }) => {
      // Prefer the NEWEST generation for the provider — it is the complete
      // surface (files included). Older generations stay reachable by name.
      const forProvider = cfg.snapshotPins.filter((p) => p.provider === provider);
      const match = forProvider.slice().sort((a, b) => b.generation - a.generation)[0];
      if (!match) {
        return json({ error: `No snapshot available for ${provider}.`, availablePins: cfg.snapshotPins.map((p) => p.pin) }, true);
      }
      const pin = match.pin;
      const baseUrl = snapshotBaseUrl(cfg, pin);
      const others = forProvider.filter((p) => p.pin !== pin);
      return json({
        provider,
        pin,
        baseUrl,
        generation: match.generation,
        // Both halves of the freeze: `generation` is WHICH UNIVERSE (the data),
        // `apiVersion` is WHICH DIALECT of the provider's API it renders in.
        // Matches what /v1/snapshots reports for the same pin.
        apiVersion: match.apiVersion,
        files: match.files,
        ...(others.length
          ? {
              otherGenerations: others.map((p) => ({ pin: p.pin, baseUrl: snapshotBaseUrl(cfg, p.pin), generation: p.generation, apiVersion: p.apiVersion, files: p.files })),
              note: "Generations are DIFFERENT universes (issue keys and SHAs differ), not the same data with more endpoints — pick one and stay on it.",
            }
          : {}),
        howToPin: `Point your ${provider} client's base URL at ${baseUrl} instead of the live host. Every request returns the identical pinned universe — safe for CI assertions.`,
        example: mcpProviderById[provider].exampleCurl(baseUrl, cfg.orgLogin, cfg.flagshipRepo),
      });
    },
  );
}
