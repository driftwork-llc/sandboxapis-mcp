// The catalog facts about each provider that no other record carries: the name
// we show a human, the category it files under, the day it went live, and
// whether it is still live.
//
// Why here, beside `provider-ids.ts`, rather than in `apps/web`: the site is not
// the only consumer. Until this file existed, a provider's display name lived
// ONLY in a `PROVIDER_NAV` array inside the web app's coverage page, one of
// five hand-maintained provider lists there — which is how Slack shipped in
// Phase 34 and never appeared in the coverage nav at all. (Both that array and
// the component holding it are gone; the site reads this file now.) A `Record<Provider, …>` makes that failure a type error: add an id to
// `PROVIDER_IDS` and this file stops compiling until the row exists.
//
// This is DISPLAY and PROVENANCE metadata only. Nothing here is derived from
// the coverage manifest, and nothing here may ever restate a count — counts
// come from `coverage/COVERAGE_MANIFEST.yaml` at build time
// (`apps/web/scripts/gen-content.ts`), so a number on the catalog can never
// disagree with the manifest that produced it.

import { PROVIDER_IDS, type Provider } from "./provider-ids.js";

/**
 * The catalog's grouping vocabulary. A CLOSED union, not free text: the
 * `/providers` page renders one section per category, and an unlisted string
 * would silently create a section nobody designed.
 *
 * Five of the nine have no provider yet — they are the lanes the provider
 * expansion program opens (PROVIDER_EXPANSION.md §5, Track B: observability
 * first, then CI/CD, then CRM/support, infra, registry). Named now so the page
 * can show an empty category as a gap to be filled rather than pretend the
 * taxonomy stops at what shipped.
 */
