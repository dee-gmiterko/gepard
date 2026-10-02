import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPosix } from '@gepard/common';

describe('toPosix', () => {
  it('joins platform segments with forward slashes', () => {
    expect(toPosix(['a', 'b', 'c.ts'].join(path.sep))).toBe('a/b/c.ts');
  });

  it('leaves paths without separators unchanged', () => {
    expect(toPosix('file.ts')).toBe('file.ts');
  });
});
