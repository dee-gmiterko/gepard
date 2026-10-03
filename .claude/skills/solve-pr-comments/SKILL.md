---
name: solve-pr-comments
description: Resolve all open/unresolved review comments on open PRs, one PR and one branch at a time, by distributing fixes across parallel subagents and verifying the combined result once per PR. Use whenever the user asks to solve, resolve, address, or fix open PR comments/review threads/feedback.
---

Coordinate resolution of every unresolved review thread on the open PRs. The work is organized as a loop over PRs: exactly one PR, checked out on its own branch, is worked on at a time. Steps 1 to 6 run entirely within one iteration of that loop. Subagents make the edits. The coordinator is the only one who runs full verification and the only one who marks a thread resolved.

A thread counts as resolved only when the coordinator has personally verified — by reading the diff and by a clean verification run — that the code now does what the comment asked. An agent's self-report and a GitHub "resolved" checkmark are both claims, not proof.

## 0. Loop over PRs, one PR and one branch at a time

Changes for a PR must be made, verified and committed on that PR's head branch. Process one PR at a time.

PR list: the PRs the user named, otherwise the user's open PRs:

```
gh pr list --author "@me" --state open --json number,headRefName
```

Record the starting branch: `git branch --show-current`.

For each PR:

1. `git status --short` must print nothing. Otherwise stop and report.
2. `gh pr checkout <number>`. `git branch --show-current` must equal the PR's `headRefName`.
3. Run steps 1 to 6 for this PR's threads only.
4. `git status --short` must print nothing and the step 5 commit must be on this branch. Then `git checkout <starting branch>`.

## 1. Gather every unresolved thread

Get owner/repo if not already known. The PR number is the PR of the current iteration:

```
gh repo view --json owner,name
```

A PR has two kinds of comments, and both are gathered: inline review threads (anchored to a file and line) and global comments (the PR conversation and review summaries, anchored to no file). A query for one kind misses the other.

Inline review threads, via GraphQL:

```
gh api graphql --paginate -f query='query($endCursor: String) { repository(owner: "<owner>", name: "<repo>") { pullRequest(number: <N>) { reviewThreads(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes { id isResolved isOutdated path line comments(first: 20) { nodes { author { login } body createdAt url } } } } } } }' | jq -s '[.[].data.repository.pullRequest.reviewThreads.nodes[]] | map(select(.isResolved==false))'
```

`--paginate` is required: GraphQL caps a page at 100 threads, and unresolved threads can sit past the first page. The jq filter keeps `isResolved: false`.

Global comments of the same PR:

```
gh pr view <N> --json comments,reviews --jq '{comments: [.comments[] | {author: .author.login, body, url, createdAt}], reviews: [.reviews[] | select(.body != "") | {author: .author.login, state, body}]}'
```

Global comments have no resolved state. Every comment and non-empty review body returned is a task, except those the PR author's own earlier replies or a previous iteration of this skill already answered (a later comment or commit referencing it). Their anchor is the PR as a whole; the agent finds the relevant code itself.

Read every comment body before delegating. Correct obvious typos when relaying a comment's text but preserve its intent — do not reinterpret an ambiguous comment into whatever is easiest to implement.

Every unresolved thread is a task at the same bar, regardless of phrasing or length. A comment naming a feature, behavior, or UI element that does not yet exist ("add X," "settings should gain Y," "new feature: ...") is a task to build that thing, not a task to document its absence. It does not need to say "please implement" to count.

## 2. Group and dispatch to parallel subagents

Do not pre-investigate a thread's cause or pre-decide its fix before dispatch — that judgment belongs to the agent doing the work, not the coordinator. Launch all groups in one message so they run concurrently.

Each agent's prompt must include, per thread it owns:

- The thread ID (or the comment URL for a global comment) and the full (typo-corrected, intent-preserved) comment text.
- The file and line the thread is anchored to, or "global, no anchor" for a global comment.
- An instruction to fix the actual code — not acknowledge the comment, not describe the fix in documentation only.

Tell every agent explicitly not to run project-wide verification (typecheck, lint, format, build, test, `yarn validate`, or any part of it) on its own. Concurrent agents in one working tree will collide on shared caches, lockfiles, and build artifacts if each verifies independently mid-flight. Verification runs exactly once, after every agent is done, by the coordinator.

Agents do not commit and do not resolve their own GitHub threads. Both happen only after the combined verification pass in step 4 — an agent mid-flight cannot know whether its change will still hold once every other agent's work lands on top of it.

## 3. Judge each agent's report against the original thread

When an agent hands work back, check it against the thread text it was given, not against its own summary. Read the changed files. Confirm the code now does what the comment asked, in full. A report describing something adjacent to the ask — a partial implementation, a documentation note describing the change as planned, a claim that the issue "was already fine" without addressing the stated concern — does not satisfy the thread.

If the diff and the thread's ask don't match, send the agent back with the specific gap named, or dispatch a new agent. Do not mark the thread resolved and do not proceed to the next step for it.

For a comment that challenges an existing assumption ("I don't trust this," "validate in source," "why does this exist") or sets a hard constraint on the fix, verify against ground truth — the actual installed package version, the actual current code — before accepting a fix that relies on that claim. Do not accept a fix that satisfies part of a stated constraint while quietly violating another part of it.

## 4. One combined verification pass

Once every subagent's report has been judged against its thread, run `yarn validate` once against the merged working tree (typecheck, lint, format check, locale check — see `package.json`; this matches what the pre-commit hook runs). Also run `yarn test`, since `validate` does not include it. Run each exactly once, against the combined result of all agents' work, not per-agent and not skipped.

This step either ends in a fully green result or a named blocker — there is no third outcome. Fix every failure it surfaces, regardless of which agent's change caused it. Iterate until both commands are clean. If a failure cannot be resolved without a decision only the user can make (a genuine design ambiguity, a missing credential), stop and report that specific blocker instead of guessing past it or leaving the tree broken.

## 5. Commit

Run the `/commit-all` skill.

## 6. Close resolved threads

For every thread whose fix has been verified in step 3, whose code has passed step 4, and whose changes are committed in step 5, close it:

```
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<id>"}) { thread { isResolved } } }'
```

A global comment has no thread to close. Once its fix is verified and committed, it is done and needs no GitHub action.

Do not leave a verified thread open. Do not close a thread whose fix has not been verified. If a thread's GitHub state and its actual code state disagree, trust the code: reopen a thread closed prematurely, or fix the code before closing one still open.

## Project convention: no narrative comments

Comments that restate what code visibly does are rejected in this repo. Write a comment only when it states a non-obvious fact — a hidden constraint, a subtle behavior, a workaround for a specific bug — and keep it to one line where possible. Apply this to any code a subagent writes while resolving these threads.
