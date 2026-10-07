import { describe, expect, it } from 'vitest';
import { freePort } from '../../helpers/net';

describe('freePort', () => {
  it('resolves a usable port number', async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});
