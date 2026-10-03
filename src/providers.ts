// The MCP server's provider registry (Phase 16, M2). All provider-specific
// vocabulary the tools need — path grammar, state-name mapping, orientation
// copy, the PR-bundle shape — lives in these defs, so tool bodies stay
// provider-agnostic and adding a provider is one def.
//
// These are pure path/copy definitions: no renderer, no reader, nothing that
// would drag the engine into the published client.

import type { Provider } from "./provider-ids.js";

export type PullState = "open" | "closed" | "merged" | "all";
export type IssueState = "open" | "closed" | "all";

export interface RestFetch {
  (provider: Provider, path: string): Promise<{ status: number; body: unknown; ok: boolean }>;
}

export interface McpProviderDef {
  id: Provider;
  /** Orientation copy: how to point a client at this provider's base URL. */
  howTo(baseUrl: string): string;
  /** Ready-to-run curl lines for orientation nextSteps. */
  nextSteps(baseUrl: string, org: string, flagshipRepo: string): string[];
  /** GraphQL-only trackers (Linear) list issues with a query, not a path.
   *  When present, list_issues POSTs this instead of GETting `issuesPath`. */
  issuesGraphql?(state?: IssueState): string;
  // --- git-shaped surfaces: absent on issue-tracker providers (Jira/Linear),
  // where `notGitReason` is what the git tools explain instead of 404ing.
  projectPath?(org: string, repo: string): string;
  orgReposPath?(org: string): string;
  pullsPath?(projectBase: string, state?: PullState): string;
  userPath?(login: string): string;
  commitPath?(projectBase: string, sha: string): string;
  /** Fetch a PR/MR plus its reviews/approvals, in the provider's vocabulary. */
  pullBundle?(restGet: RestFetch, projectBase: string, number: number): Promise<{ payload: Record<string, unknown>; ok: boolean }>;
  notGitReason?: string;
  /** Absent when the provider has no issue surface; `noIssuesReason` is what
   *  the list_issues tool explains instead of 404ing. Tracker providers take
   *  an empty projectBase (there is no repo addressing). */
  issuesPath?(projectBase: string, state?: IssueState): string;
  noIssuesReason?: string;
  exampleCurl(baseUrl: string, org: string, repo: string): string;
}

const github: McpProviderDef = {
  id: "github",
  howTo: (baseUrl) =>
    `Point your GitHub client (e.g. Octokit) baseUrl/baseUrl at ${baseUrl} — a bare env-var swap. Paths, JSON, and headers mirror api.github.com.`,
  nextSteps: (baseUrl, org, flagship) => [
    `GitHub: curl ${baseUrl}/repos/${org}/${flagship}`,
    `GitHub: curl ${baseUrl}/repos/${org}/${flagship}/pulls?state=all`,
  ],
  projectPath: (org, repo) => `/repos/${org}/${repo}`,
  orgReposPath: (org) => `/orgs/${org}/repos`,
  // GitHub has no "merged" list state — merged PRs are closed.
  pullsPath: (base, state) => `${base}/pulls${state ? `?state=${state === "merged" ? "closed" : state}` : ""}`,
  issuesPath: (base, state) => `${base}/issues${state ? `?state=${state}` : ""}`,
  userPath: (login) => `/users/${login}`,
  commitPath: (base, sha) => `${base}/commits/${sha}`,
  exampleCurl: (baseUrl, org, repo) => `curl ${baseUrl}/repos/${org}/${repo}`,
  async pullBundle(restGet, base, number) {
    const pull = await restGet("github", `${base}/pulls/${number}`);
    const reviews = await restGet("github", `${base}/pulls/${number}/reviews`);
    return { payload: { provider: this.id, pull: pull.body, pullStatus: pull.status, reviews: reviews.body }, ok: pull.ok };
  },
};

const gitlab: McpProviderDef = {
  id: "gitlab",
  howTo: (baseUrl) => `Point your GitLab client (e.g. python-gitlab) at ${baseUrl}. Paths mirror gitlab.com/api/v4.`,
  nextSteps: (baseUrl, org, flagship) => [`GitLab: curl ${baseUrl}/api/v4/projects/${org}%2F${flagship}`],
  projectPath: (org, repo) => `/api/v4/projects/${encodeURIComponent(`${org}/${repo}`)}`,
  orgReposPath: () => `/api/v4/projects`,
  // GitLab uses `opened` where GitHub uses `open`.
  pullsPath: (base, state) => {
    const gl = state === "open" ? "opened" : state;
    return `${base}/merge_requests${gl ? `?state=${gl}` : ""}`;
  },
  issuesPath: (base, state) => {
    const gl = state === "open" ? "opened" : state;
    return `${base}/issues${gl ? `?state=${gl}` : ""}`;
  },
  userPath: (login) => `/api/v4/users?username=${encodeURIComponent(login)}`,
  commitPath: (base, sha) => `${base}/repository/commits/${sha}`,
  exampleCurl: (baseUrl, org, repo) => `curl ${baseUrl}/api/v4/projects/${org}%2F${repo}`,
  async pullBundle(restGet, base, number) {
    const mr = await restGet("gitlab", `${base}/merge_requests/${number}`);
    const approvals = await restGet("gitlab", `${base}/merge_requests/${number}/approvals`);
    return { payload: { provider: this.id, merge_request: mr.body, mrStatus: mr.status, approvals: approvals.body }, ok: mr.ok };
  },
};

