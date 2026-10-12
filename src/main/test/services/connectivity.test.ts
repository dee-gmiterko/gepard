import { ExecExitError } from '@gepard/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectionError } from '../../helpers/process/connection';
import { connectivity, ConnectivityService } from '../../services/connectivity';
import { __clearEmittedEvents, __setUserDataDir, emittedEvents } from '../support/electron';
import { makeTmpDir } from '../support/tmp';

const offlineFailure = (): ExecExitError =>
  new ExecExitError('gh', ['api', 'user'], 1, null, 'error connecting to api.github.com');
const otherFailure = (): ExecExitError =>
  new ExecExitError('gh', ['api', 'user'], 1, null, 'gh: Not Found (HTTP 404)');

describe('ConnectivityService.onRemoteResult', () => {
  let published: boolean[];
  let service: ConnectivityService;

  beforeEach(() => {
    published = [];
    service = new ConnectivityService((offline) => published.push(offline));
  });

  it('starts online and stays online on a success', () => {
    expect(service.isOffline()).toBe(false);
    service.onRemoteResult(true);
    expect(service.isOffline()).toBe(false);
    expect(published).toEqual([]);
  });

  it('flips offline on a connection failure', () => {
    service.onRemoteResult(false, offlineFailure());
    expect(service.isOffline()).toBe(true);
    expect(published).toEqual([true]);
  });

  it('accepts an already translated ConnectionError', () => {
    service.onRemoteResult(false, new ConnectionError(offlineFailure()));
    expect(service.isOffline()).toBe(true);
  });

  it('publishes each flip once', () => {
    service.onRemoteResult(false, offlineFailure());
    service.onRemoteResult(false, offlineFailure());
    expect(published).toEqual([true]);
    service.onRemoteResult(true);
    service.onRemoteResult(true);
    expect(published).toEqual([true, false]);
  });

  it('clears the offline state on a later remote success', () => {
    service.onRemoteResult(false, offlineFailure());
    service.onRemoteResult(true);
    expect(service.isOffline()).toBe(false);
    expect(published).toEqual([true, false]);
  });

  it('ignores failures that are not connection failures', () => {
    service.onRemoteResult(false, otherFailure());
    service.onRemoteResult(false, new Error('ECONNREFUSED'));
    service.onRemoteResult(false);
    expect(service.isOffline()).toBe(false);
    service.onRemoteResult(false, offlineFailure());
    service.onRemoteResult(false, otherFailure());
    expect(service.isOffline()).toBe(true);
    expect(published).toEqual([true]);
  });
});

describe('connectivity singleton', () => {
  it('emits connectivity.changed to every window', async () => {
    const tmp = await makeTmpDir('connectivity');
    __setUserDataDir(tmp.path);
    __clearEmittedEvents();
    try {
      connectivity.onRemoteResult(false, offlineFailure());
      connectivity.onRemoteResult(true);
      expect(emittedEvents).toEqual([
        { channel: 'connectivity.changed', payload: { offline: true } },
        { channel: 'connectivity.changed', payload: { offline: false } },
      ]);
    } finally {
      await tmp.cleanup();
    }
  });
});
