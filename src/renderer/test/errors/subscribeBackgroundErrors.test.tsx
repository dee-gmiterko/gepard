import { MissingDependencyError, toIpcErrorShape } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { onReportedError, type ReportedError } from '../../src/errors/report';
import { subscribeBackgroundErrors } from '../../src/errors/subscribeBackgroundErrors';
import { createFakeIpc, type FakeIpc } from '../support/fakeIpc';

function listen(): { ipc: FakeIpc; reported: ReportedError[]; stop: () => void } {
  const ipc = createFakeIpc({});
  window.ipc = ipc.bridge;
  const reported: ReportedError[] = [];
  const stop = onReportedError((error) => reported.push(error));
  subscribeBackgroundErrors();
  return { ipc, reported, stop };
}

describe('subscribeBackgroundErrors on extension.activationFailed', () => {
  it('reports a missing dependency with the extension and the dependency it names', () => {
    const { ipc, reported, stop } = listen();
    try {
      ipc.emit('extension.activationFailed', {
        extensionId: 'java',
        displayName: 'Java',
        error: toIpcErrorShape(new MissingDependencyError('java')),
      });
    } finally {
      stop();
    }

    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      scope: 'lsp:java',
      message: { id: 'main.extensionActivationFailed' },
      detail: { id: 'errors.code.missingDependency' },
      values: { extension: 'Java', dependency: 'java' },
      loggedByMain: true,
    });
  });

  it('reports any other activation failure with its message as the detail', () => {
    const { ipc, reported, stop } = listen();
    try {
      ipc.emit('extension.activationFailed', {
        extensionId: 'gdscript',
        displayName: 'GDScript',
        error: toIpcErrorShape(new Error('no project.godot found under /repo')),
      });
    } finally {
      stop();
    }

    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      scope: 'lsp:gdscript',
      message: { id: 'main.extensionActivationFailed' },
      detail: 'no project.godot found under /repo',
      values: { extension: 'GDScript' },
    });
  });
});