const bitbucket: McpProviderDef = {
  id: "bitbucket",
  howTo: (baseUrl) =>
    `Point your Bitbucket client (e.g. the 'bitbucket' npm package) baseUrl at ${baseUrl}. Paths mirror api.bitbucket.org/2.0.`,
  nextSteps: (baseUrl, org, flagship) => [`Bitbucket: curl ${baseUrl}/2.0/repositories/${org}/${flagship}`],
  projectPath: (org, repo) => `/2.0/repositories/${org}/${repo}`,
  orgReposPath: (org) => `/2.0/repositories/${org}`,
  // Bitbucket PR list defaults to OPEN; state values are UPPERCASE and the
  // param repeats for multiple states ("all" = every state explicitly).
  pullsPath: (base, state) => {
    if (!state) return `${base}/pullrequests`;
    if (state === "all") return `${base}/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED`;
    const bb = state === "open" ? "OPEN" : state === "merged" ? "MERGED" : "DECLINED";
    return `${base}/pullrequests?state=${bb}`;
  },
  // No issuesPath: the Bitbucket issue tracker is a dead surface (sunset
  // 2026-08-20) — list_issues explains rather than 404ing.
  noIssuesReason:
    "Bitbucket Cloud's issue tracker was sunset by Atlassian (August 2026), so the replica doesn't serve one either. The same canonical issues are served today on the jira. and linear. hosts.",
  userPath: (login) => `/2.0/users/${encodeURIComponent(login)}`,
  commitPath: (base, sha) => `${base}/commit/${sha}`,
  exampleCurl: (baseUrl, org, repo) => `curl ${baseUrl}/2.0/repositories/${org}/${repo}`,
  async pullBundle(restGet, base, number) {
    const pr = await restGet("bitbucket", `${base}/pullrequests/${number}`);
    const activity = await restGet("bitbucket", `${base}/pullrequests/${number}/activity`);
    return { payload: { provider: this.id, pullrequest: pr.body, prStatus: pr.status, activity: activity.body }, ok: pr.ok };
  },
};

const ado: McpProviderDef = {
  id: "ado",
  howTo: (baseUrl) =>
    `Point azure-devops-node-api at ${baseUrl}/olympus-labs (the serverUrl is the organization URL). Paths mirror dev.azure.com; the discovery contract (connectionData/resourceAreas) is served, so official SDKs route correctly.`,
  nextSteps: (baseUrl, org) => [`Azure DevOps: curl "${baseUrl}/${org}/_apis/projects?api-version=7.1"`],
  // Single team project named after the org (DECISIONS §P18).
  projectPath: (org, repo) => `/${org}/${org}/_apis/git/repositories/${repo}`,
  orgReposPath: (org) => `/${org}/_apis/git/repositories`,
  pullsPath: (base, state) => {
    const status = state === "open" ? "active" : state === "merged" ? "completed" : state === "closed" ? "abandoned" : "all";
    return `${base}/pullrequests${state ? `?searchCriteria.status=${status}` : ""}`;
  },
  // ADO Boards work items ARE served (Phase 22) — but listing them is a WIQL
  // POST (`/_apis/wit/wiql`), which no GET path can express, so this tool hands
  // over the exact call instead of pretending the surface is missing.
  noIssuesReason:
    "Azure DevOps serves work items — the same canonical issues Jira and Linear render — but listing them is a WIQL POST, not a GET, so it's outside this tool. Run: curl -X POST \"$BASE/olympus-labs/olympus-labs/_apis/wit/wiql?api-version=7.1\" -H 'content-type: application/json' -d '{\"query\":\"SELECT [System.Id] FROM WorkItems ORDER BY [System.ChangedDate] DESC\"}', then fetch ids via /_apis/wit/workitems?ids=…",
  userPath: (login) => `/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(login)}`,
  commitPath: (base, sha) => `${base}/commits/${sha}`,
  exampleCurl: (baseUrl, org, repo) => `curl "${baseUrl}/${org}/${org}/_apis/git/repositories/${repo}?api-version=7.1"`,
  async pullBundle(restGet, base, number) {
    const pr = await restGet("ado", `${base}/pullrequests/${number}`);
    const threads = await restGet("ado", `${base}/pullrequests/${number}/threads`);
    return { payload: { provider: this.id, pullRequest: pr.body, prStatus: pr.status, threads: threads.body }, ok: pr.ok };
  },
};

const jira: McpProviderDef = {
  id: "jira",
  howTo: (baseUrl) =>
    `Point your Jira client (e.g. jira.js Version3Client, python jira) at ${baseUrl} as the host. Paths mirror {site}.atlassian.net — rest/api/3 + rest/agile/1.0; the removed old /search family serves 410 like live Jira, use /rest/api/3/search/jql.`,
  nextSteps: (baseUrl) => [`Jira: curl "${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent("project = ARGO ORDER BY updated DESC")}&fields=summary,status"`],
  notGitReason: "Jira is an issue tracker — the same canonical story's git surfaces live on the gh./gl./bb./ado. hosts.",
  // Tracker issue reads go through JQL search (projectBase is unused).
  issuesPath: (_base, state) =>
    `/rest/api/3/search/jql?jql=${encodeURIComponent(state === "closed" ? "statusCategory = Done ORDER BY updated DESC" : state === "all" ? "created >= '2000-01-01' ORDER BY updated DESC" : "statusCategory != Done ORDER BY updated DESC")}&fields=summary,status,assignee,issuetype`,
  exampleCurl: (baseUrl) => `curl "${baseUrl}/rest/api/3/myself"`,
};

const linear: McpProviderDef = {
  id: "linear",
  howTo: (baseUrl) =>
    `Point @linear/sdk at ${baseUrl}/graphql via the client's apiUrl option (Linear is GraphQL-only — one endpoint). Both auth forms pass: a bare API key in Authorization, or an OAuth Bearer token.`,
  nextSteps: (baseUrl) => [
    `Linear: curl -X POST "${baseUrl}/graphql" -H 'content-type: application/json' -d '{"query":"{ rateLimitStatus { kind limits { type remainingAmount } } }"}'`,
  ],
  notGitReason: "Linear is an issue tracker — the same canonical story's git surfaces live on the gh./gl./bb./ado. hosts.",
  // Linear is GraphQL-only: issues come from a query, not a REST path. Linear's
  // state *types* are the filterable axis (backlog/unstarted/started/completed/
  // canceled), so open == "not completed" rather than an `open` literal.
  issuesGraphql: (state) => {
    const filter =
      state === "closed"
        ? `, filter: { state: { type: { eq: "completed" } } }`
        : state === "all"
          ? ""
          : `, filter: { state: { type: { neq: "completed" } } }`;
    return `{ issues(first: 50${filter}) { nodes { id identifier title url createdAt updatedAt state { name type } assignee { displayName } team { key name } } } }`;
  },
  exampleCurl: (baseUrl) => `curl -X POST "${baseUrl}/graphql" -H 'content-type: application/json' -d '{"query":"{ rateLimitStatus { kind } }"}'`,
};

