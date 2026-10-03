// What the conformance suites assert about a provider AGAINST OTHER PROVIDERS
// — one entry per provider, each clause traceable to the expectation that
// proves it.
//
// Why this file exists. The catalog page's cross-provider sentence used to be
// keyed by CATEGORY: one sentence per `ProviderCategory`, naming that
// category's other members. That shape cannot state the claim that matters for
// half the catalog, because the interesting parity is rarely inside a
// category. Sentry's is against the git hosts — a stack frame's source context
// is the bytes of that file at that sha on `gh.` PagerDuty's is against the
// chat host — every note it prints is a message `slack.` serves. Copilot,
// Cursor, Devin, OpenAI and Codex Analytics reconcile against GitHub commits
// and pull requests, not against each other's dashboards. Filed by category,
// every one of those pages either said nothing or said something weaker than
// the truth.
//
// THE BAR, and it is not negotiable: every statement below restates an
// assertion that runs in CI. `guardedBy` names the file that runs it, and
// `provider-page.test.ts` fails the build if that file does not exist. No
// clause here may promise something no `expect` checks — a parity claim is a
// coverage claim (invariant #4), and an unfalsifiable one is marketing.
//
// A `Record<Provider, …>`, deliberately: a provider added to `PROVIDER_IDS`
// without a parity entry is a COMPILE error, and the completeness test
// additionally requires the array to be non-empty. A new provider therefore
// cannot ship a catalog page with nothing to say about the rest of the
// universe — it has to earn a cross-provider assertion first.

import type { Provider } from "./provider-ids.js";

/** One checkable cross-provider claim. */
export interface ParityClaim {
  /**
   * The claim, written as what the suite asserts and nothing more. Present
   * tense, concrete fields, no adjectives: "the same 40-character head SHA",
   * not "perfectly consistent data".
   */
  statement: string;
  /**
   * The other providers the statement is asserted against. Never contains the
   * subject itself, and never a provider the named suite does not exercise.
   */
  partners: Provider[];
  /**
   * Path of the suite that asserts it, relative to
   * `packages/conformance/src/`. Checked for existence by the catalog's own
   * test, so a renamed or deleted suite takes the claim off the page with it.
   */
  guardedBy: string;
}

const BRANCH = "parity/branch-parity.test.ts";
const COMMIT_DETAIL = "parity/commit-detail-parity.test.ts";
const MILESTONE = "parity/milestone-parity.test.ts";
const ORG_MEMBER = "parity/org-member-parity.test.ts";
const TRACKER = "parity/tracker-parity.test.ts";
const MESSAGING = "parity/messaging-parity.test.ts";
const M3 = "parity/m3-parity.test.ts";
const INCIDENT = "parity/incident-parity.test.ts";
const FOUR_HOP = "parity/pinned-cross-category.test.ts";
/** The CI walk (B2.1, 2026-09-05): ONE canonical workflow run, rendered as a
 *  GitHub Actions run, a Bitbucket pipeline and a CircleCI workflow, asserted to
 *  be the same build — same SHA, same jobs, same verdicts, same person. A4 adds
 *  GitLab and ADO to the same file rather than opening a second one. */
const CI = "parity/ci-parity.test.ts";
/** The CI/CD lane's LOG suite (the buildkite wave, 2026-09-05): one canonical
 *  run, three dialects (Buildkite build, Bitbucket pipeline, Azure DevOps
 *  build), walked to the same SHA, the same job names and — the assertion the
 *  ops-detail wave exists for, and the one `CI` above cannot make because
 *  CircleCI's API declares no log endpoint — the same log BYTES. */
const CI_LOG = "parity/ci-log-parity.test.ts";
/** The status-page suite (the statuspage wave, 2026-09-06): ONE canonical
 *  published post, rendered as a PagerDuty status-page post and as an Atlassian
 *  Statuspage incident, asserted to be the same publication — the same title,
 *  the same update cadence at the same instants, the same affected services, and
 *  the same postmortem text. It is the sharpest instance of the
 *  one-artifact-many-dialects model in the repository: neither host holds any
 *  canon of its own, and the two vocabularies (post/post_update/page-service vs
 *  incident/incident_update/component) are pure translation. */
