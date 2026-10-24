import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { urlAt } from '../../src/codeEditor/urlLinks';

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: markdown({ base: markdownLanguage }) });
}

describe('urlAt', () => {
  const doc =
    'see (https://example.com/a_(b)?q=1), or http://x.io. [t](https://y.io/p) <https://z.io>';

  it('finds urls through the markdown parse tree', () => {
    const state = stateOf(doc);
    expect(urlAt(state, 10)).toBe('https://example.com/a_(b)?q=1');
    expect(urlAt(state, doc.indexOf('http://') + 3)).toBe('http://x.io');
    expect(urlAt(state, doc.indexOf('https://y.io') + 3)).toBe('https://y.io/p');
    expect(urlAt(state, doc.indexOf('https://z.io') + 3)).toBe('https://z.io');
  });

  it('returns null outside urls and for non-web urls', () => {
    expect(urlAt(stateOf(doc), 1)).toBeNull();
    expect(urlAt(stateOf('[t](./local.md)'), 8)).toBeNull();
  });
});
