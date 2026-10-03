# @sandboxapis/mcp

An MCP server that gives an AI agent a **realistic, read-only data set** to work against — repos, pull requests, reviews, issues, sprints, commits — served through API-compatible replicas of GitHub, GitLab, Bitbucket, Azure DevOps, Jira, Linear, Slack, Microsoft Teams, Sentry, PagerDuty, Statuspage, CircleCI, Buildkite, Zendesk, Salesforce, HubSpot, Anthropic, OpenAI, ChatGPT, Cursor and Devin.

No test accounts. No credentials. No rate-limit anxiety. Nothing to clean up afterwards.

```bash
claude mcp add sandboxapis -- npx -y @sandboxapis/mcp
```

Then have the agent call **`orient`** first. It comes back with the API surfaces and their base URLs, the org and its teams, notable entry points (each with a ready-to-run request), how to pin a reproducible snapshot, where the coverage manifest lives, and an `access` block saying what this server may spend — enough to make a correct call with no docs reading.

## Why this exists

Agents that build or test integrations need something real to point at. The options are usually a hand-maintained fake org that's thin and stale, or a real account with credentials, rate limits, and consequences. This is the third option: one simulated company — `olympus-labs` — with months of coherent history, rendered into 21 different API dialects, where every reference resolves. A pull request's author is a fetchable user, its commits exist with matching SHAs, its reviewers belong to real teams, and the same story is queryable through every host.

Everything is **read-only**. Writes return the provider's own error shape with a plain explanation, so an agent that tries one learns something instead of breaking something.

## Tools

| Tool | What it does |
|---|---|
| `orient` | Start here. Full self-orientation, no docs required — including `access`: keyed or not, the requests left this hour, and where to raise the limit. |
| `check_budget` | Costs nothing. Call it before any loop of more than a handful of requests: limit, remaining, when the window resets. |
| `list_repositories` / `get_repository` | Repos, provider-shaped, with provider-form ids. |
| `list_pull_requests` / `get_pull_request` | PRs/MRs with their reviews or approvals. |
| `list_issues` | Issues — REST on git hosts and Jira, GraphQL on Linear. |
| `get_user` | A user by login/username. |
| `search_commits_by_author` | Commits by author, with SHAs that cross-reference across hosts. |
| `get_snapshot` | The pinned hostname for drift-free CI. |

Results come from the same public API a human would point a client at, so anything an agent learns here transfers directly to a `curl` or an Octokit call.

## Configuration

Everything is optional — the server works with no configuration at all.

| Variable | Effect |
|---|---|
| `SANDBOXAPIS_API_KEY` | Lifts the anonymous limit (60 req/hr) to 600. Free key at [sandboxapis.dev](https://sandboxapis.dev/login) — agents exhaust 60/hr quickly. Without it, a refusal names this variable rather than a signup page; with it, a refusal names the rung the key is on. Either way the tool result carries `upgrade` (see below). |
| `SANDBOXAPIS_BASE_URL_GITHUB` (and `_GITLAB`, `_BITBUCKET`, `_ADO`, `_JIRA`, `_LINEAR`, `_SLACK`, `_TEAMS`, `_SENTRY`, `_PAGERDUTY`, `_STATUSPAGE`, `_SALESFORCE`, `_HUBSPOT`, `_ZENDESK`, `_CIRCLECI`, `_BUILDKITE`, `_ANTHROPIC`, `_OPENAI`, `_CHATGPT`, `_CURSOR`, `_DEVIN`) | Point a surface elsewhere — a pinned snapshot host, or a self-hosted instance. |

## When the budget runs out

Nothing is hidden behind a limit, but every caller has an hourly window and an agent in a loop will find it. Two things make that legible without parsing prose:

- **Ask first.** `check_budget` reads the real window — limit, remaining, seconds until it resets — through an endpoint that is exempt from the budget it reports, so the check itself is free. `orient` returns the same facts in its `access` block, so an agent that oriented already knows.
- **The refusal is data.** A refused tool result keeps its `{provider, path, status, body}` exactly as before and adds `upgrade`:

```json
{
  "provider": "github",
  "path": "/users/athena",
  "status": 403,
  "body": { "message": "API rate limit exceeded. …", "documentation_url": "…", "status": "403" },
  "upgrade": { "tier": "anonymous", "url": "https://sandboxapis.dev/upgrade?from=anonymous", "retryAfterSeconds": 600 }
}
```

`tier` is the rung that refused; `url` is absent when there is nothing to offer; `retryAfterSeconds` is present when the provider sent a `Retry-After`. `upgrade` appears on over-limit refusals only — never on a success, a coverage 404, or a read-only refusal.

## Live vs. pinned

The default hosts roll forward daily, so the newest activity is always hours old — good for demos and exploration. For tests you want data that never drifts, ask `get_snapshot` for a pinned hostname and set the matching `SANDBOXAPIS_BASE_URL_*`. A snapshot regenerates byte-identically on every request, so pinned assertions hold indefinitely.

## Honest boundaries

Coverage is deliberately bounded and published. An uncovered REST endpoint returns a real `404` plus an `X-SandboxAPIs-Coverage` header pointing at the [coverage manifest](https://sandboxapis.dev/coverage); an uncovered GraphQL field returns an explicit coverage error rather than a silent `null`. You will never get a plausible-looking invented value.

This package is a thin client: it holds no data of its own and reads the hosted service over the network.

## Source and licence

This repository is the source of the MCP server, the `@sandboxapis/mcp` package on npm. It is a thin client: it holds no data of its own and reads the hosted service at [sandboxapis.dev](https://sandboxapis.dev) over HTTPS. The hosted service, the API replicas and the engine that generates the data set are separate and are not included here.

The code is MIT licensed, see [LICENSE](LICENSE). The copyright holder is Driftwork LLC, the company behind SandboxAPIs.

The source of record is the SandboxAPIs monorepo, and this repository is written from it by a script on every release, with the release's version as a tag. Bug reports and feature requests are welcome in this repository's issues. A pull request here is read and carried over by the SandboxAPIs team rather than merged in place, because the next release would otherwise overwrite it. Contact: team@sandboxapis.dev.

---

Docs: [sandboxapis.dev/docs/mcp](https://sandboxapis.dev/docs/mcp) · Coverage: [sandboxapis.dev/coverage](https://sandboxapis.dev/coverage)
