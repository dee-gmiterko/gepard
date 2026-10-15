# Contributing to Gepard

This covers building Gepard from source, day-to-day development, testing,
packaging, and writing extensions. For what the app does, see `README.md`
(user-facing) and `docs/gepard.md` (full product spec).

## Code structure

Yarn workspaces + Turborepo.

| Path                  | Package                       | Role                                                  |
| --------------------- | ----------------------------- | ----------------------------------------------------- |
| `src/app`             | `gepard`                      | electron-vite / electron-builder config, build assets |
| `src/main`            | `@gepard/main`                | Electron main process                                 |
| `src/preload`         | `@gepard/preload`             | preload bridge                                        |
| `src/renderer`        | `@gepard/renderer`            | React UI                                              |
| `src/common`          | `@gepard/common`              | IPC contract, schemas, models                         |
| `src/common-lsp`      | `@gepard/common-lsp`          | shared code for the LSP extensions                    |
| `tools/eslint-config` | `@gepard/eslint-config`       | shared ESLint configs                                 |
| `extensions/*`        | see [Extensions](#extensions) |                                                       |

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

Extensions are independent packages, each with its own manifest and
dependencies, and are yarn workspaces. See [docs/extensions.md](docs/extensions.md) for the interfaces and
how to write one.
