# Changelog

## 1.0.0 (2026-10-16)


### Features

* add a case sensitivity toggle to search and match case-insensitively by default ([513434e](https://github.com/dee-gmiterko/gepard/commit/513434e78dc569b7709c0c2f694a26f34fd181ee))
* add a file controls menu to toggle line wrapping and a full file view with changes ([f4ed93c](https://github.com/dee-gmiterko/gepard/commit/f4ed93c586ec7366b2646e2515d6a630967ecce2))
* add a language servers status popup above settings in the side panel ([8212474](https://github.com/dee-gmiterko/gepard/commit/8212474212492a7da5672c2ee36785fabbd112d7))
* add a randomize order toggle for stepping through files ([e95c1f8](https://github.com/dee-gmiterko/gepard/commit/e95c1f8e0031a8ee11d552b56c3792351baf3db6))
* add a toggle to hide viewed files from the targeted file browser ([ab8fb1f](https://github.com/dee-gmiterko/gepard/commit/ab8fb1f73d55d2183636cade749ff0837c91f5ce))
* add a wrap long lines toggle with a header status message ([fc65872](https://github.com/dee-gmiterko/gepard/commit/fc65872211d36e52b44e594617f5fdbcc7abab11))
* add an overview view for the project and for the selected pull request ([c29bf9c](https://github.com/dee-gmiterko/gepard/commit/c29bf9cc2179b2b9cbec766fc9157519516552a6))
* add grammar extensions for syntax highlighting with a built-in godot grammar ([3472d27](https://github.com/dee-gmiterko/gepard/commit/3472d27cfbce7cb183e7ed723147878a8f182a7f))
* add high contrast theme variants that follow the system preference ([47c3cb8](https://github.com/dee-gmiterko/gepard/commit/47c3cb8706f59eeb341e3aabbad66cc2d682c199))
* add language and keybindings settings panels ([4a8a7b8](https://github.com/dee-gmiterko/gepard/commit/4a8a7b8ddcdabb6289fddff54f8b0b37fdfb1216))
* add mass actions for matching changes and refine inline comment reference patterns ([893c6fa](https://github.com/dee-gmiterko/gepard/commit/893c6fa2fbdbb9c3e31b9b534a0ad1cc02dc9bfd))
* add previous, revert, approve and next file buttons above sync ([ccbdd0f](https://github.com/dee-gmiterko/gepard/commit/ccbdd0f95f9f25234fd7e7fb512aa9fe7b7034aa))
* allow local comments without a pull request and compose them into a new issue ([43180a8](https://github.com/dee-gmiterko/gepard/commit/43180a8c22381887d87d8a1113d2c3b5fb2d6da8))
* allow rebinding keyboard shortcuts in settings ([ee2216f](https://github.com/dee-gmiterko/gepard/commit/ee2216f37f73fc6ddb94f24b7d5ef526aaabf4e3))
* block opening a project already open in another window and focus that window ([1150a94](https://github.com/dee-gmiterko/gepard/commit/1150a948438557f3b804f72c9f0c604e86811a20))
* consolidate settings into one store and add locale as an extension type ([dd4864b](https://github.com/dee-gmiterko/gepard/commit/dd4864b83c792979ba880779c420fd8f68bf5d17))
* detect connection failures and show an offline indicator ([792c95b](https://github.com/dee-gmiterko/gepard/commit/792c95b762c627a252b61cdd105752a687747871))
* disable a launchpad project while its new window is starting ([4dd59f2](https://github.com/dee-gmiterko/gepard/commit/4dd59f2b425ff6f772bb299b681bab19870fa1bc))
* dockable file controls in a file details panel and tree-ordered file navigation ([822bd4b](https://github.com/dee-gmiterko/gepard/commit/822bd4b8dd2231164d9104851b278363008f9ef1))
* make the side panel toggle always visible and openable without a file selected ([4b97d9e](https://github.com/dee-gmiterko/gepard/commit/4b97d9e008252bab8b9619e1a402715f56e408f2))
* pack extensions with npm, bundle them from releases and generate the catalog ([9b370e3](https://github.com/dee-gmiterko/gepard/commit/9b370e31a6252723771d1034d11ae6c405735465))
* page and stream search results instead of loading everything at once ([6d77336](https://github.com/dee-gmiterko/gepard/commit/6d773369f3a031af8c97fc2ad7b6e38c2d95043f))
* release language server extensions separately and install them from a catalog ([4d85574](https://github.com/dee-gmiterko/gepard/commit/4d855747cfc1be51764cba5be0fe6b16ca35d599))
* report imports as imports and resolve import paths in the backend ([5065f28](https://github.com/dee-gmiterko/gepard/commit/5065f2818b11f2a78d6eef0eacf948f8e9adcbc8))
* show every comment in the comments tab with the full comment widget ([bb89105](https://github.com/dee-gmiterko/gepard/commit/bb8910525c3be7d0131d4a81cf8e0f02fa350907))
* show pipeline failure annotations per file and attach them to line comments ([50e26d0](https://github.com/dee-gmiterko/gepard/commit/50e26d0391adb4bdae628f26dcd3568e853221c6))
* show the diff since the last reviewed commit of a file ([a1aed04](https://github.com/dee-gmiterko/gepard/commit/a1aed04111c91330b66309b54587cc3d08c04647))
* show the log file path and error detail on danger toasts ([f1ce68f](https://github.com/dee-gmiterko/gepard/commit/f1ce68f3d2e35a7a8d6fbc28f0d847a645210e1f))
* show viewed progress bar in the header and reserve space for the status text ([3aba9c1](https://github.com/dee-gmiterko/gepard/commit/3aba9c14cd3906f156f5a07907a5851061cb3a12))
* split the pull requests overview into open awaiting, open reviewed and closed tabs ([5bee8ad](https://github.com/dee-gmiterko/gepard/commit/5bee8ad89f64a85b1a6cf101ebcdc045de9a4662))
* support pull requests from forks and fix git history and sync results ([119b19d](https://github.com/dee-gmiterko/gepard/commit/119b19d056757d3bbaaf3b95042779398c3516c6))


### Bug Fixes

* give each extensions message its own id and correct the extension docs ([d7b2757](https://github.com/dee-gmiterko/gepard/commit/d7b27574a4ead38e6f07233a4ff09672d367a3f7))
* remove the redundant customized label next to a rebound key ([3d88ea9](https://github.com/dee-gmiterko/gepard/commit/3d88ea99947fafd8c573cfd2ec3206b662219602))
* show no matches in the search results instead of in combo boxes ([939b9e9](https://github.com/dee-gmiterko/gepard/commit/939b9e9d16a24413a3245818094004319fa4d43d))
