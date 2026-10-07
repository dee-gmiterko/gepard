# Gepard C/C++ extension

C and C++ language extension for Gepard. Wraps [clangd](https://clangd.llvm.org/),
the LLVM project's language server, run via `clangd` over stdio.

## Requirements

None on the machine. The pinned clangd build for the current platform is
downloaded into Gepard's extension data directory the first time a project
with C or C++ files is opened, verified against the sha256 recorded in
`package.json`, and reused afterwards. The first open therefore needs network
access.

Platforms: Linux x64, macOS x64 and arm64, Windows x64 (official clangd
releases from GitHub), Linux arm64 and Windows arm64 (clangd wheels from
PyPI).

## Behaviour

- clangd only indexes the project when it has a compilation database. If the
  repository contains a `compile_commands.json` (in its root, a `build*`,
  `out` or `cmake-build-*` directory) that file is copied into the extension
  data directory and used. Otherwise one is synthesized there with an entry
  per source file, standard language flags and `-I` for the repository root,
  every `include` directory and every directory containing headers.
- clangd runs with `--compile-commands-dir` pointing at that data directory,
  so its index cache also lives there rather than inside the reviewed
  repository.
- Line symbols are decoded from `semanticTokens/full`; clangd does not serve
  range requests.

## License

This extension's own code is MIT (see `LICENSE`). clangd is licensed under
the Apache License 2.0 with LLVM exceptions; the downloaded archive carries
its own license file.