const anthropic: McpProviderDef = {
  id: "anthropic",
  howTo: (baseUrl) =>
    `Point the official anthropic SDK's Admin-API calls at ${baseUrl} via the client's baseURL option (or curl directly). Send x-api-key (any value is accepted — the sandbox has no credential ceremony) and the REQUIRED anthropic-version: 2023-06-01 header. This is the org's AI-telemetry surface: members, workspaces, API keys, usage & cost reports, and the Claude Code Analytics report — all reconciling with the git activity on the gh./gl./bb./ado. hosts.`,
  nextSteps: (baseUrl) => [
    `Anthropic: curl "${baseUrl}/v1/organizations/usage_report/claude_code?starting_at=2026-06-01" -H 'x-api-key: any' -H 'anthropic-version: 2023-06-01'`,
    `Anthropic: curl "${baseUrl}/v1/organizations/users" -H 'x-api-key: any' -H 'anthropic-version: 2023-06-01'`,
  ],
  notGitReason:
    "Anthropic is an AI-platform telemetry provider — no repositories or issues; the commits and PRs its Claude Code analytics count live on the git hosts, with matching identities.",
  noIssuesReason:
    "Anthropic serves org telemetry (usage, cost, Claude Code analytics), not an issue tracker — tracker surfaces live on jira./linear.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/v1/organizations/me" -H 'x-api-key: any' -H 'anthropic-version: 2023-06-01'`,
};

const cursor: McpProviderDef = {
  id: "cursor",
  howTo: (baseUrl) =>
    `Point your Cursor team-API calls at ${baseUrl} (curl or any HTTP client — Cursor publishes no official SDK). Auth is HTTP Basic with the key as the USERNAME and an empty password (curl -u any-key:) or a Bearer token; any value is accepted. Admin usage endpoints are POST-as-read (JSON date-range body, epoch ms); analytics + AI code tracking are GETs with startDate/endDate. The AI code tracking commits carry REAL SHAs — every commitHash resolves on the gh./gl./bb./ado. hosts.`,
  nextSteps: (baseUrl) => [
    `Cursor: curl -u any-key: "${baseUrl}/teams/members"`,
    `Cursor: curl -u any-key: "${baseUrl}/analytics/team/dau?startDate=7d&endDate=0d"`,
  ],
  notGitReason:
    "Cursor is an AI-editor telemetry provider — no repositories or issues; the commits its AI code tracking attributes live on the git hosts, with matching SHAs and identities.",
  noIssuesReason:
    "Cursor serves team telemetry (usage, spend, analytics, AI code tracking), not an issue tracker — tracker surfaces live on jira./linear.",
  exampleCurl: (baseUrl) => `curl -u any-key: "${baseUrl}/teams/members"`,
};

const devin: McpProviderDef = {
  id: "devin",
  howTo: (baseUrl) =>
    `Point your Devin v3 API calls at ${baseUrl} (curl or a client generated from the official v3-openapi.yaml). Auth is a Bearer token (Devin's cog_ service-user keys — any value is accepted here). The enterprise scope serves the sandbox's tier-1 slice: sessions, members/users, ACU consumption (PST day buckets, as documented), and usage metrics. Session PRs link to real pulls on the git hosts, with matching identities.`,
  nextSteps: (baseUrl) => [
    `Devin: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v3/enterprise/sessions?first=5"`,
    `Devin: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v3/enterprise/consumption/daily"`,
  ],
  notGitReason:
    "Devin is an AI-agent telemetry provider — no repositories or issues; the PRs its sessions ship live on the git hosts, with matching identities.",
  noIssuesReason:
    "Devin serves enterprise telemetry (sessions, ACU consumption, usage metrics), not an issue tracker — tracker surfaces live on jira./linear.",
  exampleCurl: (baseUrl) => `curl -H 'Authorization: Bearer any-key' "${baseUrl}/v3/enterprise/sessions?first=5"`,
};

const slack: McpProviderDef = {
  id: "slack",
  howTo: (baseUrl) =>
    `Point @slack/web-api (or curl) at ${baseUrl} via the client's slackApiUrl option (paths are /api/<method>, exactly like slack.com/api). Auth is a Bearer bot/user token (xoxb-…/xoxp-… — any value is accepted here). This is the org's team-messaging surface: channels, history, threads, reactions, and the workspace roster — the SAME story the git hosts and trackers tell, discussed. The #incident-bridge channel's burst brackets the real incident issue; #releases announcements cite real tags. Success and failure are BOTH HTTP 200 with an ok boolean — Slack's real error model.`,
  nextSteps: (baseUrl) => [
    `Slack: curl -H 'Authorization: Bearer xoxb-anything' "${baseUrl}/api/conversations.list"`,
    `Slack: curl -H 'Authorization: Bearer xoxb-anything' "${baseUrl}/api/auth.test"`,
  ],
  notGitReason:
    "Slack is a team-messaging provider — no repositories or issues; the PRs and incidents its channels discuss live on the git hosts and trackers, with matching identities.",
  noIssuesReason:
    "Slack serves channels, threads, and messages, not an issue tracker — tracker surfaces live on jira./linear.; the #incident-bridge chatter references the tracker's real incident issues.",
  exampleCurl: (baseUrl) => `curl -H 'Authorization: Bearer xoxb-anything' "${baseUrl}/api/conversations.list"`,
};

