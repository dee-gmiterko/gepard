# Changelog

## [0.1.2](https://github.com/dee-gmiterko/gepard/compare/v0.1.1...v0.1.2) (2026-10-09)


### Features

* add a c and c++ language server extension ([2c6d1ec](https://github.com/dee-gmiterko/gepard/commit/2c6d1ec36888b259c4597ab440b76d98f45125e9))
* add a file controls menu to toggle line wrapping and a full file view with changes ([f4ed93c](https://github.com/dee-gmiterko/gepard/commit/f4ed93c586ec7366b2646e2515d6a630967ecce2))
* add a language servers status popup above settings in the side panel ([8212474](https://github.com/dee-gmiterko/gepard/commit/8212474212492a7da5672c2ee36785fabbd112d7))
* add a php language server extension ([652a38e](https://github.com/dee-gmiterko/gepard/commit/652a38ec2a1fae58104f6839cb37b9c683ca1855))
* add an upgrade command that pins each language server to its latest release ([e90905e](https://github.com/dee-gmiterko/gepard/commit/e90905eef58512a559d918ead163adf25e8d47a5))
* allow local comments without a pull request and compose them into a new issue ([43180a8](https://github.com/dee-gmiterko/gepard/commit/43180a8c22381887d87d8a1113d2c3b5fb2d6da8))
* block opening a project already open in another window and focus that window ([1150a94](https://github.com/dee-gmiterko/gepard/commit/1150a948438557f3b804f72c9f0c604e86811a20))
* disable a launchpad project while its new window is starting ([4dd59f2](https://github.com/dee-gmiterko/gepard/commit/4dd59f2b425ff6f772bb299b681bab19870fa1bc))
* launch a new instance without a project from a ctrl click on the header logo ([ed634d8](https://github.com/dee-gmiterko/gepard/commit/ed634d882c22632fc55f38b8fe1577ec99b3229c))
* open a project from a positional argument and launch a detached instance with ctrl click ([fd80fd9](https://github.com/dee-gmiterko/gepard/commit/fd80fd99587f6dda9d26ebeaa65f40b9134aa4ea))
* open the first unviewed file when starting a pull request review ([ebb7e1a](https://github.com/dee-gmiterko/gepard/commit/ebb7e1a83d389c61efed760a1aec111ecfe1038f))
* replace the projects button in the header with the logo ([785d64c](https://github.com/dee-gmiterko/gepard/commit/785d64c94b370ccfb4ddb8525045df8998302a3d))
* split the pull requests overview into open awaiting, open reviewed and closed tabs ([5bee8ad](https://github.com/dee-gmiterko/gepard/commit/5bee8ad89f64a85b1a6cf101ebcdc045de9a4662))
* support pull requests from forks and fix git history and sync results ([119b19d](https://github.com/dee-gmiterko/gepard/commit/119b19d056757d3bbaaf3b95042779398c3516c6))
* truncate long pull request titles and size overview table columns to their content ([a8d1de1](https://github.com/dee-gmiterko/gepard/commit/a8d1de11ff4da9403b8e885671c15ba7ffbd6904))
* use an arrow up icon for composing an issue ([41fe668](https://github.com/dee-gmiterko/gepard/commit/41fe6683923540c820d9312e9d664b2a76c2df8d))
* wrap long lines in the diff view too ([bba89cd](https://github.com/dee-gmiterko/gepard/commit/bba89cd3d29150af963eb1fe6b71f7ac73fcf083))


### Bug Fixes

* correct sync results, labels, combobox, comments and matching in the renderer ([aab712d](https://github.com/dee-gmiterko/gepard/commit/aab712d7e1a5450ad8683316c3756d6e8c6831a2))
* follow the selected locale outside the react tree without a global translator ([f043b47](https://github.com/dee-gmiterko/gepard/commit/f043b479fd5f266947171c390d41311dca53eaf9))
* guard repository paths with path resolution instead of a pattern ([7aabdf6](https://github.com/dee-gmiterko/gepard/commit/7aabdf613205d52d538ced1b83d17a8e75d76b5f))
* keep newer viewed toggles from being overwritten and flashing back in the tree ([a913023](https://github.com/dee-gmiterko/gepard/commit/a913023c633ffa20061565a96c59f449b8d6ffe4))
* keep store updates from being lost across instances and tolerate bad project entries ([1604e4f](https://github.com/dee-gmiterko/gepard/commit/1604e4f4ba0c57d5a2aee2dfd070719aaa0de129))
* keep the diff scoped to the selected commit when a pull request is targeted ([ca41ba3](https://github.com/dee-gmiterko/gepard/commit/ca41ba39afde54856260ca9da48ce2947162fc53))
* match code owner patterns and search result spans correctly ([1606d7a](https://github.com/dee-gmiterko/gepard/commit/1606d7a377e87b704f83ee73a2bda83d5c4865ef))
* pin the java language server to a checksummed milestone release ([b2deb5c](https://github.com/dee-gmiterko/gepard/commit/b2deb5c7d0e89f0f9308e88a82564feb111b754d))
* post a line comment outside the diff as a file comment when github returns no thread ([77003fc](https://github.com/dee-gmiterko/gepard/commit/77003fc6bf713ab6a130adaf6d1ccbfce43cfd44))
* show no matches in the search results instead of in combo boxes ([939b9e9](https://github.com/dee-gmiterko/gepard/commit/939b9e9d16a24413a3245818094004319fa4d43d))
* shut language servers down on switch and quit and avoid requests during restart ([ca8e5f1](https://github.com/dee-gmiterko/gepard/commit/ca8e5f14b47fbca0fa7c1060fcfe64b33ea741b4))
* shut the clangd server down cleanly and avoid requests during restart ([1d628f0](https://github.com/dee-gmiterko/gepard/commit/1d628f01f7358b0d2f2c6c69484061de6fda4e02))
* simplify the language server terminate helper and its callers ([69f6573](https://github.com/dee-gmiterko/gepard/commit/69f6573f83b075187d27624e6bc8dbed5428a6d8))
* skip release-please pull requests in the test merge script ([dbfed47](https://github.com/dee-gmiterko/gepard/commit/dbfed47865901f9360c3d337b5acdad37b45e0b7))
* stop highlighting the modulo operator as a node reference in gdscript ([1b8b2f3](https://github.com/dee-gmiterko/gepard/commit/1b8b2f3bc0d61438f650f8870470e8fd33b6fc21))
* translate error headlines and gutter labels with the selected locale ([bfc9b1c](https://github.com/dee-gmiterko/gepard/commit/bfc9b1cb9642ee29d5e12677a3246a94e3dd693b))
* vendor the per-platform roslyn language server from nuget with checksums ([48d1918](https://github.com/dee-gmiterko/gepard/commit/48d1918a4566d5fb88193cbd4e9cda8a14463bd7))


### Performance Improvements

* make launchpad rows independent, split the search input and drop per-percentage styles ([33dab6a](https://github.com/dee-gmiterko/gepard/commit/33dab6acce41c14efa880c88b4271f2fdabcbb1c))
* render the file tree virtually and keep row data apart from its structure ([9f1f40f](https://github.com/dee-gmiterko/gepard/commit/9f1f40f2bcf6319eaa08f756774859fb947f435c))
* stop the code editor, resizable panels and virtual list from re-rendering needlessly ([5aca338](https://github.com/dee-gmiterko/gepard/commit/5aca338c3caeb6659de3cd73b2a4f89f42a974e7))

## [0.1.1](https://github.com/dee-gmiterko/gepard/compare/v0.1.0...v0.1.1) (2026-10-04)


### Features

* review pull requests in a full local clone of the repository
* target the review scope by pull request, commit or path
* review files from the keyboard with viewed tracking and pinned files
* search the whole repository by text, regex or symbol
* support TypeScript, Python, Java, C# and GDScript language servers
* add inline, file and general pull request comments with code references
* sync comments and viewed state with GitHub in one step
* show an overview of the project and the selected pull request
* install theme, locale, grammar and language server extensions without a restart
* allow rebinding keyboard shortcuts
* build for Windows, macOS and Linux
