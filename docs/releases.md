# Releases and CI/CD

## Requirements (issue #5)

- GitHub Actions pipelines using current tooling.
- Validation on branches, blocking pull requests.
- Automatic release from `main` with a decided trigger and versioning scheme.

## Findings from exploring the repo

- Yarn 4 workspaces plus Turborepo; `yarn validate` (a Turborepo `validate` task over typecheck, lint, format check, locale check and barrel check) and `yarn test` are the quality gates.
- Commits already follow Conventional Commits, enforced locally by husky and commitlint.
- Packaging is electron-builder in `src/app` (AppImage, NSIS, dmg), with a `github` publish provider already configured.
- All five app workspaces share version `0.1.0`; `src/app/package.json` is the one electron-builder uses for artifact names. No tags exist yet.

## Tooling versions (checked October 2026)

GitHub forced Node 24 for actions runtimes in 2026, so only Node 24 majors are used: `actions/checkout@v7`, `actions/setup-node@v7`, `googleapis/release-please-action@v5`. Node 24 is used for the project itself.

## Decisions

### Validation

`.github/workflows/validate.yml` runs on every pull request and on pushes to non-main branches: `yarn install --immutable`, `yarn validate`, `yarn test`, and on pull requests also commitlint over the PR commit range (CI has no husky hooks, so this closes the gap). Blocking is achieved by marking the `validate` job as a required status check in a branch protection rule or ruleset for `main`; this is a repository setting and cannot be committed. Superseded runs on the same ref are cancelled. GitHub sets `CI=true`, and each LSP extension's `vitest.config.ts` then excludes `test/extension.test.ts`, which launches the real language server (for example `godot`) that the runner does not have; the other tests, including `lsp.test.ts` and the semantic token tests, still run. Locally those tests run as before.

### Versioning: Conventional Commits with release-please

Options considered:

- semantic-release: publishes on every push to main, so the release moment is not reviewable, and it needs more plugin configuration.
- Manual tags: no automation, easy to forget.
- release-please: maintains a standing "release PR" that accumulates the changelog and version bump derived from commit messages. Merging it is the explicit release decision, with no extra tooling in commits beyond what commitlint already enforces.

Chosen: release-please. Scheme is SemVer driven by commit types: `fix` is patch, `feat` is minor, `!` or `BREAKING CHANGE` is major. While below 1.0.0, breaking changes bump minor and features bump patch (`bump-minor-pre-major`, `bump-patch-for-minor-pre-major`). Tags are plain `vX.Y.Z`.

### Trigger

Every push to `main` runs `release.yml`. release-please opens or updates the release PR. Releasing happens only when a maintainer merges that PR, which creates the tag and GitHub Release and then triggers the build job. Day-to-day merges therefore never publish by accident.

### Building and publishing

After a release is created, a matrix (Ubuntu, Windows, macOS) builds with `turbo run build`, then `electron-builder` with `--publish never`, and uploads the AppImage, NSIS installer and dmg to the release with `gh release upload`. Publishing is done by `gh` rather than electron-builder so that the release created by release-please is the single source of truth and uploads are idempotent (`--clobber`). Builds are unsigned and not notarized, matching the current `notarize: false`; signing can be added later with repository secrets.

### Version sync

`release-please-config.json` bumps the root `package.json` and, via `extra-files`, the version of every app workspace, so `src/app/package.json` (used for artifact names and `scripts/install-linux.sh`) matches the tag. `.release-please-manifest.json` starts at `0.1.0`.

## Extension releases (issue #25)

Every extension (`extensions/lsp/*`, `extensions/grammars/*`, `extensions/themes/*`, `extensions/locales/*`) is released and versioned separately from the app; the app bundles a few of them from their releases and installs the rest on demand.

### Versioning