const STATUS_PAGE = "parity/status-page-parity.test.ts";
/**
 * The CRM-TO-CRM walk (2026-09-05), which replaced the prep FENCE
 * `parity/crm-prep-parity.test.ts` when the last of the three CRM hosts began
 * serving.
 *
 * It walks ONE customer company across Salesforce (`Account` + SOQL), HubSpot
 * (v3 objects + associations) and Zendesk (`organization` + end users +
 * tickets), found on each host by that host's own search grammar, then
 * field-mapped: the same name, description, domain, address, created instant,
 * contact email set, ticket subjects and arrival instants — and the places
 * where the three products' schemas genuinely differ asserted to differ in a
 * documented way rather than quietly normalised.
 *
 * It also carries the fence's claims forward, restated as what they now are: a
 * property of the PRE-CRM GENERATION (hello-13, the one `sf-v67-g8` and
 * `hubspot-v3-g8` are frozen on), where both hosts must refuse a CRM read with
 * a coverage-pointing 404 rather than an empty collection.
 */
const CRM_CRM = "parity/crm-crm-parity.test.ts";
/** The Salesforce serving wave's walk: one incident, from the pager to the
 *  support queue, across PagerDuty, Salesforce and the git host. */
const CRM_WALK = "parity/crm-parity.test.ts";

/**
 * Every provider's cross-provider claims.
 *
 * Statements are written from the SUBJECT provider's point of view, so the
 * same underlying assertion reads correctly on both pages it appears on
 * rather than being phrased once and rendered backwards on one of them.
 */
