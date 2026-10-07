import { describe, expect, it } from 'vitest';
import { withLatestWins, type CancellableRun } from '../../ipc/cancellation';

function deferredWork<T>(): {
  fn: (run: CancellableRun) => Promise<T>;
  run: () => CancellableRun;
  resolve: (value: T) => void;
} {
  let captured: CancellableRun | undefined;
  let resolveFn: (value: T) => void = () => undefined;
  return {
    fn: (run) => {
      captured = run;
      return new Promise<T>((resolve) => {
        resolveFn = resolve;
      });
    },
    run: () => {
      if (!captured) throw new Error('work has not started');
      return captured;
    },
    resolve: (value) => resolveFn(value),
  };
}

describe('withLatestWins', () => {
  it('cancels the in-flight call under the same key immediately', async () => {
    const first = deferredWork<string>();
    const second = deferredWork<string>();

    const p1 = withLatestWins('k-same', first.fn);
    const p2 = withLatestWins('k-same', second.fn);

    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(first.run().signal.aborted).toBe(true);
    expect(first.run().token.isCancellationRequested).toBe(true);
    expect(second.run().signal.aborted).toBe(false);
    expect(second.run().token.isCancellationRequested).toBe(false);

    second.resolve('second');
    await expect(p2).resolves.toBe('second');
  });

  it('does not cancel calls under distinct keys', async () => {
    const a = deferredWork<string>();
    const b = deferredWork<string>();

    const pa = withLatestWins('k-a', a.fn);
    const pb = withLatestWins('k-b', b.fn);

    expect(a.run().signal.aborted).toBe(false);
    b.resolve('b');
    a.resolve('a');
    await expect(pa).resolves.toBe('a');
    await expect(pb).resolves.toBe('b');
  });

  it('does not cancel a later call once the earlier one has settled', async () => {
    const first = deferredWork<number>();
    const p1 = withLatestWins('k-seq', first.fn);
    first.resolve(1);
    await expect(p1).resolves.toBe(1);

    const second = deferredWork<number>();
    const p2 = withLatestWins('k-seq', second.fn);
    expect(second.run().signal.aborted).toBe(false);
    second.resolve(2);
    await expect(p2).resolves.toBe(2);
  });

  it('propagates a real failure unchanged', async () => {
    const err = new Error('boom');
    await expect(withLatestWins('k-fail', () => Promise.reject(err))).rejects.toBe(err);
  });
});
