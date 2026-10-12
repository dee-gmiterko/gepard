import { describe, expect, it } from 'vitest';
import { quotedAt } from '../../src/codeEditor/gotoDefinition';

const line = `import { a } from './a'; const s = "x y";`;

describe('quotedAt', () => {
  it('returns the string contents when the offset is inside the quotes', () => {
    expect(quotedAt(line, line.indexOf('./a') + 1)).toBe('./a');
    expect(quotedAt(line, line.indexOf('x y') + 1)).toBe('x y');
  });

  it('returns nothing outside strings', () => {
    expect(quotedAt(line, line.indexOf('import') + 2)).toBeNull();
    expect(quotedAt(line, line.indexOf('const') + 1)).toBeNull();
  });
});
