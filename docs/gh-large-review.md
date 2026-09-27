## Github large PR review tool
### Tech
- electron desktop app
- `gh` command used to interact with PRs over json<->zod schemas interface
- React 19 dom, Vite, Typescript, Tanstack queries and mutations (hooks), AppContext holding app ui state
- @codemirror editor for code and diff view (read only) 
### Projects (launchpad)
- Start interface for managing projects - selecting one from GitHub url - with prefill from lovely signed `gh` profile.
- When new project is added its cloned into an internal app storage in profile (git hooks are ignored).
- Opened project is indexed in background for symbols and line search patterns.
	- Symbols only if LSP is added as extension. Typescript one should be implemented and enabled by default, local loading matching vs code.
### Main window
- Header panel - targeting:
	- series of fuzzy search select boxes entering: PR, commit, path
		- path accepts a folder prefix or a glob; the select suggests folders
- Side panel - navigation: vertical tabs:
	- file browser - full tree.
	- targeted file browser - limited to targeted files changed (or path targeted). Tree or flat list.
	- search - also called selection - an input fuzzy prefill on detected symbols, exact match or regex (flags for regex and symbol); shows scrollable list of matched files locations with line previews. Tree or flat list. Button to either inclue all files or only targeted ones.
- Main - content:
	- Active file tabs (pinned ones + one switching active file picked from navigation). either file or diff view.
		- Shows inline comments
	- File controls floating panel (default close to top right)
		- Viewed checkbox
		- File comments accordion.
		- Sync button - saves any new comments to `gh`, publishes viewed, pulls remote ones (timestamp based merging into local)
	- Comments tab: chronological view of all threads and replies
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
- Targeting a PR or a commit enables the diff view for all changed files, otherwise file is shown for it.
- Pinned files are preserved open in UI, even when they don't exist in current state -> missing view.
- Selecting a target switches side panel to targeted navigation.
- Changing PR or commit checks out that version in working tree, indexes as needed, fetches remote comments and viewed state.
- A project remembers its last targeting (PR, commit, path) and restores it on next open.
- Any new comments and viewed state is prepared in local copy (timestamped on each entity), synced only on explicit button.
- Comment references can be added by checking them, they get automatically appended to the text when syncing to github, empty newline separated.
### Controls
- `Enter` - Toggle viewed state
- `Up/Down` - navigate files in targeted list for review, skipping viewed\
### Styling
- heavy use of styled components - all dedicated locally defined in React components (any duplication is sign of missing component)
- default fonts
- light and dark theme respecting system preference
- icons from a feathericons react
- minimalist interface like similar software

