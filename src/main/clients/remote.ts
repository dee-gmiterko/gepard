import { toConnectionError } from '../helpers/process/connection';

export interface RemoteObserver {
  onRemoteResult(ok: boolean, error?: unknown): void;
}

export async function observeRemote<T>(observer: RemoteObserver, call: Promise<T>): Promise<T> {
  try {
    const value = await call;
    observer.onRemoteResult(true);
    return value;
  } catch (e) {
    const failure = toConnectionError(e) ?? e;
    observer.onRemoteResult(false, failure);
    throw failure;
  }
}
