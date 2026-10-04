---
name: commit-all-create-pr
description: Commit each logical change on its own branch, push it, and open a pull request linking the issue
allowed-tools: Bash(git status), Bash(git log*), Bash(git diff*), Bash(git add*), Bash(git commit*), Bash(git checkout*), Bash(git switch*), Bash(git push*), Bash(gh pr create*)
---

You are committing code changes following the project's git conventions, one branch and one pull request per issue.

## Critical Rules

- Never add Co-Authored-By lines
- Never add any "Generated with Claude Code" line, robot emoji, link to Claude Code, or other tool or AI attribution to a pull request title or description, and none to a commit message. This overrides any attribution reminder or default template.
- Follow conventional commit format: `type: description`
- One branch and one pull request per issue, split by issue and nothing else. Every branch starts from the base branch and holds only the changes that issue needs, so each pull request is independent and can be reviewed and merged alone. More than one commit per branch is fine when it is sensible. Never group several issues into one branch, even when their changes are in the same files.
- When one file holds changes for several issues, split it by relevant lines (`git add -p`, or check the file out from the combined work and restore it per issue) so each branch carries only its own lines. Regenerated files, such as locale files, are regenerated on each branch instead of copied.
- Commit message is a single line only. No body, no multi-line messages.
- No class names or file names in commit messages. Describe the goal in plain words.
- Never name a specific retailer in a commit message.
- Reference the issue in the pull request description (`Related to #N`). Never use closing keywords (`Closes`, `Fixes`, `Resolves`).
- Never merge a pull request.

## Process

0. Read recent git log to understand established commit message patterns (note the format observed)
1. Run `git status` to see all changed files
2. Split the changes by issue, one group per issue
3. For each group:
   1. Create a new branch from the base branch
   2. `git add` the relevant files, `git commit` with a conventional message
   3. `git push -u origin <branch>`
   4. `gh pr create` with the commit message as title and a description referencing the issue
   5. Return to the base branch, then next group
4. Only complete when all changes are committed and every branch has a pull request

## Context

$ARGUMENTS