export const PROVIDER_CATEGORIES = [
  "git host",
  "issue tracker",
  "AI telemetry",
  "messaging",
  "CI/CD",
  "observability",
  "CRM/support",
  "infra",
  "registry",
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export interface ProviderRegistryEntry {
  /** What a human is shown. Named by the PRODUCT served, not by the host or the
   *  vendor, wherever those differ — see the `chatgpt` and `teams` rows. */
  displayName: string;
  category: ProviderCategory;
  /** ISO calendar date (YYYY-MM-DD) the provider first served traffic. */
  launched: string;
  /** `retired` is reserved for a provider we stop serving on live hosts while
   *  its frozen pins keep answering. None yet — the first retirement playbook
   *  is recorded in DECISIONS; individual RETIRED ENDPOINTS (Cursor has one)
   *  are a manifest row status, not a provider lifecycle. */
  lifecycle: "live" | "retired";
}

/**
 * Launch dates are best-effort, read off the phase records rather than a
 * deploy log — IMPLEMENTATION_PLAN.md phase status lines and the matching
 * DECISIONS.md entries, which are the closest thing this repo has to a
 * per-provider ship date:
 *
 * - github, gitlab — M0, the two providers the service launched with
 *   (LAUNCH.md; Phase 11 beta hardening closed 2026-07-31).
 * - bitbucket      — Phase 17 close-out, DECISIONS 2026-08-03 [P17].
 * - ado            — Phase 18 wave D, DECISIONS 2026-08-04 [P18].
 * - jira           — Phase 20 close-out, DECISIONS 2026-08-04 [P20].
 * - linear         — Phase 21 close-out, DECISIONS 2026-08-04 [P21].
 * - anthropic      — Phase 27 code-complete 2026-08-16.
 * - cursor         — Phase 28 code-complete 2026-08-16.
 * - devin          — Phase 30 code-complete + close-out 2026-08-17.
 * - openai         — Phase 31 code-complete 2026-08-18.
 * - chatgpt        — Phase 31's second surface, DECISIONS 2026-08-18 [P32].
 * - slack          — Phase 34, DECISIONS 2026-08-25 [P34/slack].
 * - teams          — Phase 35, DECISIONS 2026-08-25 [P35/teams].
 *
 * A `Record<Provider, …>`, deliberately: adding an id to `PROVIDER_IDS`
 * without a row here is a compile error, and `provider-registry.test.ts`
 * proves the reverse direction (no row for an id that does not exist).
 */
export const PROVIDER_REGISTRY: Record<Provider, ProviderRegistryEntry> = {
  github: { displayName: "GitHub", category: "git host", launched: "2026-07-31", lifecycle: "live" },
  slack: { displayName: "Slack", category: "messaging", launched: "2026-08-25", lifecycle: "live" },
  gitlab: { displayName: "GitLab", category: "git host", launched: "2026-07-31", lifecycle: "live" },
  bitbucket: { displayName: "Bitbucket", category: "git host", launched: "2026-08-03", lifecycle: "live" },
  ado: { displayName: "Azure DevOps", category: "git host", launched: "2026-08-04", lifecycle: "live" },
  jira: { displayName: "Jira", category: "issue tracker", launched: "2026-08-04", lifecycle: "live" },
  linear: { displayName: "Linear", category: "issue tracker", launched: "2026-08-04", lifecycle: "live" },
  anthropic: { displayName: "Anthropic", category: "AI telemetry", launched: "2026-08-16", lifecycle: "live" },
  cursor: { displayName: "Cursor", category: "AI telemetry", launched: "2026-08-16", lifecycle: "live" },
  devin: { displayName: "Devin", category: "AI telemetry", launched: "2026-08-17", lifecycle: "live" },
  openai: { displayName: "OpenAI", category: "AI telemetry", launched: "2026-08-18", lifecycle: "live" },
  // Named by the product, not the host: "ChatGPT" reads as the chat assistant,
  // when what is served is the Codex Enterprise Analytics API.
  chatgpt: { displayName: "Codex Analytics", category: "AI telemetry", launched: "2026-08-18", lifecycle: "live" },
  // The chatgpt precedent: the host is graph.sandboxapis.dev (Microsoft Graph),
  // the product served is Teams.
  teams: { displayName: "Microsoft Teams", category: "messaging", launched: "2026-08-25", lifecycle: "live" },
  // The first NEW provider of the expansion program (PROVIDER_EXPANSION
  // decision 10) and the first tenant of the "observability" category.
  sentry: { displayName: "Sentry", category: "observability", launched: "2026-09-01", lifecycle: "live" },
  // The second tenant of the observability lane (PROVIDER_EXPANSION decision
  // 10) — the host that answers "who got woken up, and did they answer".
  pagerduty: { displayName: "PagerDuty", category: "observability", launched: "2026-09-01", lifecycle: "live" },
  // The CRM/support lane opens (PROVIDER_EXPANSION decision 12, wave B4). Both
  // hosts launched on 2026-09-04 with their spec, their classified backlog and a
  // small served surface, on the same day live rolled hello-14 — the generation
  // that carries the CRM canon they render — and the -g9 pins froze on it the
  // day after. `launched` is the day the host first served traffic, not the day
  // it is finished: the coverage badge is what says how much is covered, and
  // this file may never restate a count.
  salesforce: { displayName: "Salesforce", category: "CRM/support", launched: "2026-09-04", lifecycle: "live" },
  hubspot: { displayName: "HubSpot", category: "CRM/support", launched: "2026-09-04", lifecycle: "live" },
  // The first tenant of the CRM/support lane (PROVIDER_EXPANSION decision 12,
  // Track B4). The `launched` date is the day the host first served traffic,
  // and this row carries the day zendesk.sandboxapis.dev opened with its
  // account/catalog surface. Its ticket, user and organization rows serve from
  // the CRM canon (hello-14) and its business rules and audit log from the
  // desk-configuration canon (hello-15) — which generation a row needs is the
  // renderer's gap message to say, not this date.
  zendesk: { displayName: "Zendesk", category: "CRM/support", launched: "2026-09-04", lifecycle: "live" },
  // The first tenant of the CI/CD lane (PROVIDER_EXPANSION decision 10, Track
  // B2) — until this row, "CI/CD" was one of the categories named so the
  // catalog could show an empty lane as a gap rather than pretend the taxonomy
  // stopped at what shipped.
  circleci: { displayName: "CircleCI", category: "CI/CD", launched: "2026-09-05", lifecycle: "live" },
  // The lane's SECOND entry, landing the same day and the twentieth provider.
  // The two are complements rather than duplicates: CircleCI has no build-log
  // endpoint to serve because its API v2 declares none, and the job LOG is
  // exactly what this host exists for.
  buildkite: { displayName: "Buildkite", category: "CI/CD", launched: "2026-09-05", lifecycle: "live" },
  // Statuspage joins Observability rather than opening a category of its own:
  // it renders the CUSTOMER-FACING half of the same incident PagerDuty and
  // Sentry render the responder-facing half of — one canonical outage, three
  // hosts, and the status page is where a customer reads about it.
  statuspage: { displayName: "Statuspage", category: "observability", launched: "2026-09-06", lifecycle: "live" },
};

/** URL-safe slug for a category — the `<h2 id>` anchor and the `?category=`
 *  value the catalog page honours server-side. */
export function categorySlug(category: ProviderCategory): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** The category for a slug, or `undefined` when the slug names no category —
 *  which is how a hand-typed `?category=` is rejected rather than rendered as
 *  an empty page. */
export function categoryFromSlug(slug: string): ProviderCategory | undefined {
  return PROVIDER_CATEGORIES.find((c) => categorySlug(c) === slug);
}

/** Provider ids in a category, in `PROVIDER_IDS` order. */
export function providersInCategory(category: ProviderCategory): Provider[] {
  return PROVIDER_IDS.filter((id) => PROVIDER_REGISTRY[id].category === category);
}
