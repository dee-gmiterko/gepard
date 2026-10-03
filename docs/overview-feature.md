## Overview view

### Purpose
- A landing page answering two questions without opening a single file: "what needs my attention in this project?" (project state) and "what kind of change is this PR and where is it at?" (PR state).
- Facts only, as dense lists and tiny bars. No charts that need interpretation, no animation, no new navigation concepts.

### Placement and state
- `Overview` is a new main tab, always the first one, left of `Comments` and the file tabs. It is the default `mainTab` when a project opens.
- Two states, selected by the PR target only (no extra state of its own):
	- Project overview: no PR targeted (a commit or path target alone still shows it).
	- PR overview: a PR is targeted. Links inside the overview target the PR and keep this tab; the header select only changes the target, leaving the current tab alone (so clearing it never pulls the user out of the files). A project reopened with a remembered PR lands on that PR's overview. The user returns to the project state through the `All pull requests` link, which clears the PR target.
- Selecting a commit or a path does not change the overview state; the PR overview keeps showing the whole PR, since a path/commit target is a navigation scope, not a different PR.
- Opening any file (`file/open`, `file/focus`) leaves the overview, as today for the Comments tab; the tab stays one click away.

### Linking rule
Every linkable text opens the view that explains it, inside the app:

| Text | Opens |
| --- | --- |
| PR title / number, any row of the PR table, an activity entry | PR overview of that PR |
| `Review` button | targets the PR and switches to the files tab (the targeted file browser then lists the changed files; the changed-files checkout is asynchronous, so no file is opened eagerly) |
| Comment count, unresolved count, a comment / review event in the timeline | Comments tab of that PR |
| File path (top changed files) | the file, in diff view |
| Folder row | sets the path target to that folder (a single `RepoPath`) and switches to the files tab |
| Commit event | targets that commit and switches to the files tab |
| Progress (viewed x/y) | switches to the files tab |
| Extension rows, code owner rows, branch names, people | plain text: the path target holds one path, so globs and owner sets cannot be targeted; no in-app view exists for people |

### Project overview

Top to bottom:

1. Header line: `owner/repo`, then three counts: open PRs, PRs waiting for review (not draft, no decision yet), drafts.
   - Why: the one-glance answer to "is anything waiting on me?".
2. Open pull requests table, newest activity first. One row per PR, columns:
   - `#number title` (link), draft badge, author.
   - Size: `+additions -deletions` and `N files`. Why: review effort estimate before committing to it.
   - Comments: total comments and unresolved threads (link). Why: conversation state; unresolved is the "not done" signal.
   - Decision: Approved / Changes requested / Review required. Why: whether the PR is blocked and on whom.
   - Progress: `viewed/files` with a thin bar, from GitHub's per-file viewed marks. Why: resume where you left off; a finished review is visible at a glance. The count covers GitHub's viewed marks on the first 100 files only (the denominator is the number counted), so unsynced local marks are not included here.
   - Updated: relative time. Why: staleness.
   - `Review` button: targets the PR and jumps into its files.
3. Latest activity: a merged feed across the open PRs plus recently merged ones, newest first, capped at 15: commits pushed, reviews submitted, comments, merges. Each line: actor, verb, PR link, time. Why: "what happened since I last looked" without opening every PR.

Deliberately left out: labels (rarely decisive), CI status (separate concern, requires checks API), branch names (in the PR view).

Empty states: no open PRs shows a single line; a failed fetch shows the error with a retry.

### PR overview

Top to bottom:

1. Header: `All pull requests` link, `#number title` (links to GitHub is not needed; plain), state badge (Open / Draft / Merged / Closed), decision badge, author, `head -> base`, updated time, `Review` button.
2. Facts strip (one row of figures, each a link when it has a target):
   - Size: `+additions -deletions`, files, commits.
   - Comments: total and unresolved.
   - Progress: `viewed/files` with a bar.
   - Why: the same numbers as the table, now exact (progress uses the local viewed state, which includes marks not yet synced).
3. What kind of change is it? Four small lists, each at most 8 rows, rows sorted by changed lines, each row `name  files  +a -d`:
   - Folders: changed files grouped by top two path segments. Why: shows whether the change is local or spreads over the codebase.
   - File types: grouped by extension (`no extension` for dotless names). Why: tells docs / tests / config / code apart at once.
   - Code owners: grouped by owner from `CODEOWNERS` (`.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS` at the PR head; last matching rule wins as on GitHub). Files with no owner are grouped as `Unowned`. The block is hidden when the repository has no CODEOWNERS. Why: who must approve, Team owners are shown as plain text; unsupported patterns are ignored, and a missing CODEOWNERS file is silent.
   - Top changed files: top 5 files by changed lines, with the viewed mark (a separate small list). Why: where the real review effort sits.
4. Reviewers: each account that reviewed, with its latest review state, plus pending review requests. Why: who has looked at it and who still owes a review. Commits and comments are not repeated here, the timeline has them.
5. Timeline: events grouped, oldest first, under one heading per day.
   - Day headings carry plain counts per kind (no chart).
   - Events: commits (consecutive commits by one author within one hour merge into `N commits by X`), reviews (approved / requested changes / commented), comments and replies (consecutive by one author within one hour merge into `N comments by X`), opened, ready for review, merged, closed.
   - Why: tells whether the PR is fresh, mid-discussion, or has been pushed after the last review (the "new commits since review" cue).
6. Description: the PR body as markdown, at the bottom, collapsed to a few lines. Why: context, but the facts above matter more at a glance.

### Data
- Project overview: one new IPC channel `overview.project` (GraphQL through `gh`): open PRs with counts, review decision, viewed marks of the first 100 files, last timeline items; plus the 5 most recently merged PRs for the feed.
- PR overview: one new channel `overview.pr` (`gh pr view --json`): state, draft, body, dates, reviews, review requests; commits, comments and changed files come from the existing channels, so the timeline is built from those plus the reviews. Everything else comes from queries the app already has: changed files, PR commits, comment threads, local viewed state, file content for CODEOWNERS.
- Pure derivations (grouping, owners matching, timeline grouping, bucketing) live in a renderer helper and are unit tested.

### Completeness check
- A developer deciding what to review: size, decision, staleness, unresolved comments, progress, one click to start.
- A reviewer of one PR: what it touches (folders, types, owners), where the effort is (largest files), who is involved, what happened and when, and one click to the first unviewed file.

### Out of scope
- CI status, mergeability, and "waiting on me" highlighting (needs team membership); possible follow-ups.
- Cache policy: React Query defaults, refetched when the tab is shown after a sync; each section renders its own loading and error line so a partial failure still shows the rest.
