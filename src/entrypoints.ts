// Notable entry points (SPEC "5–10 notable entry points"): concrete, real
// pointers into the universe — each with a ready-to-run GitHub REST path — so an
// agent's first action can be a correct API call.
//
// Everything here is derived from the PUBLIC API, the same way an agent would
// derive it. That constraint removed two entry points the artifact-backed
// version could compute and the public API genuinely cannot:
//   • "busiest repo by commit count" — no endpoint exposes a total commit
//     count, on our mirror OR on real GitHub. Replaced by most-recently-pushed,
//     which /orgs/{org}/repos does expose.
//   • "most active contributor" — /repos/.../contributors is UNCOVERED (404,
//     per the coverage manifest), and ranking authors by paginating every
//     commit is not a reasonable orientation cost. Dropped rather than faked.
// What remains is 6–8 entry points, all real, all cheap, none invented.

import type { McpUniverse } from "./universe.js";

export interface EntryPoint {
  /** Short label, e.g. "A merged pull request". */
  title: string;
  /** What this demonstrates / why it's interesting (real, measured). */
  what: string;
  /** Provider-relative GitHub REST path — fetch it directly. */
  path: string;
  /** Fully-qualified GitHub URL (base + path). */
  url: string;
  /** Optional follow-up paths worth fetching next. */
  related?: string[];
}

export interface RepoLite {
  name: string;
  default_branch?: string;
  pushed_at?: string;
}
interface PullLite {
  number: number;
  title: string;
  draft?: boolean;
  merged_at?: string | null;
}
interface IssueLite {
  number: number;
  title: string;
  pull_request?: unknown;
}
interface CommitLite {
  sha: string;
  commit?: { message?: string };
}
export interface TeamLite {
  slug: string;
  name: string;
}

/** Org-level facts discovery has already fetched. Passed in so orientation
 *  doesn't request the repo and team lists twice. */
export interface EntryPointContext {
  repos: RepoLite[];
  /** Teams with their member counts, already resolved. */
  teams: Array<{ team: TeamLite; members: number }>;
}

const asArray = <T>(body: unknown): T[] => (Array.isArray(body) ? (body as T[]) : []);

