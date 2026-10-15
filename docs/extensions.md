# Extensions

Extensions add languages, syntax highlighting, colour themes and UI translations. Each is a self-contained package with its own manifest and dependencies. The host scans the bundled and user-installed extension directories once and loads valid packages; failures are listed with their error and otherwise ignored. Contracts are exported from `@gepard/common`.

## Kinds

| Kind    | `gepard.type` | Contains | Contract            |
| ------- | ------------- | -------- | ------------------- |
| LSP     | `lsp`         | code     | `LanguageExtension` |
| Grammar | `grammar`     | code     | `GrammarExtension`  |
| Theme   | `theme`       | data     | `ThemeExtension`    |
| Locale  | `locale`      | data     | `LocaleExtension`   |

## Package

The manifest is `package.json`:

| Field                 | Meaning                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `name`, `version`     | Identity; `version` is shown in the UI. Both required for release-archive installs.     |
| `main`                | Entry module; must end in `.js`, `.mjs` or `.cjs`. Default `index.js`.                               |
| `gepard.type`         | Kind to load as. Missing or unknown fails the package.               |
| `gepard.displayName`  | Catalog entry name.                          |
| `gepard.platforms`    | Optional supported platforms for the catalog; absent means all.                    |

The name shown for an installed extension comes from the extension object: `displayName`, or `name` for themes.

## Entry module

The entry module is ESM or CommonJS. The extension object is the default export, else the `extension` export, else the module namespace, and is validated structurally against the kind's contract; a mismatch fails the package.

`lsp` bundles code and dependencies into the entry module; payload files (e.g. a server binary) are declared in the manifest's `files` and resolved relative to the entry module. `grammar` bundles its code but not CodeMirror or Lezer, which arrive through `api`. `theme` and `locale` are plain data modules.

## Language declaration

`lsp` and `grammar` extensions declare `languages`, a non-empty list of:

- `name`
- `extensions`: non-empty list of file extensions.
- `filenames`: optional exact file names.

## LSP

```ts
interface LanguageExtension {
  id: string;
  displayName: string;
  languages: ExtensionLanguage[];
  importResolution?: ImportResolution;
  warmupFile?(files: string[]): string | undefined;
  open(
    project: { root: string },
    host: { dataDir: string },
    sink: ExtensionEvents,
  ): Promise<LanguageSession>;
}
```

`open` runs once per opened project. `host.dataDir` is a writable directory private to the extension. `sink.status(...)` reports idle, indexing (phase, progress) or error; `sink.log(level, message)` forwards log lines.

`LanguageSession` implements `lineSymbols` (path, line), `definition` and `references` (path, position), `documentSymbols` (path) and `workspaceSymbols` (query, limit). Positions and ranges are line/column pairs; queries take an optional cancellation token. `filesChanged(changes)` receives created, changed and deleted paths; `dispose()` must stop every server process the session started.

`importResolution` (`extensions`, `indexFiles`, `emittedExtensions`) lets the host resolve relative import specifiers. `warmupFile` picks the session warm-up file from the project's files.

## Grammar

```ts
interface GrammarExtension {
  id: string;
  displayName: string;
  languages: ExtensionLanguage[];
  support(api: GrammarApi, language: string): Language | LanguageSupport;
}
```

`support` is called per language on demand. `api` provides `StreamLanguage`, `LRLanguage`, `LanguageSupport`, `LRParser`, `styleTags` and `tags`; use them rather than bundling CodeMirror or Lezer.

## Theme

Data: `id`, `name`, `mode` (`light`|`dark`), optional `contrast` (`normal`|`high`), `shadow` (`popover`, `floating`), `colors`, `syntax`. Values are non-empty strings; all `colors` and `syntax` keys are required, as defined by `themeExtensionSchema`.

## Locale

Data: `id`, non-empty `displayName`, `messages` (message id to string). Missing ids fall back to built-in English.

## Minimal extension

Data extensions (theme shown) need only a manifest and an entry module:

```json
{
  "name": "my-theme",
  "version": "1.0.0",
  "main": "index.mjs",
  "gepard": { "type": "theme", "displayName": "My theme" }
}
```

```js
export default {
  id: 'my-theme',
  name: 'My theme',
  mode: 'dark',
  shadow: { popover: '0 4px 12px #0006', floating: '0 4px 16px #0007' },
  colors: { /* every colour key */ },
  syntax: { /* every syntax key */ },
};
```

A minimal grammar:

```js
export default {
  id: 'my-lang',
  displayName: 'My language',
  languages: [{ name: 'My language', extensions: ['.my'] }],
  support: (api) =>
    new api.LanguageSupport(
      api.StreamLanguage.define({
        token(stream) {
          stream.skipToEnd();
          return null;
        },
      }),
    ),
};
```

A minimal language server extension:

```js
export default {
  id: 'my-lang',
  displayName: 'My language',
  languages: [{ name: 'My language', extensions: ['.my'] }],
  async open(project, host, sink) {
    sink.status({ state: 'idle' });
    return {
      lineSymbols: async () => [],
      definition: async () => [],
      references: async () => [],
      workspaceSymbols: async () => [],
      documentSymbols: async () => [],
      filesChanged() {},
      dispose: async () => {},
    };
  },
};
```

## Distribution

Install from a local package or a GitHub release archive; available extensions are listed in the catalog. Enable or disable each in settings.
