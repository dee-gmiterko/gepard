# Gepard - Great Pull Request Review Tool

Gepard is an Electron desktop app for reviewing large GitHub pull requests.
It drives the `gh` CLI to talk to GitHub, keeps a local working copy of each
project on disk, and gives you a review flow: target a PR, commit, or file
path, browse the diff in a read-only CodeMirror viewer, leave threaded
comments with quick file:line references, and sync everything back to
GitHub when you're ready.

See `docs/gepard.md` for the full product spec.

## Highlights

- **Projects launchpad** - add a project from a GitHub URL (prefilled from
  your signed-in `gh` profile); it's cloned into local app storage with git
  hooks disabled.
- **Targeting** - fuzzy search boxes for PR, commit, and path narrow what's
  shown everywhere else in the app; a `+` next to the PR select opens a New
  PR modal to create and target a PR immediately.
- **Side panel navigation** - full file tree, a tree/list scoped to targeted
  files, and a symbol/text search view (exact, regex, or symbol-aware).
- **Review workspace** - pinned and active file/diff tabs, inline comments,
  a viewed checkbox and comments accordion per file, and a chronological
  comments tab across all threads.
- **Comment editor** - attach quick references (symbol definitions, exact
  matches) to a comment by checking them; they're appended automatically
  when the comment is synced.
- **Explicit sync** - new comments and viewed state are kept locally
  (timestamped) and only pushed to GitHub, and remote state pulled back,
  when you hit Sync.
- **Background indexing** - opened projects are indexed for symbol and line
  search; TypeScript symbol support comes from an LSP extension enabled by
  default.
- Localizable UI (English default) and full colour templates that follow
  the system preference.

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
