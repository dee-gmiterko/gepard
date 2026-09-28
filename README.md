# Gepard - Great Pull Request Review Tool

Gepard is an Electron desktop app for reviewing large GitHub pull requests.
It drives the `gh` CLI to talk to GitHub, keeps a local working copy of each
project on disk, and gives you a review flow: target a PR, commit, or file
path, browse the diff in a read-only CodeMirror viewer, leave threaded
comments with quick file:line references, and sync everything back to
GitHub when you're ready.

See `docs/gepard.md` for the full product spec.

## Highlights

- **Point at a repo, start reviewing** - add a project from its GitHub URL
  (prefilled from your signed-in `gh` account); it's cloned to a local
  working copy so you review real files, not a web diff.
- **Target anything** - fuzzy-narrow the whole app to a PR, a commit, or a
  file/folder/glob path; open a New PR flow to create and target one on the
  spot.
- **Find your way around fast** - browse the full repo, jump straight to
  just the files a target touched, or search by exact text, regex, or
  symbol.
- **Review many files without losing your place** - keep files pinned open,
  read inline comments as you go, mark files viewed, and step through every
  thread and reply across the PR in one chronological view - including
  comments that aren't tied to any file or line.
- **New files read as text, not noise** - a freshly added file opens as
  plain text instead of an all-green diff, so you can actually read it.
- **Comments that carry proof** - attach the exact matching lines or symbol
  definitions a comment refers to; they're appended to it automatically
  when you sync.
- **Nothing reaches GitHub until you say so** - comments and viewed state
  are kept locally and only pushed - and remote changes only pulled - when
  you hit Sync.
- **Instant symbol and text search** - projects are indexed in the
  background as soon as you open them; TypeScript symbol search works out
  of the box, with more languages addable as extensions.
- **Comfortable wherever you work** - localized UI (English by default) and
  full light/dark colour themes that follow your system preference.

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`), installed and authenticated
  (`gh auth login`). Gepard uses it for every GitHub operation: listing your
  repos and PRs, creating PRs, and syncing comments.

## Getting Gepard

Download the latest build for your platform from the project's
[Releases](https://github.com/dee-gmiterko/gepard/releases) page (Windows,
macOS, or Linux AppImage).

Want to build it from source, or work on Gepard itself? See
[CONTRIBUTING.md](CONTRIBUTING.md).
