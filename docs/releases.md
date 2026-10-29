# Releases and CI/CD

## Validation

- Runs on every pull request and on pushes to non-main branches other than release branches. A newer run on the same ref cancels the older one.
- Checks the project, generated files, the extension catalog and tests, and on pull requests also the commit messages.
- Tests that launch a real language server are excluded in CI; all other tests run.
- Merging requires the validation to pass (repository setting).

## App releases

- Versioning follows SemVer derived from Conventional Commits: fixes are patch, features are minor, breaking changes are major. Below 1.0.0, breaking changes bump minor and features bump patch.
- Every push to the main branch updates a standing release pull request holding the changelog and version bump. Merging it creates the tag and the GitHub Release; nothing else publishes.
- After the release is created, Ubuntu, Windows and macOS runners build the app and upload the AppImage, Windows installer and dmg to the release, replacing assets of the same name. Builds are unsigned and not notarized.
- The root package and every app package carry the release version.
- Before the app is built, a check fails the release unless every catalog entry has a published release, tagged for its package, whose extension tree matches the catalogued sha and that carries an archive for each supported platform.

## Extension releases

Every extension is released and versioned independently of the app.

### Versioning

- Each extension has its own release pull request, changelog and tag that includes its package name.
- Commits touching only extensions do not bump the app.

### Release assets

- Each release carries one packed archive per platform the extension supports; extensions without platform restrictions carry a single archive.
- Supported platforms come from the extension's manifest; absent means all platforms.
- Platform-specific archives contain the payload for their platform only.
- Extensions with a build step are built before packing.

### Catalog

- Lists every extension in the repository with its package name, source repository and location, display name, kind, description, supported platforms (absent when unrestricted) and a content identifier of the extension.
- Carries no versions.
- Is compiled into the app; nothing is fetched at runtime.
- Is generated from the extension packages together with the release configuration; a check fails when generated output is out of date.
- Adding an extension is adding its package and regenerating.

### Bundling

- The packaged app contains the four themes and the English locale, each in a directory named after its package holding the manifest and the files it publishes.
- Bundled extensions are taken from the workspace, not downloaded.
- Bundling runs before packaging.

### Install

- Settings lists the catalog and offers installation of entries that are not built in, not installed and supported on the current platform. The installed version shown comes from the installed package.
- Install sources: a GitHub release (repository, optional path) or a local package file.
- A catalog entry resolves to its newest published release tagged for that package that has an archive for the current platform.
- Any other repository resolves to its newest published release (no drafts, no prereleases) with an archive for the current platform; with a path, only releases tagged for the package found at that path are considered.
- The archive is extracted without links or paths escaping the destination, must contain a manifest with name and version, and must match the expected package when one is known.
- Installed extensions live in one folder, one directory per package. Installing a package that is already installed replaces it. Installed extensions load without restart.

## Manual setup required

- Settings, Actions, General: allow GitHub Actions to create and approve pull requests.
- Branch protection or ruleset on `main`: require the validation status check and a pull request.
- Pull requests opened with `GITHUB_TOKEN` do not trigger validation; a personal access token or GitHub App token is required for the release pull request to run checks.
