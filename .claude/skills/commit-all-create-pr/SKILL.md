---
name: commit-all-create-pr
description: Commit each logical change on its own branch, push it, and open a pull request linking the issue
allowed-tools: Bash(git status), Bash(git log*), Bash(git diff*), Bash(git add*), Bash(git commit*), Bash(git checkout*), Bash(git switch*), Bash(git push*), Bash(gh pr create*)
---

You are committing code changes following the project's git conventions, one branch and one pull request per issue.

## Critical Rules

- Stage whole files only (`git add <file>`), never `git add -p`
- Never add Co-Authored-By lines
- Follow conventional commit format: `type: description`
- One branch, one commit, one pull request per goal. A goal is a coherent unit of intent, not a file or layer. Avoid over-splitting.
- Commit message is a single line only. No body, no multi-line messages.
- No class names or file names in commit messages. Describe the goal in plain words.
- Never name a specific retailer in a commit message.
- Reference the issue in the pull request description (`Related to #N`). Never use closing keywords (`Closes`, `Fixes`, `Resolves`).
- Never merge a pull request.

## Process

0. Read recent git log to understand established commit message patterns (note the format observed)
1. Run `git status` to see all changed files
2. Group changes into logical commits, one per issue or coherent group of issues
3. For each group:
   1. Create a new branch from the base branch
   2. `git add` the relevant files, `git commit` with a conventional message
   3. `git push -u origin <branch>`
   4. `gh pr create` with the commit message as title and a description referencing the issue
   5. Return to the base branch, then next group
4. Only complete when all changes are committed and every branch has a pull request

## Context

$ARGUMENTS
