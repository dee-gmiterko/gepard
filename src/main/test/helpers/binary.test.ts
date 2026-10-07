import { describe, expect, it } from 'vitest';
import { looksBinary } from '../../helpers/binary';

describe('looksBinary', () => {
  it('treats a NUL byte in the first 8000 bytes as binary', () => {
    expect(looksBinary(Buffer.from([104, 101, 0, 108, 108, 111]))).toBe(true);
  });

  it('treats plain text as non-binary', () => {
    expect(looksBinary(Buffer.from('hello world\n', 'utf8'))).toBe(false);
  });
});
