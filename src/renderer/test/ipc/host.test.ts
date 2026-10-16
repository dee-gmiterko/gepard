import { describe, expect, it } from 'vitest';
import type { IpcBridge } from '@gepard/common';
import { detectHost, UnknownHostError } from '../../src/ipc/host';

const bridge: IpcBridge = {
  invoke: () => Promise.reject(new Error('unused')),
  on: () => () => undefined,
};

function documentWith(host: string | null): Parameters<typeof detectHost>[1] {
  return () => ({
    querySelector: () => (host === null ? null : { getAttribute: () => host }),
  });
}

describe('detectHost', () => {
  it('is the desktop host when the preload exposed gepard', () => {
    expect(detectHost({ gepard: { host: 'desktop', ipc: bridge } }, documentWith(null))).toEqual({
      kind: 'desktop',
      ipc: bridge,
    });
  });

  it('is the server host when the served page is marked', () => {
    expect(detectHost({}, documentWith('server'))).toEqual({ kind: 'server' });
  });

  it('refuses to guess when neither marker is present', () => {
    expect(() => detectHost({}, documentWith(null))).toThrow(UnknownHostError);
    expect(() => detectHost({}, documentWith('other'))).toThrow(UnknownHostError);
  });
});
