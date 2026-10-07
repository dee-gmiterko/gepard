import { afterEach, describe, expect, it } from 'vitest';
import { GodotSession } from '../session';

const sink = { status: () => {}, log: () => {} };
const RETRY_MS = 100;

describe('GodotSession launch failure', () => {
  const realSetTimeout = globalThis.setTimeout;
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it('stops retrying the socket connection once the godot binary failed to start', async () => {
    const plan = {
      command: '/nonexistent/godot-binary',
      args: [],
      cwd: process.cwd(),
      projectDir: process.cwd(),
      env: {},
    };
    await expect(GodotSession.start(plan, sink)).rejects.toThrow(/LSP process error/);

    let retriesAfterFailure = 0;
    globalThis.setTimeout = Object.assign(
      (...args: Parameters<typeof setTimeout>): ReturnType<typeof setTimeout> => {
        if (args[1] === RETRY_MS) retriesAfterFailure++;
        return realSetTimeout(...args);
      },
      realSetTimeout,
    );
    await new Promise((r) => realSetTimeout(r, 600));

    expect(retriesAfterFailure).toBe(0);
  });
});