const openai: McpProviderDef = {
  id: "openai",
  howTo: (baseUrl) =>
    `Point the official openai SDK (or curl) at ${baseUrl} via the client's baseURL option. Auth is a Bearer admin key (sk-admin-… — any value is accepted here). This is the org's OpenAI platform telemetry: users, projects, admin-key metadata, completions usage, and costs — the codex cohort's usage, reconciling with the git activity on the git hosts.`,
  nextSteps: (baseUrl) => [
    `OpenAI: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/organization/usage/completions?start_time=1777000000&group_by=model"`,
    `OpenAI: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/organization/users"`,
  ],
  notGitReason:
    "OpenAI is an AI-platform telemetry provider — no repositories or issues; the commits its codex cohort produces live on the git hosts, with matching identities.",
  noIssuesReason:
    "OpenAI serves org telemetry (usage, costs, members), not an issue tracker — tracker surfaces live on jira./linear.",
  exampleCurl: (baseUrl) => `curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/organization/users"`,
};

/** The ONE workspace this universe has, as the Codex Analytics API's
 *  `workspace_id` path parameter. Derived from the canonical org id (always
 *  `org-01`), so it is the same UUID on every host and every pin — the value
 *  `workspaceId(reader)` in @sandboxapis/renderer-chatgpt computes, repeated
 *  here because this package ships standalone to npm and must be able to hand
 *  an agent a working curl with no artifact in reach (the snapshotPins
 *  precedent in config.ts). Real admins read it off the ChatGPT admin console;
 *  agents read it here or off the docs page.
 *
 *  EXPORTED so a conformance test can pin it to `workspaceId(reader)` for the
 *  default universe — a duplicated literal that nothing checks is a silent
 *  drift waiting to hand agents a 404 curl. */
export const CODEX_WORKSPACE = "2c9bcd8f-c169-4ce5-a266-c8cba93fbad5";

const chatgpt: McpProviderDef = {
  id: "chatgpt",
  howTo: (baseUrl) =>
    `Point your Codex Enterprise Analytics calls at ${baseUrl} (curl or any HTTP client — the API is documented by an official OpenAPI, not an SDK). Auth is a Bearer workspace Admin key (any value is accepted here). This universe has ONE workspace, ${CODEX_WORKSPACE}; every path is /v1/analytics/codex/workspaces/{workspace_id}/{usage|code_reviews|code_review_responses}, windowed by start_time/end_time in Unix seconds (end_time exclusive). Usage rows are per user by default and workspace-wide with group=workspace. This is the SAME codex cohort the openai host bills: estimated_cost_usd over a window sums to exactly the openai /v1/organization/costs total for it, and code_attribution counts real commits that resolve on the git hosts.`,
  nextSteps: (baseUrl) => [
    `ChatGPT: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/analytics/codex/workspaces/${CODEX_WORKSPACE}/usage?group=workspace&limit=5"`,
    `ChatGPT: curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/analytics/codex/workspaces/${CODEX_WORKSPACE}/usage?limit=5"`,
  ],
  notGitReason:
    "ChatGPT's Codex Analytics is an AI-agent telemetry provider — no repositories or issues; the commits its code attribution counts live on the git hosts, with matching SHAs and identities.",
  noIssuesReason:
    "The Codex Analytics API serves workspace telemetry (usage, code reviews), not an issue tracker — tracker surfaces live on jira./linear.",
  exampleCurl: (baseUrl) =>
    `curl -H 'Authorization: Bearer any-key' "${baseUrl}/v1/analytics/codex/workspaces/${CODEX_WORKSPACE}/usage?group=workspace&limit=5"`,
};

const teams: McpProviderDef = {
  id: "teams",
  howTo: (baseUrl) =>
    `Point @microsoft/microsoft-graph-client (or curl) at ${baseUrl} via the client's baseUrl option — clients target graph.microsoft.com, so graph.sandboxapis.dev is the drop-in prefix (teams.sandboxapis.dev aliases it). Auth is any Bearer token (real Graph wants an Entra JWT; any value passes here, but the header must be present — its absence answers Graph's real 401). This is the Microsoft Teams rendering of the org's team-messaging surface: the SAME channels, threads, and byte-identical message text the Slack host serves, in Graph's dialect — /v1.0/me/joinedTeams → /teams/{id}/channels → channel messages → replies, with OData paging (@odata.nextLink/$skiptoken; channel messages default to 20 per page). Everything in Graph outside the teamwork slice answers a coverage-honest Graph-shaped error.`,
  nextSteps: (baseUrl) => [
    `Teams: curl -H 'Authorization: Bearer any-token' "${baseUrl}/v1.0/me/joinedTeams"`,
    `Teams: curl -H 'Authorization: Bearer any-token' "${baseUrl}/v1.0/users"`,
  ],
  notGitReason:
    "Teams (Microsoft Graph) is a team-messaging provider — no repositories or issues; the PRs and incidents its channels discuss live on the git hosts and trackers, with matching identities.",
  noIssuesReason:
    "The Graph teamwork slice serves teams, channels, and messages, not an issue tracker — tracker surfaces live on jira./linear.; the incident-bridge chatter references the tracker's real incident issues.",
  exampleCurl: (baseUrl) => `curl -H 'Authorization: Bearer any-token' "${baseUrl}/v1.0/me/joinedTeams"`,
};

const sentry: McpProviderDef = {
  id: "sentry",
  howTo: (baseUrl) =>
    `Point a Sentry API client at ${baseUrl} — paths are /api/0/…, exactly like sentry.io. sentry-cli takes --url (or SENTRY_URL); the official sentry-mcp server takes --host / SENTRY_HOST. Auth is a Bearer token (any value is accepted here). This is the org's ERROR TRACKING surface: projects are the services the org deploys, issues are deduplicated error signatures, and an event's stack frames name REAL files at REAL commit shas — take a frame's filename and lineNo here and fetch the same file at the same sha from the git host, and the source lines match. The incident the trackers and chat hosts discuss is the same incident firing here.`,
  nextSteps: (baseUrl, org) => [
    `Sentry: curl -H 'Authorization: Bearer anything' "${baseUrl}/api/0/organizations/${org}/projects/"`,
    `Sentry: curl -H 'Authorization: Bearer anything' "${baseUrl}/api/0/organizations/${org}/issues/<issue_id>/events/latest/"`,
  ],
  notGitReason:
    "Sentry is an error-tracking provider — it lists the repositories linked to the org and the commits a release shipped, but the git objects themselves (trees, blobs, refs) live on the git hosts. A stack frame here names a path and a sha you can fetch there.",
  noIssuesReason:
    "Sentry's 'issues' are deduplicated ERROR SIGNATURES, not tracker tickets — a different grain with a different id space. The tracker issue filed for the same incident lives on jira./linear./gh., and the Sentry issue's assignee is that incident's commander.",
  exampleCurl: (baseUrl, org) => `curl -H 'Authorization: Bearer anything' "${baseUrl}/api/0/organizations/${org}/projects/"`,
};

