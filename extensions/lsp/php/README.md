# Gepard PHP extension

PHP language extension for Gepard. Wraps
[PHPantom](https://github.com/PHPantom-dev/phpantom_lsp), a PHP language
server written in Rust, run via `phpantom_lsp --stdio`.

## Requirements

None on the machine. The pinned PHPantom build for the current platform is
downloaded into Gepard's extension data directory the first time a project
with PHP files is opened, verified against the sha256 recorded in
`package.json`, and reused afterwards. The first open therefore needs network
access. No PHP runtime is required; the server embeds its own stubs.

Platforms: Linux x64 and arm64, macOS x64 and arm64, Windows x64 and arm64.

## Behaviour

- The server indexes the project in the background and resolves classes
  through Composer's autoload configuration when a `composer.json` is
  present.
- Line symbols are decoded from `semanticTokens/full`.

## License

This extension's own code is MIT (see `LICENSE`). PHPantom is licensed under
the MIT License.
