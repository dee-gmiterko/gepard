import { describe, expect, it } from 'vitest';
import { clipPreview, MAX_PREVIEW_CHARS } from '../../../helpers/search/preview';

describe('clipPreview', () => {
  it('leaves a short line alone', () => {
    expect(clipPreview('hello world', [[6, 11]])).toEqual({
      preview: 'hello world',
      spans: [[6, 11]],
    });
  });

  it('windows a long line around the first match and shifts the spans with it', () => {
    const line = `${'a'.repeat(1000)}needle${'b'.repeat(1000)}`;
    const clipped = clipPreview(line, [[1000, 1006]]);
    expect(clipped.preview.length).toBe(MAX_PREVIEW_CHARS);
    const [[start, end]] = clipped.spans;
    expect(clipped.preview.slice(start, end)).toBe('needle');
  });

  it('drops a span that falls outside the window and trims one that straddles it', () => {
    const line = `needle${'x'.repeat(2000)}needle`;
    const clipped = clipPreview(line, [
      [0, 6],
      [2006, 2012],
    ]);
    expect(clipped.spans).toEqual([[0, 6]]);
  });

  it('never leaves half of a surrogate pair at either edge', () => {
    const line = '😀'.repeat(400);
    const cases: Array<Array<[number, number]>> = [[[0, 2]], [[300, 302]]];
    for (const spans of cases) {
      const { preview } = clipPreview(line, spans);
      expect(preview).toBe(preview.toWellFormed());
    }
  });

  it('clips at the start of the line when the match is near it', () => {
    const line = `hit${'x'.repeat(2000)}`;
    const clipped = clipPreview(line, [[0, 3]]);
    expect(clipped.preview.startsWith('hit')).toBe(true);
    expect(clipped.spans).toEqual([[0, 3]]);
  });
});
