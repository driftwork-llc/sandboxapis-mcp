// Service-level facts the MCP server hands agents so they can orient without
// docs: which universe/theme/providers exist, the base URLs to point clients at,
// and where the coverage manifest lives. Overridable (tests point at localhost;
// self-hosted deployments point at their own hosts).

import type { Provider } from "./provider-ids.js";

export interface ProviderConfig {
  /** Base URL an agent points its provider client at (a bare env-var swap). */
  baseUrl: string;
}

/** A pinned, reproducible universe and the provider it renders.
 *  `generation` is OUR universe generation, orthogonal to the provider API
 *  version in the pin name (DECISIONS 2026-08-13): generation 2 (`-g2`) serves
 *  repository FILES; generation 1 predates the file model. The two are
 *  DIFFERENT universes — templateVersion seeds the PRNG — so an agent must
 *  never swap a suffix expecting the same issue keys or SHAs. */
export interface SnapshotPin {
  pin: string;
  provider: Provider;
  /** Generation 4 is retained in the union but currently has NO pins: it was
   *  retired unfrozen on 2026-08-18 when devin-v3 moved to generation 5.
   *  Generations are never renumbered, so the value stays reserved.
   *  Generation 6 (hello-11) is the MESSAGING generation — the first whose
   *  pins can serve the Slack surface. Generation 7 (hello-12) adds the
   *  INCIDENT canon; generation 8 (hello-13) adds the ops-detail wave on top
   *  of it. Generation 9 (hello-14) adds the CRM/GTM domain — companies,
   *  contacts, the go-to-market roster, opportunities/deals and the support
   *  desk. Generation 10 (hello-15) adds the CI configuration domain, the
   *  support desk's business rules and its administrative audit, container
   *  avatars, content reactions, status-page subscription states and the two
   *  founding orders; the LIVE hosts rolled it from the 2026-09-08 cutover
   *  until 2026-09-09. Generation 11 (hello-16): memberships with
   *  their invitations and the role catalog, credentials, the portfolio's epic
   *  depth with MR milestones and issue parent links, the subgroup and its
   *  group-level planning, sixteen vendor reference catalogs and the repository
   *  LICENSE blob. It closed the post-cutover gap the same day it opened,
   *  exactly as generation 10 closed hello-15's.
   *
   *  Generation 12 (hello-20) is the NEWEST, and the one the LIVE hosts roll.
   *  It skips four template versions rather than one, because four cutovers ran
   *  while no generation was being minted, and it carries all four: hello-17's
   *  caller credentials, epic notes, team-principal grants, CODEOWNERS and
   *  tools/README, the owner's second AI seat, approval rules, the follow graph
   *  and issue links; hello-18's hook subscriptions with their filters and last
   *  delivery, each person's directory identity, saved queries with their
   *  clauses, and attachments on more parents; hello-19's named settings and
   *  credentials this organization hands its pipelines, each masked one a NAME
   *  AND TWO DATES with no value anywhere; and hello-20's thirteen domains at
   *  once — what this organization publishes, a Jira site's default
   *  configuration, the machines its jobs ran on and what it allows its
   *  pipelines to do, a board's columns, four GitLab delivery facts, who
   *  follows what, the money, label and milestone history, Bitbucket's
   *  branching model, the app the CI bot authenticates as, the administrative
   *  trail of the roster itself, and the last entity four small providers
   *  needed.
   *
   *  HOW IT CAME TO SKIP FOUR. The founder ruled on 2026-09-11 to skip
   *  generation 12 until a customer asked, and that ruling declined a
   *  generation at hello-17, at hello-18, at hello-19 and (as ruling F7) at
   *  hello-20 in turn. By the last of those "the newest generation" and "what
   *  live rolls" had been apart for two days and four cutovers, which is the
   *  gap `get_snapshot` hands an agent. The founder reversed the ruling later
   *  on 2026-09-14 so the pinned product matches the live product before
   *  launch, and the -g12 wave closed it. The reversal is scoped to this
   *  generation; hello-17, hello-18 and hello-19 mint none and never will,
   *  because a generation is minted at a cutover or not at all — which is why
   *  this union goes 11 → 12 with no 13 reserved behind it.
   *
   *  THE UNION IS SPELLED OUT rather than typed `number`, so a wave that adds a
   *  generation has to widen it deliberately — which is the one place an author
   *  is made to look at the doc comment above and say what the new generation
   *  carries. */
  generation: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Serves repository file endpoints (contents/readme/trees/blobs, GitLab repository/files). */
  files: boolean;
  /** The PROVIDER API version this pin renders through — the SHAPE half of the
   *  freeze (Phase B). Distinct from `generation`, which is our UNIVERSE
   *  version: generation says which data, this says which dialect of the
   *  provider's API that data is served in. Mirrors what `/v1/snapshots`
   *  reports, so an agent pinning for reproducible CI sees both halves of what
   *  it is holding stable. */
  apiVersion: string;
}

export interface McpConfig {
  /** Universe (org) identity. */
  universe: string;
  theme: string;
  orgLogin: string;
  /** The org's flagship/most-active repo, used as a safe default. */
  flagshipRepo: string;
  providers: Record<Provider, ProviderConfig>;
  /** `{pin}` expands to e.g. `gh-2026-03` → a pinned, reproducible hostname. */
  snapshotHostTemplate: string;
  /** The published default pins, one per provider. Static because pins ARE
   *  static — each is a stable hostname in the docs, and a client that can't
   *  reach the network can still tell an agent how to pin. A wrong pin is
   *  self-correcting: the host 404s with the valid list. */
  snapshotPins: SnapshotPin[];
  coverageUrl: string;
  docsUrl: string;
}

