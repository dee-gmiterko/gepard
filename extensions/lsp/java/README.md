# Gepard Java extension

Java language extension for Gepard. Wraps the
[Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls)
(`jdt.ls`), run via its Equinox OSGi launcher over stdio.

## Requirements

`java` on `PATH`. No JRE is bundled.

## Vendoring

- `yarn vendor`, also run on `postinstall`, downloads the jdt.ls milestone
  tarball pinned in `package.json` under `gepard.vendor`, checks its sha256,
  and packs `plugins/`, `features/` and `config_*` into `vendor/`.
- `yarn upgrade` pins the latest jdt.ls milestone.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Eclipse JDT
Language Server is separately licensed under the Eclipse Public License 2.0;
see `THIRD_PARTY_LICENSES`.