Each extension directory is its own release-please package with `component` set to its package name and `include-component-in-tag` on, so tags look like `gepard-ext-csharp-v0.1.1`; the app keeps plain `vX.Y.Z` tags. `separate-pull-requests` gives every package its own release PR, and the root package lists `extensions` in `exclude-paths` so extension-only commits do not bump the app. `.release-please-manifest.json` tracks every package's version. Each extension package bumps its `version` in `extensions/catalog.json` through an `extra-files` JSON update (root-relative path with a leading `/`).

### Catalog

`extensions/catalog.json` lists every extension in the repository: display name, kind, description, path, released version, `platforms` (absent when unrestricted) and `sha` (git tree id of the extension directory). It is imported into the main process at build time; nothing is fetched at runtime. `scripts/refresh-catalog.ts` generates it from the `package.json` of each `extensions/<kind>/<name>` directory, generates the extension packages in `release-please-config.json` and adds missing entries to `.release-please-manifest.json`: `yarn catalog:refresh` writes, `yarn catalog:check` fails when any of the three files is out of date. Adding an extension is adding its package under `extensions/` and running `yarn catalog:refresh`.

### Build pipeline

`release.yml` has three jobs after `release-please`. `extensions-matrix` runs `scripts/extension-release-matrix.ts` (plain Node, no install) over release-please's `paths_released` and per-path `<path>--tag_name` outputs, expanding each released extension by its `gepard.platforms` (`any` when absent) into a job matrix. `build-extensions` checks out the extension's tag, installs, re-vendors the matrix platform's payload with `GEPARD_VENDOR_TARGETS` when the platform is not `any`, runs the turbo build when the package has a `build` script, packs it with `npm pack` (platform-specific archives get a `-<platform>` suffix before `.tgz`) and uploads the archive to the extension's release with `gh release upload --clobber`. All extension builds run on Ubuntu: the vendor scripts download prebuilt servers for any target. `build` (the app) waits for `build-extensions` and is skipped when it fails.

### Bundling

`scripts/bundle-extensions.ts` (`yarn extensions:bundle`, run by the root `build:*` scripts and by the release `build` job before electron-builder) downloads the released tarballs of the four themes and the English locale from GitHub releases by catalog version into `node_modules/.cache/gepard-extensions` and extracts them into `src/app/extensions-dist/<kind>/<name>` (gitignored); `extraResources` copies that directory to `resources/extensions`. It fails when the catalog version differs from the workspace's `package.json` or the extension has platform-specific builds.

### Install and update

Settings lists the catalog with installed and latest version per entry and offers install or update; the IPC call is `extensions.install` with a source of kind `github-release` (`repository`, optional `path`) or `local` (file picker). `src/main/extensions/githubRelease.ts` handles `github-release`: a repository and path matching a catalog entry resolve to the tag `<name>-v<version>` and the asset `<name>-<version>[-<platform>].tgz`; any other repository is listed through `gh api`, optionally narrowed to tags `<name>-v*` where `<name>` comes from `<path>/package.json`, and the newest non-draft, non-prerelease release with a `-<platform>.tgz` or platform-independent `.tgz` asset is used. The asset is downloaded with `gh release download`, extracted with `src/main/helpers/tar.ts` (rejects links and paths outside the destination), checked for a `package.json` with a name and a version (matching the expected name when known) and installed by the registry as `<name>-<version>`, removing any older directory of the same package. A new directory per version sidesteps Node's module cache so the updated code loads without a restart.

## Files

- `.github/workflows/validate.yml`
- `.github/workflows/release.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `extensions/catalog.json`
- `scripts/refresh-catalog.ts`
- `scripts/extension-release-matrix.ts`
- `scripts/bundle-extensions.ts`
- `src/main/extensions/catalog.ts`
- `src/main/extensions/githubRelease.ts`

## Manual setup required

- Settings, Actions, General: allow GitHub Actions to create and approve pull requests (needed by release-please).
- Branch protection or ruleset on `main`: require the `validate` status check and a pull request.
- Note: PRs opened by `GITHUB_TOKEN` do not trigger `validate`; if the release PR must run checks, use a PAT or GitHub App token in the release-please step.
