# Releases and CI/CD

## Requirements (issue #5)

- GitHub Actions pipelines using current tooling.
- Validation on branches, blocking pull requests.
- Automatic release from `main` with a decided trigger and versioning scheme.

## Findings from exploring the repo

- Yarn 4 workspaces plus Turborepo; `yarn validate` (typecheck, lint, format check, locale check) and `yarn test` are the quality gates.
- Commits already follow Conventional Commits, enforced locally by husky and commitlint.
- Packaging is electron-builder in `src/app` (AppImage, NSIS, dmg), with a `github` publish provider already configured.
- All five app workspaces share version `0.1.0`; `src/app/package.json` is the one electron-builder uses for artifact names. No tags exist yet.

## Tooling versions (checked October 2026)

GitHub forced Node 24 for actions runtimes in 2026, so only Node 24 majors are used: `actions/checkout@v7`, `actions/setup-node@v7`, `googleapis/release-please-action@v5`. Node 24 is used for the project itself.

## Decisions

### Validation

`.github/workflows/validate.yml` runs on every pull request and on pushes to non-main branches: `yarn install --immutable`, `yarn validate`, `yarn test`, and on pull requests also commitlint over the PR commit range (CI has no husky hooks, so this closes the gap). Blocking is achieved by marking the `validate` job as a required status check in a branch protection rule or ruleset for `main`; this is a repository setting and cannot be committed. Superseded runs on the same ref are cancelled.

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

## Files

- `.github/workflows/validate.yml`
- `.github/workflows/release.yml`
- `release-please-config.json`
- `.release-please-manifest.json`

## Manual setup required

- Settings, Actions, General: allow GitHub Actions to create and approve pull requests (needed by release-please).
- Branch protection or ruleset on `main`: require the `validate` status check and a pull request.
- Note: PRs opened by `GITHUB_TOKEN` do not trigger `validate`; if the release PR must run checks, use a PAT or GitHub App token in the release-please step.
