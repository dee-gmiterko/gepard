# Gepard PHP extension

PHP language extension for Gepard. Wraps
[PHPantom](https://github.com/PHPantom-dev/phpantom_lsp), run via
`phpantom_lsp --stdio`.

## Requirements

No PHP runtime is needed.

## Server binary

- Opening a PHP project downloads the PHPantom build pinned in `package.json`
  under `gepard.vendor` into the extension data directory and checks its
  sha256. The first open needs network access.
- Platforms: Linux, macOS and Windows, each x64 and arm64.
- `yarn upgrade` pins the latest PHPantom release.

## Behaviour

- Semantic tokens run in `full` mode, set by a `.phpantom.toml` in the
  extension data directory. Nothing is written to the project.
- A session opens once PHPantom finishes its initial index, or after 60
  seconds.
- Classes resolve through Composer autoload when `composer.json` is present.

## License

This extension's own code is MIT (see `LICENSE`). PHPantom is MIT licensed.
