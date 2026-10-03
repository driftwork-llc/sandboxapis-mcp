// The provider vocabulary, defined LOCALLY so the published thin client carries
// no workspace dependency at runtime — `npx @sandboxapis/mcp` should pull down a
// small HTTP client, not the engine.
//
// This intentionally duplicates @sandboxapis/artifact's PROVIDER_IDS. The two
// are held in sync by a test (artifact stays a devDependency), so drift fails
// the build rather than silently shipping a client that can't name a provider
// the service has launched.

// Slack sits before gitlab deliberately — the order mirrors
// @sandboxapis/artifact's PROVIDER_IDS (held in sync by a test), whose order
// the gateway's dev-split depends on (see that file's comment).
// Order mirrors @sandboxapis/artifact's PROVIDER_IDS exactly (a test holds the
// two in sync); read that file's header for WHY zendesk sits before gitlab
// and circleci before zendesk, while salesforce, hubspot and buildkite are
// appended. Every placement is a collision analysis, not a habit — circleci's
// is that its whole API sits under "/api/v2", which zendesk's own claim would
// swallow; buildkite's is that "/v2/" is a prefix of no other def's dev-split
// claim and has no other def's claim as a prefix. statuspage is appended too,
// and its analysis is the one where the claim was NARROWED rather than taken:
// its API lives under "/v1/", which is the service host's own prefix, so it
// claims "/v1/pages" and deliberately leaves "/v1/organizations" to anthropic.
export const PROVIDER_IDS = ["github", "slack", "sentry", "circleci", "zendesk", "gitlab", "bitbucket", "ado", "jira", "linear", "anthropic", "cursor", "devin", "openai", "chatgpt", "teams", "pagerduty", "salesforce", "hubspot", "buildkite", "statuspage"] as const;

export type Provider = (typeof PROVIDER_IDS)[number];

export function isProviderId(v: string): v is Provider {
  return (PROVIDER_IDS as readonly string[]).includes(v);
}
