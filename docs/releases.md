# Releases and CI/CD

## Validation

- Runs on every pull request and on pushes to non-main branches.
- Steps: immutable install, `yarn validate`, `yarn test`; on pull requests also commitlint over the pull request's commit range.
- Runs on Node 24. A newer run on the same ref cancels the older one.
- Blocking requires the `validate` job as a required status check on `main` (repository setting).
- With `CI=true`, tests that launch a real language server are excluded from the extension test suites; all other tests run.

## App releases

- Versioning follows SemVer derived from Conventional Commits: `fix` is patch, `feat` is minor, `!` or `BREAKING CHANGE` is major. Below 1.0.0, breaking changes bump minor and features bump patch.
- Tags are `vX.Y.Z`.
- Every push to `main` updates a standing release pull request that holds the changelog and version bump. Merging it creates the tag and the GitHub Release; nothing else publishes.
- After the release is created, a matrix of Ubuntu, Windows and macOS runners builds the app and uploads the AppImage, NSIS installer and dmg to the release, replacing assets of the same name. Builds are unsigned and not notarized.
- The root package and every app workspace carry the release version.

## Extension releases

Every extension (`extensions/lsp/*`, `extensions/grammars/*`, `extensions/themes/*`, `extensions/locales/*`) is released and versioned independently of the app.

### Versioning

- Each extension is its own release package, named after its package name, with its own release pull request.
- Tags are `<package name>-v<version>`, for example `gepard-ext-csharp-v0.1.1`.
- Commits touching only extensions do not bump the app.
- Each extension's released version is recorded in the catalog.

### Release assets

- One `npm pack` tarball per platform the extension supports, named `<package name>-<version>.tgz`, or `<package name>-<version>-<platform>.tgz` for platform-specific extensions.
- Supported platforms come from the extension's `gepard.platforms`; absent means all platforms.
- Platform-specific tarballs contain the payload for their platform only.
- Extensions with a `build` script are built before packing.

### Catalog

- Lists every extension in the repository: display name, kind, description, path, released version, supported platforms (absent when unrestricted) and a git tree id of the extension directory.
- Is compiled into the app; nothing is fetched at runtime.
- Is generated from the extension packages, together with the release package configuration and the version manifest. `yarn catalog:refresh` writes them; `yarn catalog:check` fails when any is out of date.
- Adding an extension is adding its package and running `yarn catalog:refresh`.

### Bundling

- The packaged app contains the four themes and the English locale, each as a directory named after its package holding the package manifest and the files it publishes.
- Bundled extensions are taken from the workspace, not downloaded.
- Run by `yarn extensions:bundle` before packaging.

### Install and update

- Settings lists the catalog with installed and latest version per entry and offers install or update.
- Install sources: a GitHub release (repository, optional path) or a local package file.
- A catalog entry resolves to the release tagged `<package name>-v<version>` and the tarball for the current platform.
- Any other repository resolves to its newest published release (no drafts, no prereleases) with a tarball for the current platform; with a path, only releases tagged with the package name found at that path are considered.
- The tarball is extracted without links or paths escaping the destination, must contain a `package.json` with name and version, and is installed as `<package name>-<version>`. Older installed versions of the same package are removed. Updates load without restart.

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

- Settings, Actions, General: allow GitHub Actions to create and approve pull requests.
- Branch protection or ruleset on `main`: require the `validate` status check and a pull request.
- Pull requests opened with `GITHUB_TOKEN` do not trigger `validate`; a personal access token or GitHub App token is required for the release pull request to run checks.
