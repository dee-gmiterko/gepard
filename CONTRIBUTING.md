# Contributing to Gepard

This covers building Gepard from source, day-to-day development, testing,
packaging, and writing extensions. For what the app does, see `README.md`
(user-facing) and `docs/gepard.md` (full product spec).

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

## Recommended IDE setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Repo conventions

- The package is ESM (`"type": "module"`).
- Scripts under `scripts/` are TypeScript, run directly with `tsx` - no
  separate build step for them.
- `yarn locales:refresh` regenerates every non-source locale catalog from
  the source (English) strings extracted out of the codebase.
- `yarn media:refresh` regenerates the app icons (`build/icon.*`,
  `resources/icon.png`) from `resources/logo.svg`. Never hand-edit the
  generated icon files - change the SVG and rerun the script.
- Styling is styled-components throughout, defined locally in each
  component's own file; if the same styled component shows up in more than
  one place, that's a sign it should become a shared component instead.
- Icons come from `react-feather`.

## Extensions

Extensions are independent packages, each with its own `package.json` and
its own dependencies, living under the repo root:

- `extensions/lsp/<name>` - a language server extension.
- `extensions/themes/<name>` - a colour theme extension.

Both directories are yarn workspaces (see `package.json`'s `workspaces`
field), and each extension's manifest declares its kind via a `gepard.type`
field (`"lsp"` or `"theme"`).

The bundled TypeScript/JavaScript LSP extension (`extensions/lsp/typescript`)
is enabled by default. It always runs its own pinned, native TypeScript
language server - it deliberately does not detect or run a reviewed
project's own in-repo TypeScript toolchain. Gepard is a review tool, not an
editor, and reviewing shouldn't depend on the target project's toolchain
being installed or even compatible.

To add a new extension, add a new package under the matching `extensions/`
directory, following an existing one as a template.
