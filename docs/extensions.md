# Extensions

Extensions add languages, syntax highlighting, colour themes and UI translations to Gepard. Each extension is a self-contained package with its own manifest and dependencies. The host discovers packages in the bundled and user-installed extension directories, validates them and loads the valid ones. A package that fails to load is listed with its error and is otherwise ignored.

## Kinds

| Kind      | `gepard.type` | Contains | Contract                                                  |
| --------- | ------------- | -------- | --------------------------------------------------------- |
| LSP       | `lsp`         | code     | `LanguageExtension` (`@gepard/common`)                    |
| Grammar   | `grammar`     | code     | `GrammarExtension` (`@gepard/common`)                     |
| Theme     | `theme`       | data     | `ThemeExtension` (`@gepard/common`)                       |
| Locale    | `locale`      | data     | `LocaleExtension` (`@gepard/common`)                      |

## Package

The manifest is a `package.json`:

| Field                 | Meaning                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `name`, `version`     | Package identity; `version` is shown in the UI. Installing from a release archive requires both.     |
| `main`                | Entry module; must end in `.js`, `.mjs` or `.cjs`. Default `index.js`.                               |
| `gepard.type`         | One of `lsp`, `grammar`, `theme`, `locale`; selects the kind the package is loaded as.               |
| `gepard.displayName`  | Display name of the package's entry in the catalog of available extensions.                          |
| `gepard.platforms`    | Optional list of supported platforms for the catalog; absent means all platforms.                    |

Each package directory is scanned once. A missing or unknown `gepard.type` is reported as a failed package. The name shown for an installed extension comes from the extension object: `displayName`, or `name` for themes.

## Entry module

The entry module is an ES or CommonJS module. The extension object is its default export, falling back to an `extension` export, falling back to the module namespace. The object is validated structurally against the kind's contract; if it does not match, the package is reported as not exporting a valid extension of that kind.

`lsp` extensions bundle their code and dependencies into the entry module and may ship payload files (for example a language server binary) declared in the manifest's `files`, located relative to the entry module. `grammar` extensions bundle their code into the entry module but not CodeMirror or Lezer, which they receive through `api`. `theme` and `locale` extensions are plain modules with no code to run.

## Language declaration

`lsp` and `grammar` extensions declare `languages`, a non-empty list of:

- `name`: language name.
- `extensions`: non-empty list of file extensions.
- `filenames`: optional list of exact file names.

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

`open` is called once per opened project. `host.dataDir` is a writable directory private to the extension. `sink.status(...)` reports idle, indexing (with phase and progress) or error state; `sink.log(level, message)` forwards log lines.

`LanguageSession` answers `lineSymbols` (file path and line), `definition` and `references` (file path and position), `documentSymbols` (file path) and `workspaceSymbols` (query and limit). Positions and ranges are line/column pairs. Query methods take an optional cancellation token. `filesChanged(changes)` is called with created, changed and deleted paths; `dispose()` must stop all server processes the session started.

`importResolution` (`extensions`, `indexFiles`, `emittedExtensions`) lets the host resolve relative import specifiers to files. `warmupFile` picks the file used to warm up the session from a list of project files.

## Grammar

```ts
interface GrammarExtension {
  id: string;
  displayName: string;
  languages: ExtensionLanguage[];
  support(api: GrammarApi, language: string): Language | LanguageSupport;
}
```

`support` is called per language on demand. The CodeMirror and Lezer building blocks (`StreamLanguage`, `LRLanguage`, `LanguageSupport`, `LRParser`, `styleTags`, `tags`) are passed in as `api`; the package must use them instead of bundling its own copy.

## Theme

A data object: `id`, `name` (shown in the UI), `mode` (`light` or `dark`), optional `contrast` (`normal` or `high`), and required `shadow` (`popover`, `floating`), `colors` and `syntax`. Every value is a non-empty string and every key of `colors` and `syntax` is required; the key sets are defined by `themeExtensionSchema`.

## Locale

A data object: `id`, non-empty `displayName` and `messages`, a map from message id to translated string. Ids missing from the map fall back to the built-in English text.

## Minimal extension

A theme, locale or other data extension needs only a manifest and an entry module:

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

An extension is installed from a local package or from a GitHub release archive, and listed in the catalog of available extensions. Installed extensions are enabled or disabled individually in the settings.
