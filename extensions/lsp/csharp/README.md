# Gepard C# extension

C# language extension for Gepard. Wraps the Roslyn language server
(`Microsoft.CodeAnalysis.LanguageServer`, https://github.com/dotnet/roslyn),
run via `dotnet Microsoft.CodeAnalysis.LanguageServer.dll --stdio`.

## Requirements

A `dotnet` runtime compatible with the vendored server's target framework
(currently .NET 10) must be on `PATH`. The server is vendored
framework-dependent, not self-contained, so it is not bundled with this
extension.

## Vendoring

`yarn vendor` (also run automatically on `install` via `postinstall`)
downloads the `roslyn-language-server.<rid>` nuget package for each target at
the version pinned in `package.json`'s `gepard.vendor` field, verifies it
against the recorded sha512, and packs its `tools/<framework>/<rid>` output
into `vendor/<target>/`. Targets default to the current platform and can be
set with `GEPARD_VENDOR_TARGETS`. This must be run before the extension can
resolve a launch plan.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Roslyn
language server is separately MIT-licensed by the .NET Foundation and
Contributors - see `UPSTREAM_LICENSE`.
