# Contributing to Gepard

This covers building Gepard from source, day-to-day development, testing,
packaging, and writing extensions. For what the app does, see `README.md`
(user-facing) and `docs/gepard.md` (full product spec).

## Code structure

Yarn workspaces + Turborepo.

| Path | Package | Role |
| --- | --- | --- |
| `src/app` | `gepard` | electron-vite / electron-builder config, build assets |
| `src/main` | `@gepard/main` | Electron main process |
| `src/preload` | `@gepard/preload` | preload bridge |
| `src/renderer` | `@gepard/renderer` | React UI |
| `src/common` | `@gepard/common` | IPC contract, schemas, models |
| `tools/eslint-config` | `@gepard/eslint-config` | shared ESLint configs |
| `extensions/*` | see [Extensions](#extensions) | |

## Project setup

### Install

```bash
yarn install
```

### Development

```bash
yarn dev
```

### Test

```bash
yarn test
```

### Typecheck / lint / format

```bash
yarn typecheck
yarn lint
yarn format:check   # or `yarn format` to write fixes
```

### Build

```bash
# For Windows
yarn build:win

# For macOS
yarn build:mac

# For Linux
yarn build:linux
```

`yarn build:unpack` produces an unpacked build (via `electron-builder --dir`)
for quick local testing of a packaged app without generating installers.

## Extensions

Extensions are independent packages, each with its own `package.json` and
its own dependencies, living under the repo root:

- `extensions/lsp/<name>` - a language server extension.
- `extensions/grammars/<name>` - a syntax highlighting extension.
- `extensions/themes/<name>` - a colour theme extension.
- `extensions/locales/<name>` - a UI translation extension.

All of these directories are yarn workspaces (see `package.json`'s
`workspaces` field), and each extension's manifest declares its kind via a
`gepard.type` field (`"lsp"`, `"grammar"`, `"theme"` or `"locale"`).

Each extension's entry module (`main` in its `package.json`, default
`index.js`) must be a plain JS/ES module whose default export (or `extension`
export) is the extension object. The main process scans the bundled and
user-installed extension directories, checks `gepard.type` against the
expected kind and validates the export; see `src/main/extensions/scanner.ts`
and `src/main/extensions/registry.ts`. Extensions that fail validation are
reported as failed rather than loaded.

### LSP

Provides code intelligence for one language family. The extension claims
files by path and names their language id; for each opened project it starts
a session that answers symbol, definition, reference and workspace-symbol
queries and is told about file changes. Sessions report indexing status and
logs back through the host's sink and own their server process. Interface:
`src/common/extensions/lsp.ts`.

### Grammar

Provides syntax highlighting for the renderer. The extension declares the
languages it handles (name plus file extensions) and builds a CodeMirror
language on demand from the CodeMirror and Lezer modules the app hands it, so
the package must be a single self-contained module that never bundles
CodeMirror itself. Interface: `src/common/extensions/grammar.ts`; example:
`extensions/grammars/godot`.

### Theme

Pure data: a colour theme declaring its mode (light or dark) and a complete
set of UI colour values. It contains no code to run. Interface:
`src/common/extensions/theme.ts`, backed by `src/common/ipc/schemas/theme.ts`.

### Locale

Pure data: a UI translation with an id, display name and a map from source
(English) message strings to translations. Catalogs are generated and checked
by `scripts/refresh-locales.ts`. Interface: `src/common/extensions/locale.ts`, backed by
`src/common/ipc/schemas/locale.ts`.

The bundled TypeScript/JavaScript LSP extension (`extensions/lsp/typescript`)
is enabled by default. It always runs its own pinned, native TypeScript
language server - it deliberately does not detect or run a reviewed
project's own in-repo TypeScript toolchain. Gepard is a review tool, not an
editor, and reviewing shouldn't depend on the target project's toolchain
being installed or even compatible.

To add a new extension, add a new package under the matching `extensions/`
directory, following an existing one as a template.