export async function computeEntryPoints(u: McpUniverse, ctx: EntryPointContext): Promise<EntryPoint[]> {
  const org = u.config.orgLogin;
  const ghBase = u.config.providers.github.baseUrl;
  const repoPath = (p: string): string => `/repos/${org}${p}`;
  const ep = (title: string, what: string, path: string, related?: string[]): EntryPoint => ({
    title,
    what,
    path,
    url: `${ghBase}${path}`,
    ...(related ? { related } : {}),
  });

  const eps: EntryPoint[] = [];

  // Most recently pushed repo — the closest public stand-in for "busiest".
  // `repos` arrives already sorted by pushed_at (discovery requests ?sort=pushed).
  const repo = ctx.repos[0] ?? { name: u.config.flagshipRepo };
  const rname = repo.name;
  if (!rname) return eps; // empty universe — nothing to point at

  eps.push(
    ep(
      "Flagship repository",
      `The org's most recently active repo${repo.default_branch ? ` (default branch ${repo.default_branch})` : ""}.`,
      repoPath(`/${rname}`),
      [repoPath(`/${rname}/commits`), repoPath(`/${rname}/pulls?state=all`)],
    ),
  );

  // One list call backs the merged/draft/richest entry points.
  const [pullsRes, issuesRes, commitsRes] = await Promise.all([
    u.restGet("github", repoPath(`/${rname}/pulls?state=all&per_page=100`)),
    u.restGet("github", repoPath(`/${rname}/issues?state=open&per_page=20`)),
    u.restGet("github", repoPath(`/${rname}/commits?per_page=100`)),
  ]);

  const pulls = asArray<PullLite>(pullsRes.body);
  const featured = new Set<number>();

  const merged = pulls.find((p) => p.merged_at != null);
  if (merged) {
    featured.add(merged.number);
    eps.push(
      ep(
        "A merged pull request",
        `PR #${merged.number} "${merged.title}" — a completed review→merge arc; its merge commit exists in history.`,
        repoPath(`/${rname}/pulls/${merged.number}`),
        [repoPath(`/${rname}/pulls/${merged.number}/commits`)],
      ),
    );
  }

  const draft = pulls.find((p) => p.draft === true && !featured.has(p.number));
  if (draft) {
    featured.add(draft.number);
    eps.push(
      ep(
        "A draft pull request (edge case)",
        `PR #${draft.number} "${draft.title}" — draft state, useful for testing draft/ready handling.`,
        repoPath(`/${rname}/pulls/${draft.number}`),
        [repoPath(`/${rname}/pulls/${draft.number}/requested_reviewers`)],
      ),
    );
  }

  // Richest PR by review activity. The list payload carries no review counts,
  // so this costs a few detail fetches — capped, and only over PRs not already
  // featured, so orientation stays a handful of requests.
  const candidates = pulls.filter((p) => !featured.has(p.number)).slice(0, 5);
  const detailed = await Promise.all(
    candidates.map(async (p) => {
      const d = await u.restGet("github", repoPath(`/${rname}/pulls/${p.number}`));
      const b = (d.ok && typeof d.body === "object" && d.body !== null ? d.body : {}) as {
        review_comments?: number;
        comments?: number;
      };
      return { p, score: (b.review_comments ?? 0) + (b.comments ?? 0), reviewComments: b.review_comments ?? 0 };
    }),
  );
  detailed.sort((a, b) => b.score - a.score || a.p.number - b.p.number);
  const richest = detailed[0];
  if (richest && richest.score > 0) {
    featured.add(richest.p.number);
    eps.push(
      ep(
        "Richest pull request",
        `PR #${richest.p.number} "${richest.p.title}" — ${richest.reviewComments} inline review comments across its discussion.`,
        repoPath(`/${rname}/pulls/${richest.p.number}`),
        [repoPath(`/${rname}/pulls/${richest.p.number}/reviews`), repoPath(`/${rname}/pulls/${richest.p.number}/comments`)],
      ),
    );
  }

  // An open issue. /issues includes PRs on GitHub — filter them out.
  const issue = asArray<IssueLite>(issuesRes.body).find((i) => i.pull_request === undefined);
  if (issue) {
    eps.push(
      ep(
        "An open issue",
        `Issue #${issue.number} "${issue.title}" — cross-references authors, labels, and (often) a milestone.`,
        repoPath(`/${rname}/issues/${issue.number}`),
      ),
    );
  }

  const commits = asArray<CommitLite>(commitsRes.body);

  // An incident/revert arc, if the simulation produced one in recent history.
  const revert = commits.find((c) => /^revert\b/i.test(c.commit?.message ?? ""));
  if (revert) {
    eps.push(
      ep(
        "An incident (revert) arc",
        `Commit ${revert.sha.slice(0, 12)} reverts earlier work — a "ship → break → roll back" storyline spanning commits and review.`,
        repoPath(`/${rname}/commits/${revert.sha}`),
      ),
    );
  }

  const recent = commits[0];
  if (recent) {
    eps.push(
      ep(
        "A recent commit",
        `${recent.sha.slice(0, 12)} — the latest commit; the SHA is identical on every provider rendering.`,
        repoPath(`/${rname}/commits/${recent.sha}`),
      ),
    );
  }

  // Largest team — member counts already resolved by discovery.
  const bigTeam = [...ctx.teams].sort((a, b) => b.members - a.members || a.team.slug.localeCompare(b.team.slug))[0];
  if (bigTeam && bigTeam.members > 0) {
    eps.push(
      ep(
        "Largest team",
        `${bigTeam.team.name} (@${org}/${bigTeam.team.slug}) — ${bigTeam.members} members.`,
        `/orgs/${org}/teams/${bigTeam.team.slug}`,
        [`/orgs/${org}/teams/${bigTeam.team.slug}/members`],
      ),
    );
  }

  return eps;
}
