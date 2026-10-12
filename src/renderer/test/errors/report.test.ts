import {
  type AppError,
  ConnectionError,
  IpcError,
  fromIpcErrorShape,
  toIpcErrorShape,
} from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { onReportedError, reportQueryError, type ReportedError } from '../../src/errors/report';

function capture(run: () => void): ReportedError[] {
  const reported: ReportedError[] = [];
  const stop = onReportedError((error) => reported.push(error));
  try {
    run();
  } finally {
    stop();
  }
  return reported;
}

const connectionFailure = (): AppError =>
  fromIpcErrorShape(
    toIpcErrorShape(
      new ConnectionError('gh exited with code 1: error connecting to api.github.com', {
        cmd: 'gh',
      }),
    ),
    'sync.run',
  );

describe('reportQueryError with a connection failure', () => {
  it('reports a minimal warning without details for an explicit action', () => {
    const reported = capture(() =>
      reportQueryError('mutation:sync', connectionFailure(), { explicit: true }),
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      scope: 'mutation:sync',
      message: { id: 'errors.code.connectionFailed' },
      tone: 'warning',
    });
    expect(reported[0].detail).toBeUndefined();
  });

  it('stays silent for a background query', () => {
    expect(capture(() => reportQueryError('query:prs', connectionFailure()))).toEqual([]);
  });

  it('keeps reporting other failures the generic way', () => {
    const reported = capture(() =>
      reportQueryError(
        'query:prs',
        new IpcError({ code: 'EXEC_FAILED', message: 'boom' }, 'pr.list'),
      ),
    );
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toMatchObject({ id: 'errors.code.execFailed' });
  });
});
