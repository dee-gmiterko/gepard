---
name: solve-issues
description: Implement every open GitHub issue on the repository (feature requests and bug reports) by distributing the work across parallel subagents, verifying the combined result once, and creating a branch and pull request per issue. Use whenever the user asks to solve, resolve, implement, fix, or work through open issues / the issue backlog.
---

Coordinate resolution of every open issue on the repository. Subagents make the edits. The coordinator is the only one who runs full verification, and the only one who commits.

An issue counts as solved only when the coordinator has personally verified — by reading the diff and by a clean verification run — that the code now does what the issue asked. An agent's self-report is a claim, not proof.

## 1. Gather every open issue

Get owner/repo if not already known:

```
gh repo view --json owner,name
```

List all open issues with their full bodies and labels. Pull requests are excluded by `gh issue list` already:

```
gh issue list --state open --limit 100 --json number,title,body,labels,url,comments
```

Read every issue body and its comments before delegating — later comments often refine or override the original ask. Correct obvious typos when relaying an issue's text but preserve its intent — do not reinterpret an ambiguous issue into whatever is easiest to implement.

Every open issue is a task at the same bar, regardless of label, phrasing, or length. A `bug` issue is a task to fix the defect. An `enhancement` issue or one describing a feature, behavior, or UI element that does not yet exist is a task to build that thing, not a task to document its absence. It does not need to say "please implement" to count.

Skip only issues labeled `wontfix`, `duplicate`, `invalid`, or `question`. Do not pick up an issue that is already linked to an open PR (`gh pr list --search "linked:<N>"` or a "Closes #N" in an open PR body) — report it as already in progress instead.

The release-please pull request (`chore(main): release x.y.z` on a `release-please--*` branch) is ignored by this skill: it is not an issue, it links no issue, and it must never be treated as in-progress work or touched.

## 2. Group and dispatch to parallel subagents

Do not pre-investigate an issue's cause or pre-decide its fix before dispatch — that judgment belongs to the agent doing the work, not the coordinator. Group issues that touch the same area so one agent owns them; keep unrelated issues on separate agents. Launch all groups in one message so they run concurrently.

Each agent's prompt must include, per issue it owns:

- The issue number, title, URL, and the full (typo-corrected, intent-preserved) body plus any clarifying comments, pasted into the prompt in full. Never pass only an issue number or link, and never summarize, shorten, or paraphrase the text.
- An instruction to fix the actual code — not acknowledge the issue, not describe the fix in documentation only.
- An instruction to add or extend tests when the issue is a bug report, so the regression is covered.

Tell every agent explicitly not to run project-wide verification (typecheck, lint, format, build, test, `yarn validate`, or any part of it) on its own. Concurrent agents in one working tree will collide on shared caches, lockfiles, and build artifacts if each verifies independently mid-flight. Verification runs exactly once, after every agent is done, by the coordinator.

Agents do not commit. Committing happens only after the combined verification pass in step 4 — an agent mid-flight cannot know whether its change will still hold once every other agent's work lands on top of it.

## 3. Judge each agent's report against the original issue

When an agent hands work back, check it against the issue text it was given, not against its own summary. Read the changed files. Confirm the code now does what the issue asked, in full. A report describing something adjacent to the ask — a partial implementation, a documentation note describing the change as planned, a claim that the issue "was already fine" without addressing the stated concern — does not satisfy the issue.

If the diff and the issue's ask don't match, send the agent back with the specific gap named, or dispatch a new agent. Do not proceed to the next step for it.

For an issue that challenges an existing assumption ("this is wrong," "validate in source," "why does this exist") or sets a hard constraint on the fix, verify against ground truth — the actual installed package version, the actual current code — before accepting a fix that relies on that claim. Do not accept a fix that satisfies part of a stated constraint while quietly violating another part of it.

## 4. One combined verification pass

Once every subagent's report has been judged against its issue, run `yarn validate` once against the merged working tree (typecheck, lint, format check, locale check — see `package.json`; this matches what the pre-commit hook runs). Also run `yarn test`, since `validate` does not include it. Run each exactly once, against the combined result of all agents' work, not per-agent and not skipped.

This step either ends in a fully green result or a named blocker — there is no third outcome. Fix every failure it surfaces, regardless of which agent's change caused it. Iterate until both commands are clean. If a failure cannot be resolved without a decision only the user can make (a genuine design ambiguity, a missing credential), stop and report that specific blocker instead of guessing past it or leaving the tree broken.

## 5. Commit

Run the `/commit-all-create-pr` skill.

## Project convention: no narrative comments

Comments that restate what code visibly does are rejected in this repo. Write a comment only when it states a non-obvious fact — a hidden constraint, a subtle behavior, a workaround for a specific bug — and keep it to one line where possible. Apply this to any code a subagent writes while solving these issues.
