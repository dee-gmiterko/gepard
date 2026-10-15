import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'settings.extensions.title',
    defaultMessage: 'Extensions',
  },
  addExtension: {
    id: 'settings.extensions.addExtension',
    defaultMessage: 'Add extension',
  },
  installedIn: {
    id: 'settings.extensions.installedIn',
    defaultMessage: 'Installed extensions live in {dir}',
  },
  loading: {
    id: 'settings.extensions.loading',
    defaultMessage: 'Loading extensions…',
  },
  failed: {
    id: 'settings.extensions.failed',
    defaultMessage: 'Failed to load extensions.',
  },
  empty: {
    id: 'settings.extensions.empty',
    defaultMessage: 'No extensions found.',
  },
  loadFailed: {
    id: 'settings.extensions.loadFailed',
    defaultMessage: 'Failed to load: {error}',
  },
  builtin: {
    id: 'settings.extensions.builtin',
    defaultMessage: 'Built-in',
  },
  external: {
    id: 'settings.extensions.external',
    defaultMessage: 'External',
  },
  kindLsp: {
    id: 'settings.extensions.kindLsp',
    defaultMessage: 'Language server',
  },
  kindGrammar: {
    id: 'settings.extensions.kindGrammar',
    defaultMessage: 'Grammar',
  },
  kindTheme: {
    id: 'settings.extensions.kindTheme',
    defaultMessage: 'Theme',
  },
  kindLocale: {
    id: 'settings.extensions.kindLocale',
    defaultMessage: 'Locale',
  },
  enableExtension: {
    id: 'settings.extensions.enableExtension',
    defaultMessage: 'Enable {name}',
  },
  installDialogTitle: {
    id: 'settings.extensions.installDialogTitle',
    defaultMessage: 'Add extension package',
  },
  version: {
    id: 'settings.extensions.version',
    defaultMessage: 'v{version}',
  },
  catalogTitle: {
    id: 'settings.extensions.catalog.title',
    defaultMessage: 'Available extensions',
  },
  catalogLoading: {
    id: 'settings.extensions.catalog.loading',
    defaultMessage: 'Loading available extensions…',
  },
  catalogFailed: {
    id: 'settings.extensions.catalog.failed',
    defaultMessage: 'Failed to load the list of available extensions.',
  },
  catalogEmpty: {
    id: 'settings.extensions.catalog.empty',
    defaultMessage: 'No extensions are available.',
  },
  catalogInstalled: {
    id: 'settings.extensions.catalog.installed',
    defaultMessage: 'Installed v{version}',
  },
  catalogInstall: {
    id: 'settings.extensions.catalog.install',
    defaultMessage: 'Install',
  },
  catalogUpToDate: {
    id: 'settings.extensions.catalog.upToDate',
    defaultMessage: 'Up to date',
  },
  catalogUnsupported: {
    id: 'settings.extensions.catalog.unsupported',
    defaultMessage: 'Not available for this platform',
  },
  catalogInstalling: {
    id: 'settings.extensions.catalog.installing',
    defaultMessage: 'Installing…',
  },
  repoTitle: {
    id: 'settings.extensions.repo.title',
    defaultMessage: 'Install from GitHub',
  },
  repoHint: {
    id: 'settings.extensions.repo.hint',
    defaultMessage:
      'Installs the extension archive attached to the latest release of a GitHub repository. For a repository with several extensions, give the path of the extension inside it.',
  },
  repoRepository: {
    id: 'settings.extensions.repo.repository',
    defaultMessage: 'Repository (owner/repo)',
  },
  repoPath: {
    id: 'settings.extensions.repo.path',
    defaultMessage: 'Path within the repository (optional)',
  },
  repoRepositoryPlaceholder: {
    id: 'settings.extensions.repo.repositoryPlaceholder',
    defaultMessage: 'owner/repo',
  },
  repoPathPlaceholder: {
    id: 'settings.extensions.repo.pathPlaceholder',
    defaultMessage: 'extensions/lsp/name',
  },
  repoInstall: {
    id: 'settings.extensions.repo.install',
    defaultMessage: 'Install from repository',
  },
  repoInstalled: {
    id: 'settings.extensions.repo.installed',
    defaultMessage: 'Extension installed.',
  },
});

export const actionMessages = {
  install: messages.catalogInstall,
  upToDate: messages.catalogUpToDate,
  builtin: messages.builtin,
  unsupported: messages.catalogUnsupported,
} as const;

export const kindMessages = {
  lsp: messages.kindLsp,
  grammar: messages.kindGrammar,
  theme: messages.kindTheme,
  locale: messages.kindLocale,
} as const;
