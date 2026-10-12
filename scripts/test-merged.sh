#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

branch="testing-merged"

include=()
exclude=()

usage() {
  echo "Usage: $0 [--include N,N,...] [--exclude N,N,...]" >&2
  exit 1
}

parse_list() {
  [[ "$1" =~ ^[0-9]+(,[0-9]+)*$ ]] || usage
  tr ',' '\n' <<<"$1"
}

while (($#)); do
  case "$1" in
    --include)
      [[ $# -ge 2 ]] || usage
      list="$(parse_list "$2")"
      mapfile -t -O "${#include[@]}" include <<<"$list"
      shift 2
      ;;
    --exclude)
      [[ $# -ge 2 ]] || usage
      list="$(parse_list "$2")"
      mapfile -t -O "${#exclude[@]}" exclude <<<"$list"
      shift 2
      ;;
    *) usage ;;
  esac
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean, commit or stash your changes first." >&2
  exit 1
fi

git fetch origin main

# Start fresh from main on every run so stale merges never pile up.
git checkout -B "$branch" origin/main

if ((${#include[@]})); then
  prs=("${include[@]}")
else
  mapfile -t prs < <(gh pr list --state open --json number,headRefName --jq '.[] | select(.headRefName | startswith("release-please--") | not) | .number')
fi

if ((${#exclude[@]} && ${#prs[@]})); then
  mapfile -t prs < <(printf '%s\n' "${prs[@]}" | grep -vxFf <(printf '%s\n' "${exclude[@]}") || true)
fi

if ((${#prs[@]} == 0)); then
  echo "No PRs to merge." >&2
  exit 1
fi
echo "PRs to merge: ${prs[*]}"

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

yarn install --immutable
yarn build:linux

version="$(jq -r .version src/app/package.json)"
./src/app/dist/gepard-"$version".AppImage
