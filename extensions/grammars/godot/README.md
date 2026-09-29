# Gepard Godot grammar extension

Syntax highlighting for Godot projects in Gepard's code view:

| Language   | File types                                                |
| ---------- | --------------------------------------------------------- |
| GDScript   | `.gd`                                                     |
| GDResource | `.tscn`, `.tres`, `.godot`, `.import`, `.gdns`, `.gdnlib` |
| GDShader   | `.gdshader`, `.gdshaderinc`                               |

The three languages are CodeMirror stream parsers ported from the TextMate
grammars of the [godot-tools](https://github.com/godotengine/godot-vscode-plugin)
VS Code extension.

## Building

```bash
yarn build
```

bundles `index.ts` into a single dependency-free ES module at
`dist/index.js`. The module's `support(api, language)` receives Gepard's own
CodeMirror modules and returns the language built from them, so no CodeMirror
code is included in the bundle.

## Limitations

Script and shader sources embedded in resource files are highlighted as the
strings they are, not as GDScript or GDShader.

## License

This extension's own code is MIT (see `LICENSE`). The grammar rules are
derived from godot-tools, MIT, see `THIRD_PARTY_LICENSES`.
