import { describe, expect, it } from 'vitest';
import { parseCli } from '../../server/cli';

describe('parseCli', () => {
  it('reads the host and port positionals', () => {
    expect(parseCli(['127.0.0.1', '8080'])).toEqual({ host: '127.0.0.1', port: 8080 });
    expect(parseCli(['localhost', '3000'])).toEqual({ host: 'localhost', port: 3000 });
  });

  it('requires both the host and the port', () => {
    expect(() => parseCli([])).toThrow();
    expect(() => parseCli(['localhost'])).toThrow();
  });

  it('rejects a malformed port', () => {
    for (const port of ['http', '70000', '0', '-1', '80.5'])
      expect(() => parseCli(['localhost', port]), port).toThrow('port must be 1-65535');
  });
});
