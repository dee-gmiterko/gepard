#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# `replace` only rewrites index.ts files that already exist, so entry points are never created.
yarn barrelsby \
  --directory src/common src/main/lsp \
  --location replace \
  --delete \
  --noHeader \
  --singleQuotes \
  --exclude "\.d\.ts$" "\.test\.tsx?$" "\.stories\.tsx?$" "vitest\.config\.ts$"

# barrelsby exports nested barrels as ./dir/index
find src/common src/main/lsp -name index.ts -exec sed -i "s#/index';#';#" {} +

yarn prettier --write \
  src/common/index.ts src/main/lsp/index.ts \
  "src/common/**/index.ts"
