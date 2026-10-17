import { afterEach, describe, expect, it } from 'vitest';
import type { IpcBridge } from '@gepard/common';
import { hostCapabilities } from '../../src/ipc/host';

const ipc: IpcBridge = {
  invoke: () => Promise.reject(new Error('unused')),
  on: () => () => undefined,
};

describe('hostCapabilities', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'gepard');
  });

  it('offers native capabilities on the desktop host', () => {
    window.gepard = { host: 'desktop', ipc };
    expect(hostCapabilities()).toEqual({
      folderPicker: true,
      detachedWindows: true,
    });
  });

  it('offers none on the browser host', () => {
    window.gepard = { host: 'browser', ipc };
    expect(hostCapabilities()).toEqual({
      folderPicker: false,
      detachedWindows: false,
    });
  });
});
