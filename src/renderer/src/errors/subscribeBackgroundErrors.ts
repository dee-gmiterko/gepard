import { defineMessages, type MessageDescriptor } from 'react-intl';
import { fromIpcErrorShape, MissingDependencyError, type AppError } from '@gepard/common';
import { subscribe } from '../ipc/client';
import { describeError } from './errorMessage';
import { reportError, type ReportedError } from './report';

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
  extensionActivationFailed: {
    id: 'main.extensionActivationFailed',
    defaultMessage: '{extension} could not start.',
  },
});

function appErrorHeadline(scope: string): MessageDescriptor {
  if (scope === 'app' || scope.startsWith('app:')) return messages.appErrorHeadlineApp;
  if (scope === 'lsp' || scope.startsWith('lsp:')) return messages.appErrorHeadlineLsp;
  return messages.appErrorHeadlineDefault;
}

function activationFailure(error: AppError): Pick<ReportedError, 'detail' | 'values'> {
  if (!(error instanceof MissingDependencyError)) return { detail: error.message };
  const { message, values } = describeError(error);
  return { detail: message, values };
}

export function subscribeBackgroundErrors(): void {
  subscribe('extension.activationFailed', ({ extensionId, displayName, error }) => {
    const { detail, values } = activationFailure(
      fromIpcErrorShape(error, 'extension.activationFailed'),
    );
    reportError({
      scope: `lsp:${extensionId}`,
      message: messages.extensionActivationFailed,
      values: { extension: displayName, ...values },
      detail,
      loggedByMain: true,
    });
  });

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