export const PROVIDER_PARITY: Record<Provider, ParityClaim[]> = {
  github: [
    {
      statement:
        "Every pull request in the repository has ONE head-branch name: this host's `head.ref` and GraphQL `headRefName`, GitLab's `source_branch` and `sourceBranch`, Bitbucket's `source.branch.name` and Azure DevOps' `refs/heads/…` `sourceRefName` all print the same string, and that string resolves as a real branch",
      partners: ["gitlab", "bitbucket", "ado"],
      guardedBy: BRANCH,
    },
    {
      statement:
        "The engineer a Salesforce Case was escalated to is a member of this organization and fetchable as a user here — the one place this org's go-to-market cast and its engineering roster share a human, which is why the CRM host reports the FACT of an escalation and never invents a custom field naming the person",
      partners: ["salesforce"],
      guardedBy: CRM_WALK,
    },
    {
      statement:
        "For one commit sha, the pull requests it is attributed to, the CI job names and their pass/fail verdicts, and the per-file added/deleted counts are identical to what Bitbucket serves for the same sha",
      partners: ["bitbucket"],
      guardedBy: COMMIT_DETAIL,
    },
    {
      statement:
        "Milestone numbers and their created/updated instants are identical to GitLab's, on the live generation and on the frozen-pin generation both",
      partners: ["gitlab"],
      guardedBy: MILESTONE,
    },
    {
      statement:
        "The organisation was created at ONE instant: `/orgs/{org}`, GitLab's group, Linear's `organization.createdAt` and the Zendesk account's own locale records all return it, and every Linear team carries the same one",
      partners: ["gitlab", "linear", "zendesk"],
      guardedBy: ORG_MEMBER,
    },
    {
      statement:
        "Every identity the AI-telemetry hosts bill for resolves as a user here with the same name; Cursor's reported commit hashes fetch here with the same sha and an author login equal to the reported email's localpart; and a finished Cursor agent's PR URL is a pull request here whose head branch is the branch the agent reported",
      partners: ["anthropic", "cursor", "devin", "openai", "chatgpt"],
      guardedBy: M3,
    },
    {
      statement:
        "The commit a Sentry stack frame resolves against is a commit this host serves, and the source lines Sentry ships in that frame's `context` are the bytes this host returns for that file at that sha",
      partners: ["sentry"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "One incident walked over four hosts — the Slack thread, the Jira and Linear issue, the pull request here and the GitLab merge request — carries the same issue key, the same branch name and the same 40-character head SHA, on the live hosts and on the frozen `-g6` pins",
      partners: ["slack", "jira", "linear", "gitlab"],
      guardedBy: FOUR_HOP,
    },
    {
      statement:
        "The Actions run on a commit is the same build CircleCI reports for that commit: the same head SHA, the same job names with the same pass/fail verdicts, the same head branch, and an `actor.login` equal to the user CircleCI's workflow names as `started_by`",
      partners: ["circleci"],
      guardedBy: CI,
    },
  ],

  gitlab: [
    {
      statement:
        "Every merge request's `source_branch` (and GraphQL `sourceBranch`) is the same string GitHub serves as `head.ref`, Bitbucket as `source.branch.name` and Azure DevOps as `refs/heads/…`, and it resolves as a real branch",
      partners: ["github", "bitbucket", "ado"],
      guardedBy: BRANCH,
    },
    {
      statement:
        "Milestone `iid`s and their created/updated instants are identical to GitHub's milestone numbers and instants, on the live generation and on the frozen-pin generation both",
      partners: ["github"],
      guardedBy: MILESTONE,
    },
    {
      statement:
        "The group's `created_at` is the same instant GitHub's `/orgs/{org}`, Linear's `organization.createdAt` and the Zendesk account's locale records return; every group member's `created_at` is that member's first-seen instant, and never later than a pull request or issue GitHub renders them as authoring",
      partners: ["github", "linear", "zendesk"],
      guardedBy: ORG_MEMBER,
    },
    {
      statement:
        "The merge request at the end of the four-hop walk carries the same `source_branch` and the same 40-character `sha` the GitHub pull request served, for a story that started as a Slack thread and a Jira/Linear issue — on the live hosts and on the frozen `-g6` pins",
      partners: ["slack", "jira", "linear", "github"],
      guardedBy: FOUR_HOP,
    },
  ],

  bitbucket: [
    {
      statement:
        "Every pull request's `source.branch.name` is the same string GitHub serves as `head.ref`, GitLab as `source_branch` and Azure DevOps as `refs/heads/…`",
      partners: ["github", "gitlab", "ado"],
      guardedBy: BRANCH,
    },
    {
      statement:
        "For one commit sha, the pull request ids it is attributed to match GitHub's, each pipeline step matches a GitHub check run by name, `SUCCESSFUL`/`FAILED` matches GitHub's `success`/`failure` per job, and the PR diffstat's per-file added/deleted counts equal GitHub's compare",
      partners: ["github"],
      guardedBy: COMMIT_DETAIL,
    },
    {
      statement:
        "The pipeline that ran on a commit here is the CircleCI pipeline for the same 40-character SHA, and the two hosts name the same jobs with the same verdicts",
      partners: ["circleci"],
      guardedBy: CI,
    },
    {
      statement:
        "A pipeline here and a Buildkite build are the same CI run — the same build number at the same commit SHA — and the step's log is BYTE-IDENTICAL to the job log Buildkite serves for it, because neither host builds the text",
      partners: ["buildkite"],
      guardedBy: CI_LOG,
    },
  ],

  ado: [
    {
      statement:
        "Every pull request's `sourceRefName` is `refs/heads/` plus the exact branch name GitHub serves as `head.ref`, GitLab as `source_branch` and Bitbucket as `source.branch.name`",
      partners: ["github", "gitlab", "bitbucket"],
      guardedBy: BRANCH,
    },
    {
      statement:
        "A Boards work item's revision instants are the same instants Jira records in that issue's changelog, its `Microsoft.VSTS.Scheduling.StoryPoints` is the estimate Jira and Linear serve, and its relations name the pull request Linear reports as that issue's closing branch",
      partners: ["jira", "linear"],
      guardedBy: TRACKER,
    },
    {
      statement:
        "A Build here is the same CI run Buildkite serves as a build: the same `buildNumber`, and a `sourceVersion` that is the same 40-character commit SHA Buildkite reports as that build's `commit`",
      partners: ["buildkite"],
      guardedBy: CI_LOG,
    },
  ],

  jira: [
    {
      statement:
        "The same issue key and summary, the same story-point estimate, the same changelog instants in the same order, and the same comment count and comment instants as Linear serves for that issue; per team, the board's sprint names and start/end dates equal Linear's cycle names and windows, and a sprint's issue keys equal that cycle's",
      partners: ["linear"],
      guardedBy: TRACKER,
    },
    {
      statement:
        "The changelog instants for an issue equal the revision instants Azure Boards serves for the same work item, and `customfield_10016` equals its `StoryPoints`",
      partners: ["ado"],
      guardedBy: TRACKER,
    },
    {
      statement:
        "The issue at hop 2 of the four-hop walk carries the key and summary the Slack thread opened about, the estimate and status Linear serves, and resolution instants that bracket the GitHub pull request's merge — on the live hosts and on the frozen `-g6` pins",
      partners: ["slack", "linear", "github", "gitlab"],
      guardedBy: FOUR_HOP,
    },
  ],

  linear: [
    {
      statement:
        "The same issue identifier and title, the same `estimate`, the same history instants in the same order, and the same comment count and comment instants as Jira serves for that issue; per team, cycle names and `startsAt`/`endsAt` equal the Jira board's sprint names and windows",
      partners: ["jira"],
      guardedBy: TRACKER,
    },
    {
      statement:
        "The history instants for an issue equal the revision instants Azure Boards serves for the same work item, and the `estimate` equals its `StoryPoints`",
      partners: ["ado"],
      guardedBy: TRACKER,
    },
    {
      statement:
        "`issue.branchName` is the head branch of the pull request that closed the issue, it round-trips through `issueVcsBranchSearch`, and GitHub serves a branch under that exact name",
      partners: ["github"],
      guardedBy: BRANCH,
    },
    {
      statement:
        "`organization.createdAt` — and every team's `createdAt` — is the same instant GitHub's `/orgs/{org}`, GitLab's group and the Zendesk account's locale records return",
      partners: ["github", "gitlab", "zendesk"],
      guardedBy: ORG_MEMBER,
    },
    {
      statement:
        "The issue at hop 2 of the four-hop walk carries the same identifier, title, estimate and state Jira serves, and the `branchName` at hop 3 is the head branch of the GitHub pull request and the GitLab merge request — on the live hosts and on the frozen `-g6` pins",
      partners: ["slack", "jira", "github", "gitlab"],
      guardedBy: FOUR_HOP,
    },
  ],

  slack: [
    {
      statement:
        "Every message body, every whole-second timestamp, the whole top-level/reply partition, the per-message reaction sets and the user directory are the same on this host and on Microsoft Graph — each dialect's own documented ordering normalised away first, and the residue asserted identical over full cursor walks, not samples. The channel roster served here is the canonical roster exactly; the Graph team holding that channel contains every one of them",
      partners: ["teams"],
      guardedBy: MESSAGING,
    },
    {
      statement:
        "Every note PagerDuty prints on an incident is a message this host serves in that incident's channel, byte for byte",
      partners: ["pagerduty"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "Hop 1 of the four-hop walk: the incidents channel, its thread opener and every reply are served here, and the burst's timestamps ascend and fall between the Jira issue's creation and its resolution — the same window the GitHub merge lands in",
      partners: ["jira", "linear", "github", "gitlab"],
      guardedBy: FOUR_HOP,
    },
  ],

  teams: [
    {
      statement:
        "Every `body.content`, every `createdDateTime` second, the whole chain/reply partition, the per-message reaction sets and the user directory are the same on this host and on Slack — each dialect's own documented ordering normalised away first, and the residue asserted identical over full `@odata.nextLink` walks, not samples. A team's `/members` contains every member of the Slack channel roster, and any extra holds no channel membership anywhere",
      partners: ["slack"],
      guardedBy: MESSAGING,
    },
  ],

  anthropic: [
    {
      statement:
        "This vendor's seat cohort is disjoint from the GitHub Copilot cohort and from Cursor's, Devin's and OpenAI's — nobody holds two vendors' seats — it equals its own slice of the canonical seat table, and the token totals summed across the paged usage report equal that slice's totals",
      partners: ["github", "cursor", "devin", "openai"],
      guardedBy: M3,
    },
    {
      statement: "Every identity this host bills for resolves as a user on the GitHub host with the same name",
      partners: ["github"],
      guardedBy: M3,
    },
  ],

  cursor: [
    {
      statement:
        "This vendor's team roster is disjoint from the GitHub Copilot cohort and from Anthropic's, Devin's and OpenAI's — nobody holds two vendors' seats — it equals its own slice of the canonical seat table, and the token totals summed across the paged event stream equal that slice's totals",
      partners: ["github", "anthropic", "devin", "openai"],
      guardedBy: M3,
    },
    {
      statement:
        "Every `commitHash` on `/analytics/ai-code/commits` fetches on the GitHub host with the same `sha` and an `author.login` equal to the reported `userEmail`'s localpart, and every FINISHED agent's `target.prUrl` is a GitHub pull request whose `head.ref` is that agent's `target.branchName`",
      partners: ["github"],
      guardedBy: M3,
    },
  ],

  devin: [
    {
      statement:
        "This vendor's user roster is disjoint from the GitHub Copilot cohort and from Anthropic's, Cursor's and OpenAI's — nobody holds two vendors' seats — and equals its own slice of the canonical seat table",
      partners: ["github", "anthropic", "cursor", "openai"],
      guardedBy: M3,
    },
    {
      statement:
        "Every identity this host bills for resolves as a user on the GitHub host with the same name, and the session count here plus Cursor's agents plus GitHub's own agent tasks sum to the whole canonical agent-session table",
      partners: ["github", "cursor"],
      guardedBy: M3,
    },
  ],

  openai: [
    {
      statement:
        "This surface and the Codex Analytics surface serve ONE cohort: the set of `actor.user_id` in Codex usage equals the set of `/v1/organization/users` ids, the emails match per id, and the two hosts' uncached-input and output token totals are equal",
      partners: ["chatgpt"],
      guardedBy: M3,
    },
    {
      statement:
        "This vendor's user roster is disjoint from the GitHub Copilot cohort and from Anthropic's, Cursor's and Devin's — nobody holds two vendors' seats — and the token totals summed across the paged usage endpoint equal its own slice of the canonical seat table",
      partners: ["github", "anthropic", "cursor", "devin"],
      guardedBy: M3,
    },
    {
      statement: "Every identity this host bills for resolves as a user on the GitHub host with the same name",
      partners: ["github"],
      guardedBy: M3,
    },
  ],

  chatgpt: [
    {
      statement:
        "This surface and the OpenAI platform surface serve ONE cohort — one vendor, one set of seats: every usage row's `actor.user_id` is an id `/v1/organization/users` returns, `actor.email` matches that user's email, and the uncached-input and output token totals of the two hosts are equal",
      partners: ["openai"],
      guardedBy: M3,
    },
    {
      statement: "Every identity this host reports usage for resolves as a user on the GitHub host with the same name",
      partners: ["github"],
      guardedBy: M3,
    },
  ],

  sentry: [
    {
      statement:
        "The sha an error group's stack frames resolve against is a commit the GitHub host serves, and the source lines shipped in each frame's `context` are the bytes GitHub returns for that file at that sha — same path, same line numbers, same text",
      partners: ["github"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "The pull request whose merge flips an issue here to `resolved` is merged on the GitHub host at that same merge-commit sha, on the branch the git canon named",
      partners: ["github"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "The issue assigned here and the incident PagerDuty paged for name the same person and the same service; PagerDuty's trigger entry is at or before this host's `lastSeen`, and its resolve entry is after the fix commit",
      partners: ["pagerduty"],
      guardedBy: INCIDENT,
    },
  ],

  zendesk: [
    {
      statement:
        "The support account's own creation instant — the `created_at` on every locale this host serves — is the same instant GitHub's `/orgs/{org}`, GitLab's `/groups/{id}` and Linear's `Organization.createdAt` print, to the second",
      partners: ["github", "gitlab", "linear"],
      guardedBy: ORG_MEMBER,
    },
    {
      statement:
        "An organization here is the Salesforce Account and the HubSpot company of the same name: `domain_names` carries the domain the Account's `Website` spells as a URL, `details` is their description, its end users are exactly the contacts those hosts serve for that account, and its tickets are their Cases and tickets with the same subjects and arrival instants",
      partners: ["salesforce", "hubspot"],
      guardedBy: CRM_CRM,
    },
    {
      statement:
        "This host's organization deliberately carries no industry, revenue, headcount, address or owner and no opportunity object at all — the commercial fields Salesforce and HubSpot serve are absent here rather than invented into `organization_fields`, and a caller who goes looking for a deals endpoint gets a coverage refusal instead of a plausible empty collection",
      partners: ["salesforce", "hubspot"],
      guardedBy: CRM_CRM,
    },
  ],

  circleci: [
    {
      statement:
        "A pipeline's `vcs.revision` is the 40-character SHA of a commit GitHub really serves, and the GitHub Actions run and the Bitbucket pipeline on that same SHA carry the same job names with the same verdicts",
      partners: ["github", "bitbucket"],
      guardedBy: CI,
    },
    {
      statement:
        "A workflow's `started_by` resolves to a user on this host whose login is the actor GitHub names on the Actions run for the same commit, and that person is a fetchable member of the organization there",
      partners: ["github"],
      guardedBy: CI,
    },
    {
      statement:
        "A project's `vcs_info.vcs_url` is byte-identical to the `html_url` GitHub prints for that repository, and both hosts report the same default branch",
      partners: ["github"],
      guardedBy: CI,
    },
  ],

  buildkite: [
    {
      statement:
        "A build here is the same CI run Bitbucket serves as a pipeline and Azure DevOps serves as a build: the same build number, and the same 40-character `commit` SHA — which is a commit the git hosts really have",
      partners: ["bitbucket", "ado"],
      guardedBy: CI_LOG,
    },
    {
      statement:
        "A job's log output is BYTE-IDENTICAL to the same job's step log on Bitbucket — neither host builds the text, both serve the bytes the canon baked — and the `git checkout` line inside it names a commit that really exists at that SHA",
      partners: ["bitbucket"],
      guardedBy: CI_LOG,
    },
  ],

  pagerduty: [
    {
      statement:
        "The incident here and the Sentry issue name the same person and the same service; the trigger log entry is at or before Sentry's `lastSeen` for the error group, and the resolve entry is after the commit that fixed it",
      partners: ["sentry"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "The incident that paged here is the one customers wrote in about: the Salesforce Cases filed during the outage carry this incident's id, none of them was opened before it was, and each resolves to an Account and a Contact the canon names",
      partners: ["salesforce"],
      guardedBy: CRM_WALK,
    },
    {
      statement: "Every note on an incident is a message the Slack host serves in that incident's channel, byte for byte",
      partners: ["slack"],
      guardedBy: INCIDENT,
    },
    {
      statement:
        "A status-page post here and the Statuspage incident for it are one publication in two dialects: the same title, the same number of updates at the same instants with the same text, and the same affected services — a post_update's impacted page-service is the same business service as the incident_update's affected component",
      partners: ["statuspage"],
      guardedBy: STATUS_PAGE,
    },
  ],
  // All three CRM hosts SERVE now, so every claim below resolves a shared fact
  // rather than a shared refusal — the walk `CRM_CRM` guards. The two
  // refusal-shaped claims that remain are scoped to the pre-CRM generation the
  // frozen pins ride, which is what they were always really about.
  salesforce: [
    {
      statement:
        "The support Cases this host serves for the outage name the same incident PagerDuty paged on, and every one of them resolves to an Account and a Contact that are the same company and the same person the canon names",
      partners: ["pagerduty"],
      guardedBy: CRM_WALK,
    },
    {
      statement:
        "An escalated Case's engineer is a member of the same organization the git host serves — the one place this org's go-to-market cast and its engineering roster share a human, and the reason no `EscalatedTo__c` custom field was invented to advertise it",
      partners: ["github"],
      guardedBy: CRM_WALK,
    },
    {
      statement:
        "One account found here by SOQL on `Website`, on HubSpot by a `domain` search and on Zendesk by name is ONE company: the same `Name`, the same description, the same postal address, the same created and last-modified instant to the second, the same set of contact email addresses and the same tickets — with `NumberOfEmployees` and `AnnualRevenue` equal to HubSpot's string-valued properties and canon's ticket states collapsed onto this host's standard four-value `Case.Status` rather than a widened picklist",
      partners: ["hubspot", "zendesk"],
      guardedBy: CRM_CRM,
    },
    {
      statement:
        "On the pre-CRM generation the frozen pin rides, neither this host nor HubSpot answers a CRM read with an empty collection: both refuse in their own dialect and both carry the coverage header, so 'no accounts on this snapshot' can never be read as 'no accounts'",
      partners: ["hubspot"],
      guardedBy: CRM_CRM,
    },
  ],
  hubspot: [
    {
      statement:
        "The company a `domain` search returns here is the Salesforce Account whose `Website` is that domain and the Zendesk organization whose `domain_names` carries it: one name, one description, one address, one created instant, and a `contacts` association resolving to exactly the email addresses the other two hosts serve for that account",
      partners: ["salesforce", "zendesk"],
      guardedBy: CRM_CRM,
    },
    {
      statement:
        "Every ticket associated to that company here is a Salesforce Case and a Zendesk ticket with the same subject, the same customer message and the same arrival instant, and this host's `hs_pipeline_stage` is canon's finer state — the one Zendesk serves — rather than Salesforce's four-value collapse of it",
      partners: ["salesforce", "zendesk"],
      guardedBy: CRM_CRM,
    },
    {
      statement:
        "A write is refused by this host's read-only boundary in HubSpot's own Error envelope and by Salesforce's in its array envelope — never by either host's coverage 404, which would say the endpoint does not exist rather than that the universe does not accept writes — and on the pre-CRM generation both refuse a CRM read with a coverage-pointing 404 rather than an empty collection",
      partners: ["salesforce"],
      guardedBy: CRM_CRM,
    },
  ],

  statuspage: [
    {
      statement:
        "An incident here is the same publication PagerDuty serves as a status-page post: the same title, the same updates in the same order at the same instants with the same text, the same postmortem, and the same affected services — an `incident_update.affected_components` entry and a `post_update.impacted` entry name one business service, and the two hosts' impact vocabularies (`major_outage` / `full-outage`) are two spellings of one canonical level",
      partners: ["pagerduty"],
      guardedBy: STATUS_PAGE,
    },
    {
      statement:
        "The outage a page told customers about is the one responders were paged for: every incident post here resolves to a canonical incident PagerDuty serves, and the page never announced an outage before that incident opened — so the customer-facing story and the responder-facing one are the same event, not two",
      // Sentry is deliberately NOT named. The claim would be true of it too, but
      // `status-page-parity.test.ts` drives only the PagerDuty and Statuspage
      // renderers, and a claim may only name a provider the suite guarding it
      // actually exercises (provider-page.test.ts enforces this). Naming Sentry
      // for narrative reach would be a promise no test keeps.
      partners: ["pagerduty"],
      guardedBy: STATUS_PAGE,
    },
  ],
};

/** A provider's parity claims. Never empty — `provider-parity.test.ts` and the
 *  catalog page's own test both require at least one. */
export function parityClaims(id: Provider): ParityClaim[] {
  return PROVIDER_PARITY[id];
}