const pagerduty: McpProviderDef = {
  id: "pagerduty",
  howTo: (baseUrl) =>
    `Point a PagerDuty API client at ${baseUrl} — paths are root-level (/incidents, /services, /oncalls), exactly like api.pagerduty.com, with no version prefix: PagerDuty versions in the Accept header. The official PagerDuty MCP server takes PAGERDUTY_API_HOST; pdpyras takes PDSession(url=...); the Go and Node SDKs take a base-URL option. Auth is 'Authorization: Token token=<key>' (any value is accepted here). This is the org's ON-CALL surface: services are what the org deploys, escalation policies and schedules decide who is woken, and an incident's log entries are the real timeline — alert fired, page sent, page acknowledged, fix resolved. ONE THING TO KNOW: GET /incidents defaults to the last month (PagerDuty's own default) and this universe's incident is older, so pass date_range=all.`,
  nextSteps: (baseUrl) => [
    `PagerDuty: curl -H 'Authorization: Token token=anything' "${baseUrl}/incidents?date_range=all"`,
    `PagerDuty: curl -H 'Authorization: Token token=anything' "${baseUrl}/oncalls"`,
  ],
  notGitReason:
    "PagerDuty is an incident-response provider — it has no repositories, commits or branches at all. The service an incident fires on maps 1:1 to a component on the git hosts, and the pull request that fixed it lives there.",
  noIssuesReason:
    "PagerDuty 'incidents' are pages, not tracker tickets — a different grain with a different id space. The tracker issue filed for the same incident lives on jira./linear./gh., and the person PagerDuty paged is that issue's assignee.",
  exampleCurl: (baseUrl) => `curl -H 'Authorization: Token token=anything' "${baseUrl}/incidents?date_range=all"`,
};

// SALESFORCE AND HUBSPOT SERVE THE CRM. Both launched 2026-09-04 with their
// spec, their classified backlog and a small served surface, and the CRM canon
// they render arrived with hello-14.
//
// NEITHER RENDERER GATES ON ANYTHING LATER, which is what makes these two defs
// simpler than the zendesk/circleci/buildkite/statuspage ones beside them: no
// row here reads the hello-15 … hello-20 canon,
// so every generation from hello-14 on serves this surface in full. Live
// (hello-20 since the 2026-09-14 cutover), the -g12 pins (hello-20), the -g11
// pins (hello-16), the -g10 pins (hello-15) and the -g9 pins (hello-14) all
// answer everything; only the -g8 pins (hello-13) predate the CRM and refuse
// it. Say all of them, because "the newest pin" silently means a different host
// every freeze wave — that phrasing is exactly what left these two strings
// naming -g9 as newest after the -g10 wave landed.
//
// AND NAME LIVE'S GENERATION SEPARATELY FROM THE NEWEST PIN'S, INCLUDING WHEN
// THEY AGREE. They agree today: the -g12 wave of 2026-09-14 froze twenty-one
// pins on hello-20, which is what live rolls. They have agreed before, never
// for long — the gap reopens at the next cutover, and between 2026-09-12 and
// the -g12 wave it was FOUR generations wide, because the 2026-09-11 "skip G12"
// ruling declined a generation at four cutovers in a row before the founder
// reversed it. So a sentence that FUSES the two facts is wrong even now, while
// they happen to name the same template: it will be stale the day live moves,
// and nothing in the build can tell that it has.
//
// An agent that points a client here and gets a 404 on /crm/v3/objects/contacts
// still has to tell "this snapshot predates the canon" from "not built yet"
// from "broken", and this copy is the only place in the published client that
// can tell it — so each def names the generation and which hosts carry it.

