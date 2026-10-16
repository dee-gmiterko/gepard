import { AuthError, ConnectionError, ExecExitError } from '@gepard/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectivityService } from '../../services/connectivity';
import { IpcEventService } from '../../ipc/events';
import { collectEvents, silentLogger } from '../support/tmp';

const offlineFailure = (): ConnectionError =>
  new ConnectionError('gh exited with code 1: error connecting to api.github.com');

describe('ConnectivityService.onRemoteResult', () => {
  let published: boolean[];
  let service: ConnectivityService;

  beforeEach(() => {
    published = [];
    const events = new IpcEventService();
    events.subscribe((_, payload) => {
      published.push((payload as { offline: boolean }).offline);
    });
    service = new ConnectivityService(silentLogger, events);
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
    service.onRemoteResult(false, new AuthError('gh: Bad credentials (HTTP 401)'));
    service.onRemoteResult(
      false,
      new ExecExitError('gh', ['api', 'user'], 1, null, 'error connecting to api.github.com'),
    );
    service.onRemoteResult(false, new Error('ECONNREFUSED'));
    service.onRemoteResult(false);
    expect(service.isOffline()).toBe(false);
    service.onRemoteResult(false, offlineFailure());
    service.onRemoteResult(false, new AuthError('gh: Bad credentials (HTTP 401)'));
    expect(service.isOffline()).toBe(true);
    expect(published).toEqual([true]);
  });
});

describe('ConnectivityService events', () => {
  it('emits connectivity.changed to every window', () => {
    const events = new IpcEventService();
    const emitted = collectEvents(events);
    const service = new ConnectivityService(silentLogger, events);
    service.onRemoteResult(false, offlineFailure());
    service.onRemoteResult(true);
    expect(emitted).toEqual([
      { channel: 'connectivity.changed', payload: { offline: true } },
      { channel: 'connectivity.changed', payload: { offline: false } },
    ]);
  });
});
