# Changelog

## [1.0.1](https://github.com/dee-gmiterko/gepard/compare/gepard-ext-typescript-v1.0.0...gepard-ext-typescript-v1.0.1) (2026-10-16)


### Bug Fixes

* skip markdown files in every prettier run ([1d486a3](https://github.com/dee-gmiterko/gepard/commit/1d486a36524d7f4d61bac6175867f6cf0bf088eb))

## 1.0.0 (2026-10-16)


### Features

* add an upgrade command that pins each language server to its latest release ([e90905e](https://github.com/dee-gmiterko/gepard/commit/e90905eef58512a559d918ead163adf25e8d47a5))
* make language servers self-contained extensions and add csharp, java and python support ([d8aa9db](https://github.com/dee-gmiterko/gepard/commit/d8aa9db4ed5d3aa92b92ea767ed629d6bf8652e7))
* pack extensions with npm, bundle them from releases and generate the catalog ([9b370e3](https://github.com/dee-gmiterko/gepard/commit/9b370e31a6252723771d1034d11ae6c405735465))
* release language server extensions separately and install them from a catalog ([4d85574](https://github.com/dee-gmiterko/gepard/commit/4d855747cfc1be51764cba5be0fe6b16ca35d599))
* report imports as imports and resolve import paths in the backend ([5065f28](https://github.com/dee-gmiterko/gepard/commit/5065f2818b11f2a78d6eef0eacf948f8e9adcbc8))


### Bug Fixes

* shut language servers down on switch and quit and avoid requests during restart ([ca8e5f1](https://github.com/dee-gmiterko/gepard/commit/ca8e5f14b47fbca0fa7c1060fcfe64b33ea741b4))
* simplify the language server terminate helper and its callers ([69f6573](https://github.com/dee-gmiterko/gepard/commit/69f6573f83b075187d27624e6bc8dbed5428a6d8))