export const DEFAULT_CONFIG: McpConfig = {
  universe: "olympus-labs",
  theme: "greek",
  orgLogin: "olympus-labs",
  flagshipRepo: "parthenon",
  providers: {
    github: { baseUrl: "https://gh.sandboxapis.dev" },
    slack: { baseUrl: "https://slack.sandboxapis.dev" },
    gitlab: { baseUrl: "https://gl.sandboxapis.dev" },
    bitbucket: { baseUrl: "https://bb.sandboxapis.dev" },
    ado: { baseUrl: "https://ado.sandboxapis.dev" },
    jira: { baseUrl: "https://jira.sandboxapis.dev" },
    linear: { baseUrl: "https://linear.sandboxapis.dev" },
    anthropic: { baseUrl: "https://anthropic.sandboxapis.dev" },
    cursor: { baseUrl: "https://cursor.sandboxapis.dev" },
    devin: { baseUrl: "https://devin.sandboxapis.dev" },
    openai: { baseUrl: "https://openai.sandboxapis.dev" },
    chatgpt: { baseUrl: "https://chatgpt.sandboxapis.dev" },
    // graph. is the drop-in-true prefix (clients target graph.microsoft.com);
    // teams.sandboxapis.dev is a legibility ALIAS of the same host.
    teams: { baseUrl: "https://graph.sandboxapis.dev" },
    sentry: { baseUrl: "https://sentry.sandboxapis.dev" },
    pagerduty: { baseUrl: "https://pd.sandboxapis.dev" },
    // sf. is the short prefix; salesforce.sandboxapis.dev is a legibility ALIAS
    // of the same host (the teams/graph precedent). Salesforce clients take a
    // whole instance URL — jsforce's `instanceUrl`, simple_salesforce's
    // `instance_url` — so neither spelling costs a caller anything.
    salesforce: { baseUrl: "https://sf.sandboxapis.dev" },
    // hubspot. is the prefix; hubapi.sandboxapis.dev is the alias that matches
    // what @hubspot/api-client's `basePath` normally points at
    // (https://api.hubapi.com).
    hubspot: { baseUrl: "https://hubspot.sandboxapis.dev" },
    // Buildkite clients take a whole base URL and compose no hostname of their
    // own — go-buildkite's `WithBaseURL`, pybuildkite's `base_url`, the CLI's
    // BUILDKITE_REST_API_ENDPOINT — so the plain `buildkite.` prefix costs a
    // caller nothing and reads better than an `api.` label nothing requires.
    buildkite: { baseUrl: "https://buildkite.sandboxapis.dev" },
    zendesk: { baseUrl: "https://zendesk.sandboxapis.dev" },
    // circleci. with no abbreviation: CircleCI writes no short form of its own
    // name anywhere, and `mcp-server-circleci` takes a whole CIRCLECI_BASE_URL
    // rather than composing one, so no host template constrains the label.
    circleci: { baseUrl: "https://circleci.sandboxapis.dev" },
    // statuspage. with no abbreviation, and no `api.` label: Statuspage clients
    // take a whole base URL (the official statuspage-python/-ruby clients and
    // every community SDK compose nothing), so no host template constrains it.
    // Note the API's own paths carry the `/v1` prefix, so callers point at this
    // host and keep writing `/v1/pages/...` exactly as they do today.
    statuspage: { baseUrl: "https://statuspage.sandboxapis.dev" },
  },
  snapshotHostTemplate: "https://{pin}.snap.sandboxapis.dev",
  // MIRRORS defaultSnapshots() in packages/compiler/src/snapshot.ts — the
  // gateway serves that list at /v1/snapshots, so the two MUST agree or an
  // agent gets a different answer from get_snapshot than from the API.
  //
  // A duplicate registry exists because this package ships standalone to npm
  // (the compiler is a devDependency, importable in tests, never bundled). It
  // HAS drifted: the published 0.1.0 kept recommending the generation-1 pin
  // long after generation 2 shipped, so agents were sent to a universe that
  // honestly 404s every file endpoint. mcp.test.ts now cross-checks this list
  // field by field against defaultSnapshots(), and fails on a missing pin or a
  // wrong apiVersion — verified by deliberately breaking both.
  snapshotPins: [
    { pin: "gh-2026-03", provider: "github", generation: 1, files: false, apiVersion: "2026-03-10" },
    { pin: "gl-v4", provider: "gitlab", generation: 1, files: false, apiVersion: "v4" },
    { pin: "bb-v2", provider: "bitbucket", generation: 1, files: false, apiVersion: "2.0" },
    { pin: "ado-7-1", provider: "ado", generation: 1, files: false, apiVersion: "7.1" },
    { pin: "jira-v3", provider: "jira", generation: 1, files: false, apiVersion: "v3" },
    { pin: "linear-2026-08", provider: "linear", generation: 1, files: false, apiVersion: "unversioned" },
    { pin: "gh-2026-03-g2", provider: "github", generation: 2, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g2", provider: "gitlab", generation: 2, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g2", provider: "bitbucket", generation: 2, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g2", provider: "ado", generation: 2, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g2", provider: "jira", generation: 2, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g2", provider: "linear", generation: 2, files: true, apiVersion: "unversioned" },
    // Anthropic's FIRST pin is generation 3 (hello-5, the AI-telemetry
    // universe — no earlier generation could serve it). Registered unfrozen at
    // Phase 27; its sha freezes with the -g3 wave at M3 close-out.
    { pin: "anthropic-2023-06", provider: "anthropic", generation: 3, files: true, apiVersion: "2023-06-01" },
    // Cursor joins generation 3 at Phase 28, likewise unfrozen until the -g3
    // wave. Dated pin name — Cursor has no API version scheme (the Linear
    // precedent).
    { pin: "cursor-2026-08", provider: "cursor", generation: 3, files: true, apiVersion: "unversioned" },
    // Phase 29: the git/tracker providers' -g3 pins — the AI-telemetry
    // universe's git side, so cross-provider walks (an AI-code commitHash →
    // its commit) stay inside ONE pinned generation.
    { pin: "gh-2026-03-g3", provider: "github", generation: 3, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g3", provider: "gitlab", generation: 3, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g3", provider: "bitbucket", generation: 3, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g3", provider: "ado", generation: 3, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g3", provider: "jira", generation: 3, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g3", provider: "linear", generation: 3, files: true, apiVersion: "unversioned" },
    // Devin's pin opened generation 4 (hello-6) at Phase 30 and was
    // CONSOLIDATED onto generation 5 on 2026-08-18, before any freeze — so
    // devin sessions and codex usage share one universe. Generation 4 has no
    // pins; an agent that saw `generation: 4` from the published 0.2.x should
    // re-read this list rather than assume the data is unchanged (it is a
    // different universe: hello-7 seeds a different PRNG stream).
    { pin: "devin-v3", provider: "devin", generation: 5, files: true, apiVersion: "v3" },
    // OpenAI opens generation 5 (hello-7 — the codex cohort) at Phase 31,
    // unfrozen until the wave freezes.
    { pin: "openai-2020-10", provider: "openai", generation: 5, files: true, apiVersion: "2020-10-01" },
    // The -g5 wave (2026-08-18): the git/tracker twins of generation 5, the
    // -g3 pattern — so a devin/codex row and the commit it names are pinnable
    // in ONE generation.
    { pin: "gh-2026-03-g5", provider: "github", generation: 5, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g5", provider: "gitlab", generation: 5, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g5", provider: "bitbucket", generation: 5, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g5", provider: "ado", generation: 5, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g5", provider: "jira", generation: 5, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g5", provider: "linear", generation: 5, files: true, apiVersion: "unversioned" },
    // ChatGPT (Codex Analytics) joins generation 5 at Phase 32 — the SAME
    // frozen hello-7 bytes the pins above serve, so a Codex usage row here and
    // the openai costs it reconciles with are one universe.
    { pin: "chatgpt-v1", provider: "chatgpt", generation: 5, files: true, apiVersion: "v1" },
    // Slack (M5 Phase 34) OPENS generation 6 — hello-11, the messaging canon:
    // the first generation whose channels/threads/messages exist to serve.
    // FROZEN 2026-08-25 with teams-v1 (DECISIONS [G6]). Slack has no API
    // version scheme, so the pin is dated by derivation month (the Linear
    // precedent).
    { pin: "slack-2026-08", provider: "slack", generation: 6, files: true, apiVersion: "unversioned" },
    // Teams (M5 Phase 35) joins generation 6 on the SAME hello-11 recipe —
    // one artifact, so the two messaging providers' pinned stories are
    // byte-identical. Frozen alongside slack-2026-08. Graph is
    // path-versioned: v1.0, dot dropped from the pin name (DNS-label grammar).
    { pin: "teams-v1", provider: "teams", generation: 6, files: true, apiVersion: "v1.0" },
    // The -g6 CONSOLIDATION wave (2026-08-26): the remaining eleven providers
    // join generation 6, so all THIRTEEN share one universe. This is the pin
    // an agent should now be handed for every provider — hello-11 is the only
    // generation carrying messaging AND git AND trackers AND AI telemetry, so
    // a conversation→issue→PR→SHA walk stays inside ONE pinned universe.
    // FROZEN 2026-08-26 at the same sha slack-2026-08/teams-v1 already held:
    // one artifact under thirteen keys (DECISIONS [G6-consolidation]). This
    // list carries no sha of its own — `/v1/snapshots` is where an agent reads
    // the freeze state; here the pin NAME is the contract.
    { pin: "gh-2026-03-g6", provider: "github", generation: 6, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g6", provider: "gitlab", generation: 6, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g6", provider: "bitbucket", generation: 6, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g6", provider: "ado", generation: 6, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g6", provider: "jira", generation: 6, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g6", provider: "linear", generation: 6, files: true, apiVersion: "unversioned" },
    // anthropic/cursor were TWO generations behind live (hello-5) until this
    // wave — an agent pinning them for CI got a different universe from the
    // one it developed against on the live hosts.
    { pin: "anthropic-2023-06-g6", provider: "anthropic", generation: 6, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g6", provider: "cursor", generation: 6, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g6", provider: "devin", generation: 6, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g6", provider: "openai", generation: 6, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g6", provider: "chatgpt", generation: 6, files: true, apiVersion: "v1" },
    // Sentry (B1.1) OPENS generation 7 — hello-12, the INCIDENT canon: the
    // first generation carrying services, metrics, monitors, alerts, error
    // groups with resolving stack frames, incidents and on-call rotations.
    // No earlier generation could serve an issue's events at all. FROZEN
    // 2026-09-02 with pd-v2 at the shared g7 sha (DECISIONS [G7]); the live
    // recipe cutover to hello-12 — its own step — LANDED 2026-09-01, and live
    // has since rolled on three times, to hello-13 (ops-detail, 2026-09-02),
    // hello-14 (CRM/GTM, 2026-09-04) and hello-15 (canon gaps, 2026-09-08),
    // every one of which INHERITS this canon: the live hosts still serve every
    // incident endpoint, just three generations later than this pin freezes.
    // Sentry path-versions its API at /api/0/ and its spec's info.version is
    // "v0" — the devin/bitbucket precedent for path-versioned APIs.
    { pin: "sentry-v0", provider: "sentry", generation: 7, files: true, apiVersion: "v0" },
    // PagerDuty (B1.2) joins generation 7 — hello-12, the INCIDENT canon, the
    // first generation carrying services, monitors, alerts, incidents, on-call
    // rotations and escalation policies. No earlier generation could serve a
    // single one of this provider's endpoints. FROZEN 2026-09-02 with
    // sentry-v0 at the SAME sha — one artifact, two dialects (DECISIONS [G7]);
    // the live recipe cutover to hello-12 — its own step — LANDED 2026-09-01, and
    // live has since rolled on three times, to hello-13 (ops-detail, 2026-09-02),
    // hello-14 (CRM/GTM, 2026-09-04) and hello-15 (canon gaps, 2026-09-08), every
    // one of which INHERITS this canon: the live hosts still serve every incident
    // endpoint, just three generations later than this pin freezes.
    // PagerDuty versions in the Accept header (`;version=2`), not the path, so
    // the pin name drops to one DNS label the way bitbucket's 2.0 became bb-v2.
    { pin: "pd-v2", provider: "pagerduty", generation: 7, files: true, apiVersion: "2" },
    // The -g8 WAVE (2026-09-03): ALL FIFTEEN providers on hello-13, the
    // flagship universe — the incident canon of generation 7 PLUS the
    // ops-detail wave (job logs with real step output, deleted work items, the
    // ops platform, PagerDuty at Full). This is the pin an agent should be
    // handed for every provider now: it is the SAME generation the live hosts
    // roll, so a story explored live and then pinned for CI is the same story.
    // Registered UNFROZEN (the standing first-registration path) — the sha
    // backfill is its own PR once the avatars wave merges into hello-13. This
    // list carries no sha of its own anyway: `/v1/snapshots` is where an agent
    // reads freeze state; here the pin NAME is the contract.
    { pin: "gh-2026-03-g8", provider: "github", generation: 8, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g8", provider: "gitlab", generation: 8, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g8", provider: "bitbucket", generation: 8, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g8", provider: "ado", generation: 8, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g8", provider: "jira", generation: 8, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g8", provider: "linear", generation: 8, files: true, apiVersion: "unversioned" },
    { pin: "anthropic-2023-06-g8", provider: "anthropic", generation: 8, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g8", provider: "cursor", generation: 8, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g8", provider: "devin", generation: 8, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g8", provider: "openai", generation: 8, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g8", provider: "chatgpt", generation: 8, files: true, apiVersion: "v1" },
    { pin: "slack-2026-08-g8", provider: "slack", generation: 8, files: true, apiVersion: "unversioned" },
    { pin: "teams-v1-g8", provider: "teams", generation: 8, files: true, apiVersion: "v1.0" },
    // sentry/pagerduty stay frozen on generation 7 forever; these are their g8
    // twins, carrying the ops-detail wave their g7 bytes predate.
    { pin: "sentry-v0-g8", provider: "sentry", generation: 8, files: true, apiVersion: "v0" },
    { pin: "pd-v2-g8", provider: "pagerduty", generation: 8, files: true, apiVersion: "2" },
    // The CRM/support wave's FIRST pins, registered UNFROZEN (the standing
    // first-registration path; the sha backfill is `pnpm pins:publish` at the
    // phase close-out). Both ride generation 8 — hello-13 — because that was the
    // generation live rolled when they were registered; neither host reads a CRM
    // entity from it, and that is the point of the wave: the pin exists so a
    // client can target a stable host from day one, and the rows it answers grow
    // when a LATER pin lands rather than the host moving. Since live cut over to
    // hello-14 (2026-09-04) these two pins DIVERGE from their live hosts by the
    // whole CRM domain: live answers 200 with accounts, contacts, opportunities
    // and deals, the pins answer the generation-gap 404. Generation 9 closes it.
    //
    // PIN NAMES ARE ONE DNS LABEL (the bb-2.0 bug, fixed once, never again).
    // Salesforce's version is `67.0`; the dot would fall outside the `*.snap`
    // wildcard certificate, so the pin is `sf-v67` — bitbucket's 2.0 -> bb-v2
    // precedent. HubSpot's version is already the label `v3`.
    { pin: "sf-v67-g8", provider: "salesforce", generation: 8, files: true, apiVersion: "67.0" },
    { pin: "hubspot-v3-g8", provider: "hubspot", generation: 8, files: true, apiVersion: "v3" },
    // Buildkite's first pin. It rides generation 8 (hello-13) DELIBERATELY,
    // and the reason is the job log: JobLog is ops-detail canon, which arrived
    // in hello-13, so generation 8 is the OLDEST generation on which this
    // provider's tier-1 log surface answers at all. Registering it anywhere
    // earlier would have published a pin whose most-wanted endpoint 404s.
    // MIRRORED in defaultSnapshots() (packages/compiler/src/snapshot.ts) — a
    // test cross-checks the two field by field.
    { pin: "buildkite-v2-g8", provider: "buildkite", generation: 8, files: true, apiVersion: "v2" },
    // zendesk's FIRST pin, and it opens on generation 8 rather than opening a
    // generation of its own — the whole surface it serves today (the locale
    // catalog) needs no CRM entity, so it renders from the hello-13 artifact
    // every other -g8 pin already carries. The CRM canon reaches a pin at
    // generation 9; this -g8 pin keeps answering the locale rows unchanged and
    // the gap 404 on the desk, even though the LIVE zendesk. host has served the
    // whole desk since the 2026-09-04 cutover. The generation is never encoded
    // in a promise, only in the pin name.
    { pin: "zendesk-v2-g8", provider: "zendesk", generation: 8, files: true, apiVersion: "v2" },
    // circleci's FIRST pin (B2.1), registered UNFROZEN and freezing at the
    // phase close-out via `pnpm pins:publish`.
    //
    // THE RECIPE IS recipeG8 (hello-13) AND THE CHOICE WAS MADE, not inherited.
    // Two facts decide it. First, `snapshot.test.ts` asserts totality — no
    // provider may be stranded below the current generation — so a first pin on
    // an older recipe would fail the build. Second, and independently, it is
    // the right recipe: everything this renderer reads (repos, commits, pulls,
    // workflows, runs, jobs, people, the org) has been in the artifact since
    // hello-2, so nothing it serves NEEDS hello-13 and nothing it serves is
    // missing from it. There is therefore NO generation gap on this host —
    // every row answers identically on this pin and on live. The one CI surface
    // that would have needed hello-13's JobLog is the build log, and CircleCI
    // API v2 declares no log endpoint at all.
    { pin: "circleci-v2-g8", provider: "circleci", generation: 8, files: true, apiVersion: "v2" },
    // The -g9 WAVE (2026-09-05): ALL TWENTY providers on hello-14 — everything
    // generation 8 carries PLUS the CRM/GTM domain (companies, contacts, the
    // go-to-market roster, opportunities and deals, and the support desk whose
    // ticket spike sits inside the incident window). It was the pin to hand an
    // agent for four days: the newest FROZEN generation, and the live one from
    // 2026-09-04 until the 2026-09-08 cutover to hello-15. From that cutover a
    // story explored live ran ahead of what these pins serve — live answered
    // the CI configuration, the desk's business rules and audit log, container
    // avatars, content reactions and the unsubscribed roster, and a -g9 pin
    // answered the generation-gap 404 on each, naming hello-15. The -g10 wave
    // below closed that, exactly as this wave closed the CRM gap a day after
    // the CRM cutover opened it.
    //
    // WHAT IT FIXES FOR AN AGENT SPECIFICALLY. Until this wave `get_snapshot`
    // handed a caller `sf-v67-g8` / `hubspot-v3-g8` / `zendesk-v2-g8` — pins
    // that answer the generation-gap 404 on every account, deal and ticket,
    // because their canon did not exist in hello-13. An agent that pinned on
    // that advice burned its whole budget on honest 404s, which is precisely
    // the failure the stale-0.1.0 incident above taught. The `-g9` twins serve
    // those rows.
    //
    // Registered UNFROZEN (the standing first-registration path) — the sha
    // backfill is `pnpm pins:publish` at close-out. This list carries no sha of
    // its own anyway: `/v1/snapshots` is where an agent reads freeze state;
    // here the pin NAME is the contract.
    //
    // MIRRORED in defaultSnapshots() (packages/compiler/src/snapshot.ts) — a
    // test cross-checks the two field by field.
    { pin: "gh-2026-03-g9", provider: "github", generation: 9, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g9", provider: "gitlab", generation: 9, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g9", provider: "bitbucket", generation: 9, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g9", provider: "ado", generation: 9, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g9", provider: "jira", generation: 9, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g9", provider: "linear", generation: 9, files: true, apiVersion: "unversioned" },
    { pin: "anthropic-2023-06-g9", provider: "anthropic", generation: 9, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g9", provider: "cursor", generation: 9, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g9", provider: "devin", generation: 9, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g9", provider: "openai", generation: 9, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g9", provider: "chatgpt", generation: 9, files: true, apiVersion: "v1" },
    { pin: "slack-2026-08-g9", provider: "slack", generation: 9, files: true, apiVersion: "unversioned" },
    { pin: "teams-v1-g9", provider: "teams", generation: 9, files: true, apiVersion: "v1.0" },
    { pin: "sentry-v0-g9", provider: "sentry", generation: 9, files: true, apiVersion: "v0" },
    { pin: "pd-v2-g9", provider: "pagerduty", generation: 9, files: true, apiVersion: "2" },
    // The three the wave exists for: the first pins on which a Salesforce
    // account, a HubSpot deal and a Zendesk ticket resolve at all.
    { pin: "sf-v67-g9", provider: "salesforce", generation: 9, files: true, apiVersion: "67.0" },
    { pin: "hubspot-v3-g9", provider: "hubspot", generation: 9, files: true, apiVersion: "v3" },
    { pin: "zendesk-v2-g9", provider: "zendesk", generation: 9, files: true, apiVersion: "v2" },
    // The CI/CD lane. Neither reads CRM canon, so these serve the same rows
    // their -g8 twins do — they are here so no provider is stranded a
    // generation behind, which is what keeps "ask for the current pin" a
    // question with one answer per provider.
    { pin: "circleci-v2-g9", provider: "circleci", generation: 9, files: true, apiVersion: "v2" },
    { pin: "buildkite-v2-g9", provider: "buildkite", generation: 9, files: true, apiVersion: "v2" },
    // statuspage's FIRST pin, registered UNFROZEN and freezing at the phase
    // close-out via `pnpm pins:publish`.
    //
    // IT OPENS AT GENERATION 9, AND EVERYTHING IT SERVES PREDATES THAT
    // GENERATION — the judgment the #353 precedent asks for, made rather than
    // assumed. The status-page canon (canon/src/ops-platform.ts section 9) is
    // gated by `features.opsPlatform`, which first turns on in
    // HELLO_UNIVERSE_V13 = generation 8; V14 = generation 9 adds `crm` and
    // nothing else. So every row this host serves — pages, components,
    // incidents, updates, postmortems, subscribers — exists identically on
    // hello-13 and hello-14, and this pin serves exactly what a -g8 pin would
    // have. It opens at 9 because that is the current generation and no
    // provider should be stranded a generation behind, not because it needs
    // anything 9 introduced. The one-artifact-many-dialects model at work: this
    // pin and pd-v2-g9 render the SAME canonical incident, one as a PagerDuty
    // post and one as a Statuspage incident.
    { pin: "statuspage-v1-g9", provider: "statuspage", generation: 9, files: true, apiVersion: "v1" },
    // The -g10 WAVE (2026-09-08): ALL TWENTY-ONE providers on hello-15 —
    // everything generation 9 carries PLUS the five canon-gap domains and the
    // two founding orders. It was the pin to hand an agent for a day, on both
    // counts at once: the NEWEST FROZEN generation, and the template LIVE was
    // rolling — until the 2026-09-09 cutover moved live to hello-16 and put a
    // story explored live one generation ahead of these pins again. From that cutover live
    // answers memberships, invitations, the role catalog, credentials, epic
    // depth, MR milestones, issue parent links, the subgroup and its
    // group-level planning, the vendor reference catalogs and the repository
    // LICENSE blob, and a -g10 pin answers the generation-gap 404 on each,
    // naming hello-16. That is the state every cutover opens and the next
    // freeze wave closes: the -g11 wave below closes this one, exactly as this
    // wave closed the canon-gap divergence a day after its own cutover.
    //
    // WHAT IT FIXES FOR AN AGENT SPECIFICALLY, and it is the widest version of
    // this the registry has carried. Between the 2026-09-08 cutover and this
    // wave, `get_snapshot` handed a caller a -g9 pin that answers the
    // generation-gap 404 on FIVE domains its live twin answers 200 on: every
    // CircleCI schedule and test result, every Buildkite artifact's content,
    // every Zendesk macro/view/trigger/automation and every admin audit event,
    // every GitLab award emoji and GitHub reaction, every org/group/project
    // avatar, and every status-page subscription state. An agent that pinned on
    // that advice burned its budget on honest 404s — precisely the failure the
    // stale-0.1.0 incident taught. The `-g10` twins serve those rows.
    //
    // Registered UNFROZEN (the standing first-registration path) — the sha
    // backfill is `pnpm pins:publish` at close-out. This list carries no sha of
    // its own anyway: `/v1/snapshots` is where an agent reads freeze state;
    // here the pin NAME is the contract.
    //
    // MIRRORED in defaultSnapshots() (packages/compiler/src/snapshot.ts) — a
    // test cross-checks the two field by field.
    { pin: "gh-2026-03-g10", provider: "github", generation: 10, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g10", provider: "gitlab", generation: 10, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g10", provider: "bitbucket", generation: 10, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g10", provider: "ado", generation: 10, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g10", provider: "jira", generation: 10, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g10", provider: "linear", generation: 10, files: true, apiVersion: "unversioned" },
    { pin: "anthropic-2023-06-g10", provider: "anthropic", generation: 10, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g10", provider: "cursor", generation: 10, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g10", provider: "devin", generation: 10, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g10", provider: "openai", generation: 10, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g10", provider: "chatgpt", generation: 10, files: true, apiVersion: "v1" },
    { pin: "slack-2026-08-g10", provider: "slack", generation: 10, files: true, apiVersion: "unversioned" },
    { pin: "teams-v1-g10", provider: "teams", generation: 10, files: true, apiVersion: "v1.0" },
    // The incident pair: no hello-15 domain to gain, so these serve the rows
    // their -g9 twins do. They are here for totality, which is not a formality
    // — a provider without a pin on the newest generation is invisible to an
    // agent asking for "the current one" and strands a cross-provider walk the
    // moment it crosses that host.
    { pin: "sentry-v0-g10", provider: "sentry", generation: 10, files: true, apiVersion: "v0" },
    { pin: "pd-v2-g10", provider: "pagerduty", generation: 10, files: true, apiVersion: "2" },
    // The CRM trio. Salesforce and HubSpot gain no new SURFACE here, but
    // `crmFounding` re-bases the CRM's whole pre-history inside the org's own
    // lifetime, so an account's created date is not what the -g9 pin froze.
    // Zendesk is the sharpest gain in the wave: the desk's entire business-rule
    // and audit surface — macros, views, triggers, automations, the suspended
    // queue, saved searches, attachments, bulk jobs, the help centre — exists
    // only from hello-15 and answers the gap 404 on every earlier pin.
    { pin: "sf-v67-g10", provider: "salesforce", generation: 10, files: true, apiVersion: "67.0" },
    { pin: "hubspot-v3-g10", provider: "hubspot", generation: 10, files: true, apiVersion: "v3" },
    { pin: "zendesk-v2-g10", provider: "zendesk", generation: 10, files: true, apiVersion: "v2" },
    // The CI/CD lane, and the other half of what this generation was cut for:
    // `ciConfig` is hello-15 canon, so schedules, test results, checkout keys,
    // project settings, OIDC claims, identity groups and Buildkite artifact
    // CONTENT resolve on these pins and on no earlier one.
    { pin: "circleci-v2-g10", provider: "circleci", generation: 10, files: true, apiVersion: "v2" },
    { pin: "buildkite-v2-g10", provider: "buildkite", generation: 10, files: true, apiVersion: "v2" },
    // statuspage's SECOND pin, and its first that is not incidental to the
    // generation it rides: `subscriptionStates` is hello-15 canon, so
    // post-scoped subscriptions and the `unsubscribed` roster resolve here and
    // answer the generation-gap 404 on `statuspage-v1-g9`.
    { pin: "statuspage-v1-g10", provider: "statuspage", generation: 10, files: true, apiVersion: "v1" },
    // The -g11 WAVE (2026-09-09): ALL TWENTY-ONE providers on hello-16 —
    // everything generation 10 carries PLUS the six access-and-reference
    // domains (memberships with invitations and the role catalog; credentials;
    // the portfolio's epic depth, MR milestones and issue parent links; the
    // subgroup and its group-level planning; sixteen vendor reference catalogs;
    // the repository LICENSE blob).
    //
    // IT IS NO LONGER THE PIN TO HAND AN AGENT — the -g12 wave below is. What
    // it fixed remains true and is worth keeping: between the 2026-09-09
    // cutover and this wave, `get_snapshot` handed a caller a -g10 pin that
    // answered the generation-gap 404 on SIX domains its live twin answered 200
    // on, and an agent that pinned on that advice burned its budget on honest
    // 404s. That is the failure the stale-0.1.0 incident taught, and it is the
    // failure the -g12 wave prevents a second time over, four cutovers deep.
    //
    // FROZEN 2026-09-09 at the sha publish run 34391338773 printed for all
    // twenty-one. This list carries no sha of its own: `/v1/snapshots` is where
    // an agent reads freeze state; here the pin NAME is the contract.
    //
    // MIRRORED in defaultSnapshots() (packages/compiler/src/snapshot.ts) — a
    // test cross-checks the two field by field.
    { pin: "gh-2026-03-g11", provider: "github", generation: 11, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g11", provider: "gitlab", generation: 11, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g11", provider: "bitbucket", generation: 11, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g11", provider: "ado", generation: 11, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g11", provider: "jira", generation: 11, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g11", provider: "linear", generation: 11, files: true, apiVersion: "unversioned" },
    { pin: "anthropic-2023-06-g11", provider: "anthropic", generation: 11, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g11", provider: "cursor", generation: 11, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g11", provider: "devin", generation: 11, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g11", provider: "openai", generation: 11, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g11", provider: "chatgpt", generation: 11, files: true, apiVersion: "v1" },
    { pin: "slack-2026-08-g11", provider: "slack", generation: 11, files: true, apiVersion: "unversioned" },
    { pin: "teams-v1-g11", provider: "teams", generation: 11, files: true, apiVersion: "v1.0" },
    // The incident pair: no hello-16 domain to gain, so these serve the rows
    // their -g10 twins do. They are here for totality, which is not a formality
    // — a provider without a pin on the newest generation is invisible to an
    // agent asking for "the current one" and strands a cross-provider walk the
    // moment it crosses that host.
    { pin: "sentry-v0-g11", provider: "sentry", generation: 11, files: true, apiVersion: "v0" },
    { pin: "pd-v2-g11", provider: "pagerduty", generation: 11, files: true, apiVersion: "2" },
    // The CRM trio, on the same totality reading: the access-and-reference wave
    // is a git-host and planning wave and none of the three reads one of its
    // domains. The bytes still differ from their -g10 twins' — a
    // template-version bump re-seeds the root PRNG, so the whole universe is a
    // different roll of the same story.
    { pin: "sf-v67-g11", provider: "salesforce", generation: 11, files: true, apiVersion: "67.0" },
    { pin: "hubspot-v3-g11", provider: "hubspot", generation: 11, files: true, apiVersion: "v3" },
    { pin: "zendesk-v2-g11", provider: "zendesk", generation: 11, files: true, apiVersion: "v2" },
    // The CI/CD lane: `ciConfig` was hello-15's gift and these inherit it;
    // hello-16 opens nothing either renderer reads.
    { pin: "circleci-v2-g11", provider: "circleci", generation: 11, files: true, apiVersion: "v2" },
    { pin: "buildkite-v2-g11", provider: "buildkite", generation: 11, files: true, apiVersion: "v2" },
    // statuspage's THIRD pin. `subscriptionStates` came with hello-15 and rides
    // here unchanged; hello-16 opens no status-page domain.
    { pin: "statuspage-v1-g11", provider: "statuspage", generation: 11, files: true, apiVersion: "v1" },
    // The -g12 WAVE (2026-09-14): ALL TWENTY-ONE providers on hello-20 — and
    // THIS is the pin to hand an agent for every provider now.
    //
    // IT IS TWO FACTS THAT HAPPEN TO AGREE TODAY, and they are said separately
    // because a sentence that fuses them is false by default — the lesson
    // `apps/web/src/app/docs/generation-claims.test.ts` records from the
    // hello-16 cutover, and the lesson the -g11 block above learned the hard
    // way when its own "newest AND live" sentence went stale in three days.
    //
    //   FIRST: generation 12 is the NEWEST REGISTERED generation.
    //   SECOND: hello-20 is ALSO what the LIVE hosts roll, as of the 2026-09-14
    //   cutover.
    //
    // The second fact will stop holding at the next cutover WITHOUT the first
    // changing, exactly as it did on 2026-09-12. When it does, the honest
    // reading is the one this file has had to write four times: the newest pin
    // and live are different universes, and a caller who needs reproducibility
    // should explore on the pin host too.
    //
    // WHY THIS WAVE EXISTS. The founder ruled on 2026-09-11 to skip generation
    // 12 until a customer asked. Three cutovers ran under that ruling —
    // hello-17 and hello-18 on 2026-09-12, hello-19 on 2026-09-13, hello-20 on
    // 2026-09-14 — and by the last of them `get_snapshot` was handing agents a
    // -g11 pin FOUR generations behind live, answering the generation-gap 404
    // on the caller's own credentials, epic notes, team-principal grants,
    // CODEOWNERS, approval rules, the follow graph, issue links, hook
    // subscriptions with their filters and last delivery, directory identities,
    // saved queries, masked pipeline credentials, board columns, GitLab's four
    // delivery facts, Bitbucket's branching model, the CI bot's app identity,
    // the label and milestone history and the roster's own audit trail. The
    // founder reversed the ruling on 2026-09-14 so the pinned product matches
    // the live product before launch. The reversal is scoped to this
    // generation; it does not make "every cutover mints a generation" the rule.
    //
    // FROZEN 2026-09-14 at hello-20's own sha — the same number
    // `live-fingerprints.ts` records for LIVE, which is why this wave
    // registered and froze in one PR rather than two. This list carries no sha
    // of its own: `/v1/snapshots` is where an agent reads freeze state; here the
    // pin NAME is the contract.
    //
    // MIRRORED in defaultSnapshots() (packages/compiler/src/snapshot.ts) — a
    // test cross-checks the two field by field.
    { pin: "gh-2026-03-g12", provider: "github", generation: 12, files: true, apiVersion: "2026-03-10" },
    { pin: "gl-v4-g12", provider: "gitlab", generation: 12, files: true, apiVersion: "v4" },
    { pin: "bb-v2-g12", provider: "bitbucket", generation: 12, files: true, apiVersion: "2.0" },
    { pin: "ado-7-1-g12", provider: "ado", generation: 12, files: true, apiVersion: "7.1" },
    { pin: "jira-v3-g12", provider: "jira", generation: 12, files: true, apiVersion: "v3" },
    { pin: "linear-2026-08-g12", provider: "linear", generation: 12, files: true, apiVersion: "unversioned" },
    { pin: "anthropic-2023-06-g12", provider: "anthropic", generation: 12, files: true, apiVersion: "2023-06-01" },
    { pin: "cursor-2026-08-g12", provider: "cursor", generation: 12, files: true, apiVersion: "unversioned" },
    { pin: "devin-v3-g12", provider: "devin", generation: 12, files: true, apiVersion: "v3" },
    { pin: "openai-2020-10-g12", provider: "openai", generation: 12, files: true, apiVersion: "2020-10-01" },
    { pin: "chatgpt-v1-g12", provider: "chatgpt", generation: 12, files: true, apiVersion: "v1" },
    { pin: "slack-2026-08-g12", provider: "slack", generation: 12, files: true, apiVersion: "unversioned" },
    { pin: "teams-v1-g12", provider: "teams", generation: 12, files: true, apiVersion: "v1.0" },
    { pin: "sentry-v0-g12", provider: "sentry", generation: 12, files: true, apiVersion: "v0" },
    { pin: "pd-v2-g12", provider: "pagerduty", generation: 12, files: true, apiVersion: "2" },
    { pin: "sf-v67-g12", provider: "salesforce", generation: 12, files: true, apiVersion: "67.0" },
    { pin: "hubspot-v3-g12", provider: "hubspot", generation: 12, files: true, apiVersion: "v3" },
    { pin: "zendesk-v2-g12", provider: "zendesk", generation: 12, files: true, apiVersion: "v2" },
    { pin: "circleci-v2-g12", provider: "circleci", generation: 12, files: true, apiVersion: "v2" },
    { pin: "buildkite-v2-g12", provider: "buildkite", generation: 12, files: true, apiVersion: "v2" },
    // statuspage's FOURTH pin.
    { pin: "statuspage-v1-g12", provider: "statuspage", generation: 12, files: true, apiVersion: "v1" },
  ],
  coverageUrl: "https://sandboxapis.dev/coverage",
  docsUrl: "https://sandboxapis.dev/docs",
};

export function resolveConfig(overrides?: Partial<McpConfig>): McpConfig {
  if (!overrides) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    providers: { ...DEFAULT_CONFIG.providers, ...overrides.providers },
  };
}

/** The pinned hostname (with scheme) for a snapshot pin, e.g. gh-2026-03. */
export function snapshotBaseUrl(cfg: McpConfig, pin: string): string {
  return cfg.snapshotHostTemplate.replace("{pin}", pin);
}

// ── The budget an agent is spending ────────────────────────────────────────
//
// MIRRORED, NOT IMPORTED. These two numbers are the gateway's `ANON_LIMIT`
// (packages/gateway/src/ratelimit.ts) and the free tier's hourly rate
// (`LADDER.free.hourly` in packages/gateway/src/ladder.ts, itself mirroring
// `FREE_TIER.rateLimit` in @sandboxapis/control-plane). This package cannot
// import any of them: it is a THIN CLIENT whose published bundle is built from
// `index.ts` + `stdio.ts` alone and must not pull a Hono app, a Supabase client
// or a renderer into the tarball an agent `npx`-es.
//
// So they are restated here with a PARITY TEST, the same trade `ladder.ts`
// itself makes against `tiers.ts`. The test lives in
// `packages/conformance/src/ci/mcp-budget-parity.test.ts` — conformance is the
// only project that depends on both @sandboxapis/mcp and @sandboxapis/gateway,
// so it is the only place the two copies can be compared at all. Edit a number
// in the gateway and that test goes red before an agent is ever told a figure
// the service does not enforce.

/** The anonymous hourly window, shared across every provider host. */
export const ANON_HOURLY_LIMIT = 60;

/** What a free key raises it to. */
export const FREE_HOURLY_LIMIT = 600;

/** Where an unkeyed caller is sent — the same counting route the gateway's
 *  anonymous refusal names, so an agent that follows either arrives in the same
 *  funnel (`?from=` is the funnel key). */
export const UPGRADE_URL_ANONYMOUS = "https://sandboxapis.dev/upgrade?from=anonymous";

/** Where a KEYED caller is sent. Not a `?from=<rung>` route on purpose: this
 *  server never learns which rung its key is on — the gateway only names the
 *  rung when it REFUSES (`x-sandboxapis-tier`) — and guessing one from the
 *  hourly number would be an invented fact, which invariant #4 forbids. The
 *  plans page states every rung honestly instead. */
export const PRICING_URL = "https://sandboxapis.dev/pricing";
