#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

branch="testing-merged"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean, commit or stash your changes first." >&2
  exit 1
fi

git fetch origin main

# Start fresh from main on every run so stale merges never pile up.
git checkout -B "$branch" origin/main

mapfile -t prs < <(gh pr list --state open --json number --jq '.[].number')

for pr in "${prs[@]}"; do
  echo "Merging PR #$pr"
  # pull/<n>/head also covers PRs opened from forks.
  git fetch origin "pull/$pr/head"
  if ! git merge --no-edit -m "Merge PR #$pr into $branch" FETCH_HEAD; then
    git merge --abort
    echo "PR #$pr does not merge cleanly into $branch." >&2
    exit 1
  fi
done

yarn build:linux

version="$(jq -r .version src/app/package.json)"
./src/app/dist/gepard-"$version".AppImage
