# Gepard Python extension

Python language extension for Gepard. Wraps
[Pyright](https://github.com/microsoft/pyright), Microsoft's own Python type
checker and language server (the engine behind Pylance in VS Code), run via
`pyright-langserver --stdio`.

## Requirements

None. Pyright is pure JavaScript and is vendored in full; no Python
installation is required.

## Vendoring

`yarn vendor` (also run automatically on `install` via `postinstall`) packs
the installed `pyright` npm package's `dist/` output into `vendor/`. This
must be run before the extension can resolve a launch plan.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Pyright
payload carries its own upstream MIT license, copied into `vendor/` as
`LICENSE.txt` alongside the packed payload.
