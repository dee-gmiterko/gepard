# Gepard C# extension

C# language extension for Gepard. Wraps the Roslyn language server
(`Microsoft.CodeAnalysis.LanguageServer`, https://github.com/dotnet/roslyn),
run via `dotnet Microsoft.CodeAnalysis.LanguageServer.dll --stdio`.

## Requirements

.NET 10 runtime with `dotnet` on `PATH`.

## Vendoring

- `yarn vendor`, also run on `postinstall`, downloads
  `roslyn-language-server.<rid>` from nuget.org at the version pinned in
  `package.json` under `gepard.vendor`, checks its sha512, and packs
  `tools/<framework>/<rid>` into `vendor/<target>/`.
- Targets are the current platform, or the comma-separated list in
  `GEPARD_VENDOR_TARGETS`.
- `yarn upgrade` pins the latest version on nuget.org.

## License

This extension's own code is MIT (see `LICENSE`). The vendored Roslyn
language server is separately MIT-licensed by the .NET Foundation and
Contributors - see `UPSTREAM_LICENSE`.
