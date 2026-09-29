# Gepard C# extension

C# language extension for Gepard. Wraps the Roslyn language server
(`Microsoft.CodeAnalysis.LanguageServer`, https://github.com/dotnet/roslyn),
run via `dotnet Microsoft.CodeAnalysis.LanguageServer.dll --stdio`.

## Requirements

A `dotnet` runtime compatible with the vendored server's target framework
(currently .NET 9) must be on `PATH`. The server is vendored
framework-dependent, not self-contained, so it is not bundled with this
extension.

## Vendoring

`yarn vendor` (also run automatically on `install` via `postinstall`)
downloads the `Microsoft.CodeAnalysis.LanguageServer.neutral` nuget package
and packs its `lib/net9.0` output into `vendor/`. This must be run before the
extension can resolve a launch plan.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Roslyn
language server is separately MIT-licensed by the .NET Foundation and
Contributors - see `UPSTREAM_LICENSE`.
