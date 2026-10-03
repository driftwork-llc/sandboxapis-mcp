// What the agent's budget actually is, read from the API rather than assumed.
//
// WHY THIS EXISTS. An agent planning a 2,000-call sweep with no key has 60
// requests an hour, and until now nothing told it so: the only nudge was a
// stderr line at startup (`stdio.ts`) that no agent ever sees, and the first
// news of the wall arrived as request 61's refusal, halfway through a loop.
// `orient` now states the budget up front and `check_budget` re-reads it on
// demand, which is the difference between a sweep that plans itself and one
// that dies mid-flight.
//
// THE READ IS FREE. GitHub's `GET /rate_limit` is exempt from the budget it
// reports — real GitHub excludes it, and so does the gateway
// (`ProviderDef.rateLimitExempt`) — and the body is built from the same
// `LimitState` as the response headers, so it reports the ONE enforced hourly
// window under every resource name (DECISIONS 2026-08-30 `[audit fix] GET
// /rate_limit`). Reading it therefore costs nothing and cannot be stale.
//
// AND IT IS NEVER INVENTED. If the call fails — no network, a host down, an
// older deployment — the numbers are OMITTED and the note says so. A plausible
// "60" written from a constant would be exactly the placeholder invariant #4
// forbids: an agent would pace itself against a figure nobody enforced.

import { ANON_HOURLY_LIMIT, FREE_HOURLY_LIMIT, PRICING_URL, UPGRADE_URL_ANONYMOUS } from "./config.js";
import type { McpUniverse } from "./universe.js";

/** The provider host the budget is read from: the only dialect whose budget
 *  endpoint is itself exempt from the budget. */
export const BUDGET_PROVIDER = "github" as const;

/** The path that read is made against. */
export const BUDGET_PATH = "/rate_limit";

/** en-US grouping, so 6000 reads as "6,000" — the same rule the gateway's
 *  refusal prose follows (ladder.ts). */
const n = (value: number): string => value.toLocaleString("en-US");

/** The numbers, when they could be read. All three or none: a partial answer
 *  (a limit with no reset) is worse than an absent one, because an agent would
 *  pace against it anyway. */
export interface BudgetNumbers {
  /** Requests per hour on this identity, across every provider host. */
  limit: number;
  remaining: number;
  /** Unix seconds when the window resets. */
  reset: number;
}

export interface Budget {
  /** Was this server started with a key (`SANDBOXAPIS_API_KEY`)? */
  keyed: boolean;
  /** Absent when the read failed — never guessed. */
  numbers?: BudgetNumbers;
  /** Why the numbers are absent, for the caller's `note`. Absent when they are present. */
  unavailable?: string;
}

/** GitHub's `/rate_limit` body, in the one shape this module reads. */
interface RateLimitBody {
  resources?: { core?: { limit?: unknown; remaining?: unknown; reset?: unknown } };
}

const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/**
 * One free read of the caller's real window. Never throws: the transport
 * already shapes a network failure as a result, and a budget check that could
 * fail a tool call would be worse than one that says "I could not tell".
 */
export async function readBudget(u: McpUniverse): Promise<Budget> {
  const keyed = u.keyed;
  const res = await u.restGet(BUDGET_PROVIDER, BUDGET_PATH);
  if (!res.ok) {
    return { keyed, unavailable: `GET ${BUDGET_PATH} on the ${BUDGET_PROVIDER} host answered ${res.status}` };
  }
  // `resources.core` rather than `rate`: `rate` is the deprecated alias in
  // GitHub's own schema, and every resource name reports the same enforced
  // bucket here anyway.
  const core = (res.body as RateLimitBody | null)?.resources?.core;
  const limit = num(core?.limit);
  const remaining = num(core?.remaining);
  const reset = num(core?.reset);
  if (limit === undefined || remaining === undefined || reset === undefined) {
    return { keyed, unavailable: `GET ${BUDGET_PATH} answered without a numeric resources.core` };
  }
  return { keyed, numbers: { limit, remaining, reset } };
}

/** The upgrade destination for a caller in this state.
 *
 *  Unkeyed callers get the SAME counting route the gateway's anonymous refusal
 *  names, so both paths land in one funnel. A keyed caller gets `/pricing`
 *  instead of a `?from=<rung>` route, because this server does not know which
 *  rung its key is on — the gateway names the rung only when it refuses — and
 *  inferring one from the hourly number would be a guess presented as a fact. */
export function upgradeUrlFor(keyed: boolean): string {
  return keyed ? PRICING_URL : UPGRADE_URL_ANONYMOUS;
}

/** One sentence an agent can act on, and never a number nobody enforced. */
export function budgetNote(budget: Budget): string {
  if (!budget.keyed) {
    const anonymous =
      `Anonymous: ${n(ANON_HOURLY_LIMIT)} requests/hour shared across every provider host; ` +
      `set SANDBOXAPIS_API_KEY to a free key for ${n(FREE_HOURLY_LIMIT)}/hour.`;
    // The sentence itself quotes the PUBLISHED rung, which is true either way;
    // what a failed read costs is `limit`/`remaining`/`reset`, and saying so is
    // the difference between "no live count" and a fabricated one.
    return budget.numbers
      ? anonymous
      : `${anonymous} (The live window could not be read — ${budget.unavailable} — so no remaining count is reported.)`;
  }
  const refusalClause = "when a refusal arrives, tool results carry `upgrade` with the next rung.";
  return budget.numbers
    ? `Keyed: ${n(budget.numbers.limit)}/hour; ${refusalClause}`
    : `Keyed. The live budget could not be read (${budget.unavailable}), so no limit is stated; ${refusalClause}`;
}

/** Seconds until the window resets, from a clock the caller supplies (tests
 *  freeze it). Never negative — a reset already in the past means the window
 *  has rolled and the answer is 0, not a negative countdown. */
export function resetsInSeconds(reset: number, nowMs: number): number {
  return Math.max(0, reset - Math.floor(nowMs / 1000));
}

/**
 * `orient`'s `access` block: what the agent may spend, before it spends any.
 *
 * `upgradeUrl` and `note` are ALWAYS present — they are facts about this
 * server's configuration, not about the read — and the three numbers appear
 * only when the free read answered.
 */
export interface Access {
  keyed: boolean;
  limit?: number;
  remaining?: number;
  /** Unix seconds. */
  reset?: number;
  upgradeUrl: string;
  note: string;
}

export function toAccess(budget: Budget): Access {
  return {
    keyed: budget.keyed,
    ...(budget.numbers ?? {}),
    upgradeUrl: upgradeUrlFor(budget.keyed),
    note: budgetNote(budget),
  };
}