const salesforce: McpProviderDef = {
  id: "salesforce",
  howTo: (baseUrl) =>
    `Point a Salesforce client at ${baseUrl} as its INSTANCE URL — jsforce takes instanceUrl on the Connection constructor, simple-salesforce takes instance_url, the sf CLI takes --instance-url. Paths mirror an org exactly: /services/data for the version list, /services/data/v67.0/... for everything else. Any access token, or none, is accepted. WHAT IS SERVED, exactly four operations: GET /services/data (37 versions, a verbatim capture of a real org's response); GET /services/data/v67.0/sobjects/{obj}/describe; GET /services/data/v67.0/sobjects/{obj}/{id}; and GET /services/data/v67.0/query?q=<SOQL> — over FOUR objects only: Account, Contact, Opportunity, Case. THE SOQL IS A BOUNDED SUBSET: SELECT (and COUNT()), FROM, WHERE with AND/OR/NOT/parens/IN/LIKE, ORDER BY with NULLS placement, LIMIT and OFFSET. Anything else — a relationship subquery, a parent field path like Account.Name, GROUP BY, SUM(), FIELDS(ALL), WITH SECURITY_ENFORCED, a week-based date literal — answers 400 NAMING the construct, never a wrong answer and never a silently-ignored clause. Everything outside those four operations (describeGlobal, /queryAll, list views, search, limits, analytics, bulk) answers Salesforce's own 404 with an x-sandboxapis-coverage header, meaning NOT BUILT YET rather than broken — deliberately not an empty result set, which would be a lie you could not detect. ONE THING TO KNOW ABOUT PINS: the CRM ships with generation hello-14, and every generation after it inherits it. Live rides hello-20. The newest pin, sf-v67-g12, rides hello-20 — the SAME generation live rides, as of the 2026-09-14 freeze — and sf-v67-g11 rides hello-16, sf-v67-g10 hello-15, sf-v67-g9 hello-14. All four operations answer on all five of those. Only sf-v67-g8 is older — it rides hello-13, which predates the CRM, so there the three CRM operations answer a 404 that says so in words while /services/data keeps working. Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/salesforce for what has landed since.`,
  nextSteps: (baseUrl) => [
    `Salesforce: curl "${baseUrl}/services/data/v67.0/sobjects/Account/describe"  # the served field list — read it before building a SELECT`,
    `Salesforce: curl "${baseUrl}/services/data/v67.0/query?q=SELECT+Id,Name,Industry+FROM+Account+ORDER+BY+Name"`,
    `Salesforce: curl "${baseUrl}/services/data/v67.0/query?q=SELECT+COUNT()+FROM+Case+WHERE+Priority+=+'High'"`,
  ],
  notGitReason:
    "Salesforce is a CRM — it has no repositories, commits or branches. The engineering side of this org's story lives on the git hosts (gh., gl., bb., ado.), and the two meet in real data: a Case here names the same incident PagerDuty paged for, and the engineer it was escalated to is a member of the org the git hosts serve.",
  noIssuesReason:
    "Salesforce Cases are support tickets, not tracker issues — a different grain with a different id space, and both are served. Query Cases here; the engineering issue for the same problem lives on jira./linear./gh. The tickets customers filed during the outage carry the same incident id Sentry and PagerDuty serve, so the two grains are joinable rather than parallel.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/services/data/v67.0/query?q=SELECT+Id,Name+FROM+Account+LIMIT+5"`,
};

const hubspot: McpProviderDef = {
  id: "hubspot",
  howTo: (baseUrl) =>
    `Point a HubSpot client at ${baseUrl} — @hubspot/api-client takes basePath on the Client constructor, and every SDK takes a base URL; it replaces https://api.hubapi.com. Paths mirror HubSpot exactly. Any token, or none, is accepted. WHAT IS SERVED: companies, contacts, deals (written /crm/v3/objects/0-3, the spelling HubSpot's own document uses) and tickets, each with its collection, its get-by-id, its POST .../search and its POST .../batch/read, with paging.next.after cursors, ?properties=, ?propertiesWithHistory= and ?associations=; plus the property catalogue and its groups under /crm/v3/properties/, both pipelines and their stages under /crm/v3/pipelines/, the owner roster at /crm/v3/owners, and the custom-object schema list. READ THIS BEFORE YOU START: the CRM data itself arrives in generation hello-14, and every generation after it inherits it. Live rides hello-20. The newest pin, hubspot-v3-g12, rides hello-20 — the SAME generation live rides, as of the 2026-09-14 freeze — and hubspot-v3-g11 rides hello-16, hubspot-v3-g10 hello-15, hubspot-v3-g9 hello-14. All five of those carry the CRM. Only hubspot-v3-g8 is older — it rides hello-13 and answers those rows with a 404 whose message says exactly that ("This universe predates the CRM canon..."). It is NOT an empty list, deliberately: an empty collection would tell you this org has no contacts, which is false and which no SDK could detect. Two more 404s to tell apart — a path outside coverage carries x-sandboxapis-coverage-kind: endpoint, and a record that simply does not exist carries no coverage header at all. Values in enumerated properties are this portal's own vocabulary; read /crm/v3/properties/{objectType} to learn it, exactly as you would against a real HubSpot portal. Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/hubspot for the row-by-row coverage.`,
  nextSteps: (baseUrl) => [
    `HubSpot: curl "${baseUrl}/crm/v3/objects/companies?limit=5&associations=contacts,deals,tickets"`,
    `HubSpot: curl "${baseUrl}/crm/v3/properties/tickets"  # the vocabulary every ticket property uses`,
    `HubSpot: curl -X POST "${baseUrl}/crm/v3/objects/0-3/search" -H 'content-type: application/json' -d '{"filterGroups":[{"filters":[{"propertyName":"dealstage","operator":"EQ","value":"closed-lost"}]}]}'`,
  ],
  notGitReason:
    "HubSpot is a CRM — it has no repositories, commits or branches. The engineering side of this org's story lives on the git hosts (gh., gl., bb., ado.).",
  noIssuesReason:
    "HubSpot tickets are support tickets, not tracker issues — a different grain with a different id space. Read them at /crm/v3/objects/tickets; the engineering issue for the same problem lives on jira./linear./gh., and during the outage window the two are about the same failure.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/crm/v3/objects/companies?limit=5"`,
};


const zendesk: McpProviderDef = {
  id: "zendesk",
  howTo: (baseUrl) =>
    `Point a Zendesk Support client at ${baseUrl} — paths are /api/v2/… exactly as on a real <subdomain>.zendesk.com, and the .json suffix Zendesk's own clients append is accepted too. node-zendesk takes endpointUri; zenpy takes url=; the Ruby client takes config.url. Auth is HTTP Basic (any value is accepted here). READ THIS BEFORE YOU PLAN A WALK: this host's surface arrived across TWO generations, so which host you point at decides what answers. The TICKET QUEUE — tickets with their comments, audits and metrics, the one user space (agents/admins and end users, told apart by 'role'), organizations, groups and memberships, requests, satisfaction ratings, tags, search and the incremental exports — ships with hello-14. The DESK CONFIGURATION — macros, views, triggers with revision history, automations, SLA policies, brands, ticket fields and forms, the suspended queue and its skips, saved searches, email notifications, attachments, job statuses and the admin audit_logs — ships with hello-15. The LIVE host rides hello-20, which inherits both, and answers all of it — and so does the newest pin, zendesk-v2-g12, frozen on hello-20 — the SAME generation live rides, as of the 2026-09-14 freeze. The zendesk-v2-g11 pin rides hello-16 and the zendesk-v2-g10 pin hello-15, and both answer all of it as well. The zendesk-v2-g9 pin rides hello-14: the queue answers, the configuration rows answer a 404 naming hello-15. The zendesk-v2-g8 pin rides hello-13, older than the desk itself: every desk endpoint answers a 404 naming hello-14 and the locale endpoints keep working. Never an empty array pretending the org has no desk, on any of those six. A pin never gains a later generation — its bytes never move. WHAT IS UNCOVERED ON EVERY GENERATION: the add-on surfaces — custom objects, skill-based routing, IT asset management, task lists, dynamic content, targets and the sharing agreements — each answering an explicit coverage 404. When the desk answers: both pagination grammars work and you get the one you ask for ('page'+'per_page' for the offset envelope, 'page[size]'+'page[after]' for the cursor one). Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/zendesk for the row-by-row picture.`,
  nextSteps: (baseUrl) => [
    `Zendesk: curl "${baseUrl}/api/v2/locales.json"`,
    `Zendesk: curl "${baseUrl}/api/v2/locales/current.json"`,
    `Zendesk (the queue; needs hello-14 — a 404 naming that generation means the snapshot is older): curl "${baseUrl}/api/v2/tickets.json?per_page=5"`,
    `Zendesk (the rules that route it; needs hello-15 or later — live and the zendesk-v2-g12, zendesk-v2-g11 and zendesk-v2-g10 pins, not the older ones): curl "${baseUrl}/api/v2/macros.json"`,
  ],
  notGitReason:
    "Zendesk is a customer-support desk — it has no repositories, commits or branches. The engineering work behind a support escalation lives on the git hosts, and the ticket that asked for it lives here.",
  noIssuesReason:
    "Zendesk 'tickets' are support conversations with an end user, not tracker issues — a different grain, a different id space and a different audience. Both are rendered, and the join between them is real: GET /api/v2/tickets/{id}/related carries jira_issue_ids, which is the tracker row jira./linear./gh. serve for the same escalation. (The Zendesk half needs generation hello-14; on an older snapshot it answers a 404 that says so.)",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/api/v2/locales.json"`,
};

