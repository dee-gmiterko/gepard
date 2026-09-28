---
name: commit-all
description: Commit all pending changes as one or more logical conventional commits
allowed-tools: Bash(git status), Bash(git log*), Bash(git diff*), Bash(git add*), Bash(git commit*)
---

You are committing code changes following the project's git conventions.

## Critical Rules

- Stage whole files only (`git add <file>`), never `git add -p`
- Never add Co-Authored-By lines
- Never push unless explicitly asked
- Follow conventional commit format: `type: description`
- One commit per goal. A goal is a coherent unit of intent, not a file or layer. Avoid over-splitting.
- Commit message is a single line only. No body, no multi-line messages.
- No class names or file names in commit messages. Describe the goal in plain words.
- Never name a specific retailer in a commit message.

## Process

0. Read recent git log to understand established commit message patterns (note the format observed)
1. Run `git status` to see all changed files
2. Group changes into logical commits
   (e.g. retailer config changes are one, one logical feature and its caused dependencies are one group)
3. For each group: `git add` the relevant files, `git commit` with a conventional message
4. Only complete when all changes are committed

## Commit message context

$ARGUMENTS
