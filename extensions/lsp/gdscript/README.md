# Gepard GDScript extension

GDScript language extension for Gepard. Runs the language server built into
the Godot 4 editor, launched headless as
`godot --headless --editor --lsp-port <port> --path <project>`, and talks to
it over TCP.

## Requirements

Godot 4.2 or newer, available on `PATH` as `godot`. The Godot editor is not
vendored.

## Behaviour

- The extension looks for a `project.godot` in the reviewed repository and
  starts one editor for the shallowest one it finds.
- Opening a project makes the editor import it, which writes a `.godot/`
  cache directory into the project and loads any editor plugins the project
  enables.
- Editor settings and caches are kept under Gepard's extension data
  directory, not the user's own Godot configuration.
- The Godot server implements neither `workspace/symbol` nor semantic
  tokens; workspace and line symbols are derived from `documentSymbol` and
  `definition` responses instead.

## License

MIT (see `LICENSE`).
