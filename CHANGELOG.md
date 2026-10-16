# Changelog

## [0.1.3](https://github.com/dee-gmiterko/gepard/compare/v0.1.2...v0.1.3) (2026-10-16)


### Features

* add a randomize order toggle for stepping through files ([e95c1f8](https://github.com/dee-gmiterko/gepard/commit/e95c1f8e0031a8ee11d552b56c3792351baf3db6))
* add a refresh button with a pending sync count to the header ([362dae8](https://github.com/dee-gmiterko/gepard/commit/362dae8c65e4dfffe807d8ca31ea4cd58997f129))
* add high contrast theme variants that follow the system preference ([47c3cb8](https://github.com/dee-gmiterko/gepard/commit/47c3cb8706f59eeb341e3aabbad66cc2d682c199))
* cap panel widths by available space and declare the responsive viewport ([b14c408](https://github.com/dee-gmiterko/gepard/commit/b14c408df85da6477cb95d7abb748a3e9172da76))
* detect connection failures and show an offline indicator ([792c95b](https://github.com/dee-gmiterko/gepard/commit/792c95b762c627a252b61cdd105752a687747871))
* hide editor line numbers at wider widths ([45c0066](https://github.com/dee-gmiterko/gepard/commit/45c0066b9e64e056f53e5974a98c0b9d2e63db51))
* let the left sidebar close by clicking its active tab ([9215465](https://github.com/dee-gmiterko/gepard/commit/921546575940fbcc818bcb12196fa2a44f4c1e5a))
* let the merged test script include or exclude specific pull requests ([507068f](https://github.com/dee-gmiterko/gepard/commit/507068ff6a47b718a63542e7758c4a4f52ce5d37))
* link the overview file types to their extension paths ([ace6606](https://github.com/dee-gmiterko/gepard/commit/ace66069c9315aa5ed498f7ed5bc7b94b167f005))
* load the pull request overview progressively with skeleton placeholders ([114c2f9](https://github.com/dee-gmiterko/gepard/commit/114c2f9294c5e063d02f5113a215d276f49a6710))
* make content responsive to container size instead of fixed widths ([a05cc06](https://github.com/dee-gmiterko/gepard/commit/a05cc0608270146f00baafe5d87066419a2da179))
* navigate to definitions and imported files with ctrl click in code views ([92cdcfd](https://github.com/dee-gmiterko/gepard/commit/92cdcfdd35b85e52165c08f2bdee3ab0391f10ad))
* pack extensions with npm, bundle them from releases and generate the catalog ([9b370e3](https://github.com/dee-gmiterko/gepard/commit/9b370e31a6252723771d1034d11ae6c405735465))
* redesign settings overlay with a tab list and two-column extensions ([1b279d3](https://github.com/dee-gmiterko/gepard/commit/1b279d3393e1b38cf08309a5307840a505086e11))
* release language server extensions separately and install them from a catalog ([4d85574](https://github.com/dee-gmiterko/gepard/commit/4d855747cfc1be51764cba5be0fe6b16ca35d599))
* report imports as imports and resolve import paths in the backend ([5065f28](https://github.com/dee-gmiterko/gepard/commit/5065f2818b11f2a78d6eef0eacf948f8e9adcbc8))
* run as a server that serves the ui and bridges ipc over a websocket ([6ad207c](https://github.com/dee-gmiterko/gepard/commit/6ad207cd4b7bf0374e61491b0ccb544097cf3523))
* show moved binary and image files without a diff and merge the binary components ([d3c1114](https://github.com/dee-gmiterko/gepard/commit/d3c1114bf690131b9bc4baec7287bd238ae9f094))
* show pipeline failure annotations per file and attach them to line comments ([50e26d0](https://github.com/dee-gmiterko/gepard/commit/50e26d0391adb4bdae628f26dcd3568e853221c6))
* show size details for binary files and binary diffs ([9486595](https://github.com/dee-gmiterko/gepard/commit/9486595b1f6b07acea5b8331a6c3bc9027c9a2e1))
* show the diff since the last reviewed commit of a file ([a1aed04](https://github.com/dee-gmiterko/gepard/commit/a1aed04111c91330b66309b54587cc3d08c04647))
* size overlays from their container and keep popups above panels ([245a0e5](https://github.com/dee-gmiterko/gepard/commit/245a0e5802a2de32061ebfc0f4db0e4bdab85f73))
* step through find matches with buttons and arrow keys ([2f9af8b](https://github.com/dee-gmiterko/gepard/commit/2f9af8b77f5fbbfce79ebe621375b1d93ebd901f))


### Bug Fixes

* cache the validate task ([a8f8ca4](https://github.com/dee-gmiterko/gepard/commit/a8f8ca4f541ef9b7c405d3c97d4d1e87e973e61e))
* cap the header refresh badge at 99+ ([2a19608](https://github.com/dee-gmiterko/gepard/commit/2a19608034f15cf62b1d6e17f595af36cca69d5c))
* follow the system reduced motion preference and trim narrating comments ([9234d3e](https://github.com/dee-gmiterko/gepard/commit/9234d3e5475f97498fbb220404a7b7fa6bffe8db))
* give each extensions message its own id and correct the extension docs ([d7b2757](https://github.com/dee-gmiterko/gepard/commit/d7b27574a4ead38e6f07233a4ff09672d367a3f7))
* keep selections visible, honor configured keys and move diff doc building to helpers ([875284f](https://github.com/dee-gmiterko/gepard/commit/875284fe2f8fcc1868b9e75655e46e20f9fbc7ed))
* keep the code editor mounted when a file is marked viewed ([4ca64aa](https://github.com/dee-gmiterko/gepard/commit/4ca64aac1e6e67d363ac3525b6dd0e879340ac43))
* keep the floating file controls inside the viewer when it resizes ([861e89e](https://github.com/dee-gmiterko/gepard/commit/861e89e89b041448adbabb84a57676a9adfcaaf0))
* load commit annotations through the gh client ([8e64e96](https://github.com/dee-gmiterko/gepard/commit/8e64e9652ee168b981079c3e4827bbf071b6669e))
* make comment submit and find stepping keybinding actions and keep comment drafts ([b524c59](https://github.com/dee-gmiterko/gepard/commit/b524c5972434158123932ad098d284a2430c0626))
* make mark all viewed the primary action and include the current file ([960a1c0](https://github.com/dee-gmiterko/gepard/commit/960a1c03e744ab2ca91f293bcb23ebc25be5fb88))
* post comments on unchanged files as general comments with a file reference ([cd7dac1](https://github.com/dee-gmiterko/gepard/commit/cd7dac11402f9be2fac36708c741e9cf7c79c01b))
* show connection failures as a minimal deduplicated warning toast ([9969e6a](https://github.com/dee-gmiterko/gepard/commit/9969e6ad7bb99541302bae36f5c1f21176c575f0))
* shrink the header sync badge font ([bb4a81e](https://github.com/dee-gmiterko/gepard/commit/bb4a81e19c97ce548402087348d1b4ed78e3b56b))
* skip markdown files in every prettier run ([1d486a3](https://github.com/dee-gmiterko/gepard/commit/1d486a36524d7f4d61bac6175867f6cf0bf088eb))
* step through find matches with keybinding actions and keep the function key shortcuts ([306762c](https://github.com/dee-gmiterko/gepard/commit/306762c041b001291933604ecfa77b980beb468c))
* stop seeding extensions in the release manifest so they get a first release ([3272948](https://github.com/dee-gmiterko/gepard/commit/3272948e68cdc1f384392e49db3398a471b8c930))
* submit comments with ctrl enter ([1d381ef](https://github.com/dee-gmiterko/gepard/commit/1d381ef7bd153190b9febce1e72424698aa6b506))

## [0.1.2](https://github.com/dee-gmiterko/gepard/compare/v0.1.1...v0.1.2) (2026-10-09)

Greater project variety support, performance improvements.

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
