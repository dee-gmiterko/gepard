#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${1:-}" = "--check" ]; then
  snapshot="$(mktemp -d)"
  trap 'rm -rf "$snapshot"' EXIT
  find src/common src/common-lsp -name index.ts -exec cp --parents {} "$snapshot" \;
  bash "$0"
  status=0
  while IFS= read -r file; do
    diff "$snapshot/$file" "$file" || status=1
  done < <(cd "$snapshot" && find src -name index.ts)
  # Restore the working tree so the check never modifies files.
  (cd "$snapshot" && find . -name index.ts -exec cp --parents {} "$OLDPWD" \;)
  exit "$status"
fi

# `replace` only rewrites index.ts files that already exist, so entry points are never created.
yarn barrelsby \
  --directory src/common src/common-lsp \
  --location replace \
  --delete \
  --noHeader \
  --singleQuotes \
  --exclude "\.d\.ts$" "\.test\.tsx?$" "\.stories\.tsx?$" "vitest\.config\.ts$"

# barrelsby exports nested barrels as ./dir/index
find src/common src/common-lsp -name index.ts -exec sed -i "s#/index';#';#" {} +

yarn prettier --write \
  src/common/index.ts src/common-lsp/index.ts \
  "src/common/**/index.ts" "src/common-lsp/**/index.ts"
