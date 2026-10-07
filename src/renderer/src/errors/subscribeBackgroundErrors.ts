import { defineMessages, type MessageDescriptor } from 'react-intl';
import { subscribe } from '../ipc/client';
import { reportError } from './report';

const messages = defineMessages({
  cloneFailed: {
    id: 'main.cloneFailed',
    defaultMessage: 'Clone failed.',
  },
  indexFailed: {
    id: 'main.indexFailed',
    defaultMessage: 'Indexing failed.',
  },
  appErrorHeadlineApp: {
    id: 'main.appErrorHeadline.app',
    defaultMessage: 'Application error.',
  },
  appErrorHeadlineLsp: {
    id: 'main.appErrorHeadline.lsp',
    defaultMessage: 'Language server error.',
  },
  appErrorHeadlineDefault: {
    id: 'main.appErrorHeadline.default',
    defaultMessage: 'Background error.',
  },
});

function appErrorHeadline(scope: string): MessageDescriptor {
  if (scope === 'app' || scope.startsWith('app:')) return messages.appErrorHeadlineApp;
  if (scope === 'lsp' || scope.startsWith('lsp:')) return messages.appErrorHeadlineLsp;
  return messages.appErrorHeadlineDefault;
}

export function subscribeBackgroundErrors(): void {
  subscribe('app.error', ({ scope, message }) => {
    reportError({
      scope,
      message: appErrorHeadline(scope),
      detail: message,
      loggedByMain: true,
    });
  });

  subscribe('clone.progress', (payload) => {
    if (payload.phase !== 'error') return;
    reportError({
      scope: `clone:${payload.projectId}`,
      message: messages.cloneFailed,
      detail: payload.message,
      loggedByMain: true,
    });
  });
  subscribe('index.status', ({ projectId, status }) => {
    if (status.state !== 'error') return;
    reportError({
      scope: `index:${projectId}`,
      message: messages.indexFailed,
      detail: status.message,
      loggedByMain: true,
    });
  });
}