const circleci: McpProviderDef = {
  id: "circleci",
  howTo: (baseUrl) =>
    `Point a CircleCI client at ${baseUrl} — paths are /api/v2/… exactly as on circleci.com, and both spellings of a project slug work (gh/olympus-labs/<repo> and the URL-escaped gh%2Folympus-labs%2F<repo>). mcp-server-circleci takes CIRCLECI_BASE_URL; the circleci CLI takes --host; anything else takes a base URL. Auth is a Circle-Token header or a bearer token, and any value — or none — is accepted here. WHAT IS RENDERED: the CI story the universe already tells. A PIPELINE is one commit that CI ran on, its WORKFLOWS are the runs on that commit ("ci", "lint", "release") and its JOBS are their jobs — the same runs, the same shas and the same people that gh./gl./bb./dev.azure hosts serve for the identical commit, which is the point of reading it here. Also served: /me and /user/{id} over the org roster, /organization/{org-slug-or-id}, /project/{project-slug} over the canonical repositories, and the ACCOUNT CONFIGURATION around a build — contexts and their restrictions, project environment variables, pipeline definitions, triggers and the outbound webhook. WHAT IS NOT: there is no build LOG on this host, because CircleCI API v2 declares no log endpoint at all — read the same job's output on gh./gl./bb./ado. instead. The aggregate insights summaries and time-series, and the whole deploy/rollback family, answer an explicit coverage 404; a usage-export job by id answers CircleCI's own 404 with an x-sandboxapis-refusal header, because the job is created by a POST this universe refuses and no such id can exist. ONE GENERATION NOTE: schedules, test results and flaky tests, checkout keys, project settings, OIDC claims, identity groups, the OTLP exporter, the URL orb source, config policies with their decision log, and /me/collaborations all read the CI configuration canon, which ships with generation hello-15. Live rides hello-20, which inherits it, and answers them; so do the circleci-v2-g12 pin on hello-20 (the SAME generation live rides, as of the 2026-09-14 freeze), the circleci-v2-g11 pin on hello-16 and the circleci-v2-g10 pin on hello-15 itself; every pin registered before that generation answers a 404 naming it, never an empty collection, and never gains it later because a pin's bytes do not move. Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/circleci for the row-by-row picture.`,
  nextSteps: (baseUrl) => [
    `CircleCI: curl "${baseUrl}/api/v2/me"`,
    `CircleCI: curl "${baseUrl}/api/v2/project/gh/olympus-labs/parthenon/pipeline"`,
    `CircleCI (take a pipeline id from the list above): curl "${baseUrl}/api/v2/pipeline/<id>/workflow"`,
  ],
  notGitReason:
    "CircleCI is a CI service, not a git host — it builds repositories that live somewhere else. Every project here names its repository on gh.sandboxapis.dev, and a pipeline's vcs.revision is the real sha you can fetch there.",
  noIssuesReason:
    "CircleCI has no issue surface at all: a failing job is a build result, not a tracked issue. The issue opened about a red build lives on jira., linear. or gh., and the commit it names is the one this host's pipeline ran.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/api/v2/me"`,
};

const buildkite: McpProviderDef = {
  id: "buildkite",
  howTo: (baseUrl) =>
    `Point a Buildkite client at ${baseUrl} — paths are /v2/… exactly as on api.buildkite.com. go-buildkite takes WithBaseURL; pybuildkite takes base_url; the bk CLI reads BUILDKITE_REST_API_ENDPOINT. Auth is 'Authorization: Bearer <anything>', and no token at all works too. WHAT IS RENDERED: the CI walk, end to end — the organization, its pipelines (one per repository CI workflow), each pipeline's builds, each build's jobs, and each job's LOG OUTPUT with the real command output, exit code and per-line timestamps. The builds are the SAME runs gl./bb./ado. serve for the same commits, at the same SHAs, by the same people — a build here and a pipeline run there are one run in two dialects. ALSO SERVED, AS HONEST EMPTY LISTS: the organization's agent list and the build/job annotation lists. Buildkite returns only CONNECTED AND STOPPING agents and no build here is in flight — every one has finished — so [] is the true answer rather than a gap; an annotation is uploaded by 'buildkite-agent annotate' from inside a job, and no job in this universe ran it. Those are 200s with an empty array, never 404s. WHAT IS NOT: the custom emoji catalogue, because Buildkite publishes it in a repository that carries no licence of any kind — there is no grant to republish it, and serving the handful of entries the docs quote would misstate how complete it is. It answers an explicit coverage 404 rather than an invented value. The whole of cluster, queue, schedule, template, trigger, portal and rule administration is uncovered and says so. TWO GENERATION NOTES: job logs need universe generation hello-13 or later, and ARTIFACTS — metadata, content and download — need hello-15, the generation that gave the canonical build artifact the job link a Buildkite artifact's job_id hangs off. Live rides hello-20, which inherits it, and so do the buildkite-v2-g12 pin on hello-20 (the SAME generation live rides, as of the 2026-09-14 freeze), the buildkite-v2-g11 pin on hello-16 and the buildkite-v2-g10 pin on hello-15 itself. On an older snapshot each answers a 404 that names the generation and the rest of the walk still serves. Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/buildkite for the row-by-row picture.`,
  nextSteps: (baseUrl) => [
    `Buildkite: curl "${baseUrl}/v2/organizations"`,
    `Buildkite: curl "${baseUrl}/v2/organizations/olympus-labs/pipelines"`,
    `Buildkite: curl "${baseUrl}/v2/organizations/olympus-labs/builds?per_page=5"`,
    `Buildkite (the log, which is the point): follow a build's jobs[].log_url, or append .txt to it for the raw output`,
  ],
  notGitReason:
    "Buildkite is a CI/CD platform — it builds repositories, it does not host them. Every pipeline here names the repository it builds, and that repository is a real, browsable one on gh./gl./bb./ado.; a build's `commit` is the same 40-character SHA those hosts serve.",
  noIssuesReason:
    "Buildkite has no issue tracker. A red build in this universe belongs to a story that continues elsewhere: the commit it built is on the git hosts, the incident it caused is on sentry./pd., and the issue that tracks the fix is on jira./linear./gh.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/v2/organizations/olympus-labs/pipelines"`,
};

const statuspage: McpProviderDef = {
  id: "statuspage",
  howTo: (baseUrl) =>
    `Point a Statuspage client at ${baseUrl} — paths are /v1/… exactly as on api.statuspage.io, so a caller keeps writing /v1/pages/{page_id}/incidents unchanged. Auth is 'Authorization: OAuth <anything>' (the prefix is OAuth, NOT Bearer — that is Statuspage's own scheme), and no token at all works too; the ?api_key= query param the docs describe is accepted as well. A .json suffix on any path is tolerated, as the real API's own examples use. WHAT IS RENDERED: the customer-facing status story, end to end — the org's two status pages (one public, one partner-only), the components each page publishes, every incident and scheduled maintenance posted to them, each incident's full update cadence (investigating -> identified -> monitoring -> resolved) with per-component old_status/new_status transitions, the published postmortems, and the page's subscribers with their counts and by-state histogram. THE INCIDENTS ARE THE SAME OUTAGES sentry./pd. serve the responder-facing half of: one canonical incident, the same timestamps, the same affected services — a Statuspage incident and a PagerDuty status-page post are one event in two dialects. Component status is LIVE and derived from the incident record: a component reads degraded_performance or major_outage only while a post that impacts it is still open. WHAT IS NOT: component groups, metrics and metrics providers, uptime calculations, page access users and groups, incident templates and the status embed config — this universe carries no canonical fact behind any of them, so each answers an explicit coverage 404 rather than an invented value or an empty list that would assert the fact is absent rather than unmodelled. ONE GENERATION NOTE: the unsubscribed roster IS served, and it needs generation hello-15 — the generation that gave this universe a subscription state meaning "unsubscribed" at all. Live rides hello-20, which inherits it, and answers it; so do the statuspage-v1-g12 pin on hello-20 (the SAME generation live rides, as of the 2026-09-14 freeze), the statuspage-v1-g11 pin on hello-16 and the statuspage-v1-g10 pin on hello-15 itself; a pin frozen earlier answers a 404 naming the generation rather than an empty list that would read as "nobody ever unsubscribed". Check ${baseUrl.replace(/^https:\/\/[^/]+/, "https://sandboxapis.dev")}/providers/statuspage for the row-by-row picture.`,
  nextSteps: (baseUrl) => [
    `Statuspage: curl "${baseUrl}/v1/pages"`,
    `Statuspage (take a page id from that): curl "${baseUrl}/v1/pages/<page_id>/components"`,
    `Statuspage: curl "${baseUrl}/v1/pages/<page_id>/incidents"`,
    `Statuspage (the cross-host walk): the same incident is on pd. as a status-page post and on sentry. as the error that opened it`,
  ],
  notGitReason:
    "Statuspage is a status-communication tool — it publishes what customers are told about an outage, and hosts no code. The incident behind a post is on sentry./pd.; the commit that caused it, and the one that fixed it, are on gh./gl./bb./ado. at the same SHAs.",
  noIssuesReason:
    "Statuspage has no issue tracker. A post here is the CUSTOMER-FACING half of a story tracked elsewhere: the responder's incident is on pd., the error is on sentry., and the follow-up issue is on jira./linear./gh.",
  exampleCurl: (baseUrl) => `curl "${baseUrl}/v1/pages"`,
};

// Order mirrors PROVIDER_IDS exactly — circleci before zendesk before gitlab,
// salesforce, hubspot, buildkite and statuspage appended; see provider-ids.ts.
export const MCP_PROVIDERS: readonly McpProviderDef[] = [github, slack, sentry, circleci, zendesk, gitlab, bitbucket, ado, jira, linear, anthropic, cursor, devin, openai, chatgpt, teams, pagerduty, salesforce, hubspot, buildkite, statuspage];

export const mcpProviderById: Record<Provider, McpProviderDef> = Object.fromEntries(
  MCP_PROVIDERS.map((d) => [d.id, d]),
) as Record<Provider, McpProviderDef>;
