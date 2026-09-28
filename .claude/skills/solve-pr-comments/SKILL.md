---
name: solve-pr-comments
description: Resolve all open/unresolved review comments on the current branch's PR by distributing fixes across parallel subagents, then verifying the combined result once. Use whenever the user asks to solve, resolve, address, or fix open PR comments/review threads/feedback for the current branch.
---

You are coordinating the resolution of every unresolved review thread on the current branch's PR. Subagents will do the actual editing; you stay the single source of truth for what "resolved" actually means, and you are the only one who runs full verification.

The failure mode this skill exists to prevent: treating "an agent said it's done" or "the GitHub thread shows resolved" as proof the comment is actually solved. Neither is proof. The only proof is your own read of the diff plus a clean, fully-green verification run across the _combined_ result of every agent's work.

## 1. Gather every unresolved thread

Top-level PR comments and reviews miss inline review threads almost entirely — query GraphQL directly:

```
gh api graphql -f query='
query {
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <N>) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 20) {
            nodes { author { login } body createdAt url }
          }
        }
      }
    }
  }
}'
```

Filter to `isResolved: false`. Read every comment body yourself before delegating — some are terse, typo-heavy, or ambiguous, and you need to understand each one's actual intent before you can write a subagent prompt that isn't just forwarding confusion downstream.

## 2. Group and dispatch to parallel subagents

Group threads by file/area overlap so agents don't collide on the same files. Launch all groups in one message (one batch of Agent tool calls) so they run concurrently.

Each agent's prompt must include, per thread it owns:

- The thread ID (needed later to resolve it) and the full comment text, with obvious typos corrected but intent preserved — don't silently reinterpret an ambiguous comment into whatever's easiest to implement.
- Enough surrounding code context that the agent can act without re-deriving your own investigation.
- An explicit instruction to fix the actual code, not just post a reply or acknowledge the comment.

Tell every agent explicitly **not** to run project-wide verification (typecheck/lint/format/build/test) on its own. Concurrent agents sharing one working tree will stomp on each other's caches, lockfiles, and build artifacts if each tries to verify independently mid-flight. Verification happens exactly once, after everyone is done, run by you.

Agents may resolve their own GitHub threads via `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "..."}) { thread { isResolved } } }'` as they finish — that's fine as a convenience, but treat it as provisional. An agent's "resolved" is a claim about its own work, checked against nothing but its own judgment.

## 3. Hold "validate this" comments to a higher bar

Some comments explicitly distrust existing code ("I don't trust this to be true," "validate in source," "why does this exist at all") or set a hard constraint on the fix ("get rid of this helper," "even a `.d.ts` is better than active code"). These need real verification against ground truth — the actual installed package types, the actual current code, not the first plausible story that resolves the discomfort.

Concretely: if an agent's fix is "I deleted X because Y's built-in behavior already covers it," that claim is only as good as what it was actually checked against. Wrong package, wrong version, wrong assumption — any of these produce a confident-sounding but false justification, and it will surface as breakage somewhere else in the tree. When you hit this kind of failure, don't paper over it by reverting to the old code (that ignores the reviewer's actual ask) and don't retry cosmetic variations of the same broken idea more than once. If a fix keeps almost-but-not-quite satisfying an explicit constraint, stop and rethink the actual mechanism — e.g. a stated "no runtime code" constraint means a type-only `.d.ts`-style construct with zero emitted JS, not a function with a body that merely looks type-focused.

## 4. One combined verification pass, after everyone reports back

Once all subagents have finished, run the full verification suite yourself, once, against the merged working tree — typecheck, lint, format check, and tests. Not a subset, not skipped, not run per-agent. This is the only point where cross-agent conflicts actually surface: one agent moving a file another agent still imports by its old path, two agents touching the same shared module in incompatible ways, a deletion that looked locally safe but wasn't.

Fix everything the verification pass finds, regardless of which agent's change caused it — "not my assigned thread" isn't a reason to leave it broken. Iterate until everything is clean.

## 5. Only then confirm resolution

A thread counts as genuinely resolved only when both are true: the GitHub thread is marked resolved, and you've personally verified (by reading the diff and by the clean verification pass) that the underlying code claim actually holds. If those disagree, trust the code, not the checkmark — reopen the thread or fix the code, whichever is actually wrong.

## 6. Stay inside what was authorized

Don't take actions beyond the scope you were actually given — e.g. don't resolve a GitHub thread the user never asked you to touch, just because it feels like a natural extension of "fix the code." If a tool call is denied or a permission is blocked, say plainly what happened and what you don't know; don't invent a plausible-sounding explanation to fill the gap.

## Project convention: no narrative comments

This repo's reviewers consistently reject comments that restate what the code visibly does. Only write a comment when it states a genuinely non-obvious fact (a hidden constraint, a subtle type-inference quirk, a workaround for a specific bug) — and keep it to one line wherever possible. This applies to any code a subagent writes as part of resolving these threads too; say so in their prompts.
