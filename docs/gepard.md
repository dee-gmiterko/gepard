## Gepard - Great Pull Request Review Tool
### Naming
- id: `gepard`; short: Gepard; full: Gepard - Great Pull Request Review Tool
- repo/web: https://github.com/dee-gmiterko/gepard
### Tech
- electron desktop app
- `gh` command used to interact with PRs over json<->zod schemas interface
- React 19 dom, Vite, Typescript, Tanstack queries and mutations (hooks), AppContext holding app ui state
- @codemirror editor for code and diff view (read only) 
- Localization: all UI text is localizable, English default; a script refreshes every locale from the source strings
- Scripts (media/locale refresh, ...) are Typescript, run directly with `tsx`, no build step; package itself is ESM
### Extensions
- Independent packages, outside the main app bundle's own deps: `extensions/lsp/<name>` (language servers), `extensions/themes/<name>` (colour themes), `extensions/locales/<name>` (UI translations) - each its own manifest (`gepard.type`) and own dependencies.
- Typescript/JavaScript LSP extension is built in and enabled by default, shipping its own native TypeScript LSP inside its package (no workspace-toolchain detection - this is a review tool, not an editor).
- Themes (light/dark, built in) and locales (English, built in) are also shipped this way, not hardcoded in the app; the renderer bakes only a fallback theme template, used before the IPC-fetched theme list has loaded (message default texts live in the code, so no locale catalog is needed at bootstrap).
#### Extension requirements
- Kinds: language server, theme, locale.
- Built-in and user-installed extensions are handled identically.
- Each extension is self-contained: it ships everything it needs to run, with no changes to app code or build configuration.
- Language-specific behavior lives entirely in the language server extension; the app's language handling is language-agnostic.
- Install, enable and disable take effect at runtime, no restart.
- A failing extension does not affect the app or other extensions.
### Projects (launchpad)
- Start interface for managing projects - selecting one from GitHub url - with prefill from lovely signed `gh` profile.
- When new project is added its cloned into an internal app storage in profile (git hooks are ignored).
- Opened project is indexed in background for symbols and line search patterns (symbols only if an LSP extension covers the language).
### Settings
- Fullscreen overlay, opened via a settings icon in the side panel or from the launchpad; not part of the launchpad page itself; closes on the header close button or `Escape`.
- Sections:
	- Theme - single select: Follow system, Light, Dark, plus any installed theme extensions.
	- Language - single select: Follow system (OS/browser-detected), plus each installed locale extension by display name; persisted selection wins over OS detection, applied live without restart.
	- Controls - list of the current global keyboard shortcuts (command name + effective key), sourced from the same binding table `useGlobalKeys` runs, so the list can't drift from actual behavior. Each shortcut can be rebound: click `Rebind`, press the new key (`Escape` cancels), the override is persisted and takes effect immediately, no restart; a `Reset` button clears a customized binding back to its default. If a rebind lands on a key another binding also effectively uses, both rows show a visible conflict note (not a hard block - the earlier-listed binding wins at runtime).
	- Extensions - list of installed extensions (built-in and external), each showing kind (language server/theme/locale), source (built-in/external) badge and an enable/disable checkbox; `Add extension` opens a file picker to install an extension package from disk; shows the install directory path and per-extension load errors.
### Main window
- Header panel - targeting:
	- series of fuzzy search select boxes entering: PR, commit, path
		- path accepts a glob, a folder prefix, an exact file, or a substring anywhere in the path; the select suggests folders
		- path filters live as-you-type (each keystroke updates the target and narrows navigation), not only on Enter/selection
	- `+` next to the PR select opens a New PR modal: base and head branch, title, description; creates the PR immediately and targets it
	- Toggle for the file comments/right panel: shown whenever a PR is targeted and the active file is a changed file.
- Side panel - navigation: vertical tabs:
	- file browser - full tree.
	- targeted file browser - limited to targeted files changed (or path targeted). Tree or flat list.
	- search - also called selection - an input fuzzy prefill on detected symbols, exact match or regex (flags for regex and symbol); shows scrollable list of matched files locations with line previews. Tree or flat list. Button to either inclue all files or only targeted ones.
	- settings icon - opens the settings overlay.
	- Resizable by dragging its right edge; width persisted per project, default 300px.
- Main - content:
	- Active file tabs (pinned ones + one switching active file picked from navigation). either file or diff view.
		- Shows inline comments
		- A newly added file (nothing to diff against) always opens in the plain file (text) view, never diff - an all-green diff carries no information.
	- File controls floating panel (default close to top right)
		- Viewed checkbox
		- Sync button - saves any new comments to `gh`, publishes viewed, pulls remote ones (timestamp based merging into local); also fetches the repo and checks out the targeted PR's latest head if it moved
		- Draggable; position persisted per project, kept clamped inside the viewer area.
	- Right panel (file comments sidebar): closeable, right-hand side, resizable the same way as the side panel (drag edge, width persisted per project); replaces the old floating comments overlay.
		- Opened/closed via the toggle button in the header (moved there from the file controls floating panel).
		- Bottom section: a symbols tree for the active file, LSP-backed via a `symbols.document` IPC call (`LanguageSession.documentSymbols`, `textDocument/documentSymbol`) - shows the document's symbol hierarchy (name + kind), nested when the LSP replies hierarchically; clicking a symbol jumps to its line in the active file (same `file/open`/reveal-line mechanism as comment threads and search results).
	- Comments tab: chronological view of all threads and replies; a composer below the list adds a new general (PR-level, no file/line anchor) comment.
### Components
- Comment editor
	- Comment box
	- References quick selects checkbox + title, marked ones show preview of what it includes opening accordion, then shows button to either inclue all files or only targeted ones
		- `Symbol definition` - each symbol used on the line - can be checked to add reference by file:line
		- Also in - exact match of line - includes list of file:line references
		- Same pattern in
	- Actions: Submit, Delete,..
- File in sidebar
	- Shows changes +- count marks
	- Viewed checkbox
	- Folders show sums & view is applied to all under (respecting shown targeting in that tab)
- Search results
	- Show standard file row + all matches under it, collapsable
- File viewers: code, code diff, image, image diff, missing
- Icon buttons
- ...
### Behaviors
- Each targeting combo box can be individually filled and limit selection in others - setting a PR limits commits to ones from it
- Targeting a PR or a commit enables the diff view for all changed files, otherwise file is shown for it (newly added files always use the file view instead, see above).
- Pinned files are preserved open in UI, even when they don't exist in current state -> missing view.
- Selecting a target switches side panel to targeted navigation.
- Changing PR or commit checks out that version in working tree, indexes as needed, fetches remote comments and viewed state.
- A project remembers its last targeting (PR, commit, path) and restores it on next open.
- Any new comments and viewed state is prepared in local copy (timestamped on each entity), synced only on explicit button.
- Comment references can be added by checking them, they get automatically appended to the text when syncing to github, empty newline separated.
### Controls
- Defaults (rebindable in Settings > Controls, see above):
	- `Space` - Toggle viewed state
	- `PageUp/PageDown` - navigate files in targeted list for review, skipping viewed\
### Styling
- heavy use of styled components - all dedicated locally defined in React components (any duplication is sign of missing component)
- default fonts
- themes: full color templates, with light and dark ones built in and followed by system preference
- icons from a feathericons react
- minimalist interface like similar software

