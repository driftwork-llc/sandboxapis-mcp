// The discovery payload (SPEC "MCP discovery"): everything an agent needs to
// orient itself completely — universe/theme, providers + base URLs,
// live-vs-snapshot modes + how to pin, the org and its teams, notable entry
// points, and where the coverage manifest lives — so its NEXT action can be a
// correct API call with no docs reading.
//
// Composed entirely from the PUBLIC API, exactly as an agent would compose it.

import { snapshotBaseUrl, type SnapshotPin } from "./config.js";
import { readBudget, toAccess, type Access } from "./budget.js";
import { computeEntryPoints, type EntryPoint, type RepoLite, type TeamLite } from "./entrypoints.js";
import { MCP_PROVIDERS } from "./providers.js";
import type { Provider } from "./provider-ids.js";
import type { McpUniverse } from "./universe.js";

export interface Orientation {
  service: string;
  readOnly: string;
  /**
   * WHAT THIS AGENT MAY SPEND, stated before it spends any.
   *
   * The one thing orientation used to leave out. An agent planning a sweep had
   * no way to learn it was anonymous at 60 requests/hour until request 61 was
   * refused mid-loop; the only nudge was a stderr line at startup that no agent
   * reads. `limit`/`remaining`/`reset` come from ONE free read of GitHub's
   * `GET /rate_limit` (exempt from the budget it reports), and are absent
   * rather than guessed when that read fails — `note` says so.
   */
  access: Access;
  universe: { name: string; theme: string; org: { login: string; name: string } };
  providers: Array<{ id: Provider; baseUrl: string; howTo: string }>;
  modes: {
    live: { description: string };
    snapshots: {
      description: string;
      howToPin: string;
      /** `generation` is OUR universe generation (orthogonal to the provider
       *  API version in the pin name); `files` says whether that generation
       *  serves repository file endpoints. Generations are DIFFERENT
       *  universes — never swap a suffix expecting the same data.
       *
       *  The generation union is TAKEN FROM `SnapshotPin` rather than repeated:
       *  it was repeated, and the copy went stale the moment generation 9 was
       *  registered, failing the build in a file that has nothing to do with
       *  the wave. One declaration, one place to widen. */
      available: Array<{ pin: string; provider: string; baseUrl: string; generation: SnapshotPin["generation"]; files: boolean }>;
    };
  };
  org: {
    login: string;
    name: string;
    teams: Array<{ slug: string; name: string; members: number }>;
    repos: Array<{ name: string; defaultBranch: string }>;
  };
  entryPoints: EntryPoint[];
  coverage: { manifestUrl: string; note: string };
  nextSteps: string[];
}

const asArray = <T>(body: unknown): T[] => (Array.isArray(body) ? (body as T[]) : []);

export async function buildOrientation(u: McpUniverse): Promise<Orientation> {
  const cfg = u.config;
  const orgLogin = cfg.orgLogin;

  // Everything the org section needs, in parallel — plus the budget read,
  // which is free (GitHub excludes `/rate_limit` from the window it reports)
  // and so adds nothing to what orientation already costs.
  const [orgRes, teamsRes, reposRes, budget] = await Promise.all([
    u.restGet("github", `/orgs/${orgLogin}`),
    u.restGet("github", `/orgs/${orgLogin}/teams?per_page=100`),
    u.restGet("github", `/orgs/${orgLogin}/repos?sort=pushed&per_page=100`),
    readBudget(u),
  ]);

  const orgBody = (typeof orgRes.body === "object" && orgRes.body !== null ? orgRes.body : {}) as {
    login?: string;
    name?: string;
  };
  const orgName = orgBody.name ?? cfg.universe;

  // Team member counts: one call each, and teams are few. Resolved here so
  // entry points can reuse them instead of re-fetching.
  const teamList = asArray<TeamLite>(teamsRes.body);
  const teams = await Promise.all(
    teamList.map(async (team) => {
      const m = await u.restGet("github", `/orgs/${orgLogin}/teams/${team.slug}/members`);
      return { team, members: asArray<unknown>(m.body).length };
    }),
  );

  const repos = asArray<RepoLite>(reposRes.body);
  const flagship = repos[0]?.name ?? cfg.flagshipRepo;

  const snapshots = cfg.snapshotPins.map((s) => ({
    pin: s.pin,
    provider: s.provider,
    baseUrl: snapshotBaseUrl(cfg, s.pin),
    generation: s.generation,
    // Stated per-pin so an agent never has to guess which pin serves files —
    // and never assumes the two generations hold the same data.
    files: s.files,
  }));

  return {
    // Generic by design — the providers[] list right below is the factual
    // enumeration, so this line never goes stale on a provider launch.
    service: "SandboxAPIs — read-only, API-compatible replicas of the developer tools you already use, all pre-loaded with the same simulated data set.",
    readOnly: "Every universe is READ-ONLY. Mutations (writes, GraphQL mutations) return the provider's error shape with a friendly message.",
    access: toAccess(budget),
    universe: { name: cfg.universe, theme: cfg.theme, org: { login: orgBody.login ?? orgLogin, name: orgName } },
    providers: MCP_PROVIDERS.map((d) => {
      const baseUrl = cfg.providers[d.id].baseUrl;
      return { id: d.id, baseUrl, howTo: d.howTo(baseUrl) };
    }),
    modes: {
      live: { description: "The current, continuously-fresh universe served on the provider hosts (newest activity within hours)." },
      snapshots: {
        description: "Pinned, reproducible universes for CI. A snapshot regenerates byte-identically on every request, so pinned tests never drift.",
        howToPin: `Point your client's base URL at a snapshot host instead of the live host — e.g. ${snapshotBaseUrl(cfg, "gh-2026-03")}. Use the get_snapshot tool to fetch the exact hostname for a provider.`,
        available: snapshots,
      },
    },
    org: {
      login: orgBody.login ?? orgLogin,
      name: orgName,
      teams: teams.map((t) => ({ slug: t.team.slug, name: t.team.name, members: t.members })),
      repos: repos.map((r) => ({ name: r.name, defaultBranch: r.default_branch ?? "main" })),
    },
    entryPoints: await computeEntryPoints(u, { repos, teams }),
    coverage: {
      manifestUrl: cfg.coverageUrl,
      note: "The coverage manifest is the plan-of-record for what's served. Uncovered REST endpoints return 404 + an X-SandboxAPIs-Coverage header; uncovered GraphQL fields return an explicit coverage error.",
    },
    nextSteps: [
      ...MCP_PROVIDERS.flatMap((d) => d.nextSteps(cfg.providers[d.id].baseUrl, orgLogin, flagship)),
      "Or call the query tools (list_repositories, get_pull_request, search_commits_by_author, …) — results are identical to the REST APIs and carry provider-form ids.",
      "Before any loop of more than a handful of requests, call check_budget — it is free (the budget endpoint is exempt from the budget it reports) and says how many requests are left in this hour.",
    ],
  };
}
