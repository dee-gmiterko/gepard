# Changelog

## [1.0.1](https://github.com/dee-gmiterko/gepard/compare/gepard-ext-csharp-v1.0.0...gepard-ext-csharp-v1.0.1) (2026-10-30)


### Bug Fixes

* skip markdown files in every prettier run ([1d486a3](https://github.com/dee-gmiterko/gepard/commit/1d486a36524d7f4d61bac6175867f6cf0bf088eb))

## 1.0.0 (2026-10-16)


### Features

* make language servers self-contained extensions and add csharp, java and python support ([d8aa9db](https://github.com/dee-gmiterko/gepard/commit/d8aa9db4ed5d3aa92b92ea767ed629d6bf8652e7))
* pack extensions with npm, bundle them from releases and generate the catalog ([9b370e3](https://github.com/dee-gmiterko/gepard/commit/9b370e31a6252723771d1034d11ae6c405735465))
* release language server extensions separately and install them from a catalog ([4d85574](https://github.com/dee-gmiterko/gepard/commit/4d855747cfc1be51764cba5be0fe6b16ca35d599))


### Bug Fixes

* keep the csharp language server's build logs out of the reviewed repository ([74ee97e](https://github.com/dee-gmiterko/gepard/commit/74ee97eb6ca51a5eb3fa2549bc8f903884346d07))
* shut language servers down on switch and quit and avoid requests during restart ([ca8e5f1](https://github.com/dee-gmiterko/gepard/commit/ca8e5f14b47fbca0fa7c1060fcfe64b33ea741b4))
* simplify the language server terminate helper and its callers ([69f6573](https://github.com/dee-gmiterko/gepard/commit/69f6573f83b075187d27624e6bc8dbed5428a6d8))
* skip language server lookups for files missing from the checked-out worktree ([e9e423c](https://github.com/dee-gmiterko/gepard/commit/e9e423ca619432be08fed7bf5a11742860fbd9ca))
* vendor the per-platform roslyn language server from nuget with checksums ([48d1918](https://github.com/dee-gmiterko/gepard/commit/48d1918a4566d5fb88193cbd4e9cda8a14463bd7))
