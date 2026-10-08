# Gepard Java extension

Java language extension for Gepard. Wraps the
[Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls)
(`jdt.ls`), run via its Equinox OSGi launcher over stdio.

## Requirements

`java` must be on `PATH`. No JRE is bundled with this extension - jdt.ls's
jars are platform-independent, but a JVM to run them is not vendored.

## Vendoring

`yarn vendor` (also run automatically on `install` via `postinstall`)
downloads the jdt.ls milestone tarball pinned in `package.json`'s
`gepard.vendor` field, verifies it against the recorded sha256, and packs `plugins/`, `features/`,
and the per-platform `config_*` directories into `vendor/`. This must be run
before the extension can resolve a launch plan.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Eclipse JDT
Language Server is separately licensed under the Eclipse Public License 2.0;
see `THIRD_PARTY_LICENSES`.
