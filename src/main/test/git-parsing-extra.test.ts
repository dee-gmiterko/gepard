import { describe, expect, it } from 'vitest';
import {
  changeTypeFromLetter,
  parseGitLog,
  parseZTokens,
  stripOriginPrefix,
} from '../helpers/git/gitParsing';

describe('parseGitLog', () => {
  it('parses records separated by the record separator', () => {
    const record = (oid: string, body: string): string =>
      ['\n' + oid, 'a', 'c', 'Ann', 'ann@x.io', `subject ${oid}`, body].join('\x1f') + '\x1e';
    const commits = parseGitLog(record('1', 'body one') + record('2', ''));
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      oid: '1',
      messageHeadline: 'subject 1',
      messageBody: 'body one',
      authors: [{ login: null, name: 'Ann', email: 'ann@x.io' }],
    });
    expect(commits[1].messageBody).toBe('');
  });

  it('returns nothing for empty output', () => {
    expect(parseGitLog('')).toEqual([]);
  });
});

describe('parseZTokens', () => {
  it('splits on NUL and drops the trailing empty token', () => {
    expect(parseZTokens('a\0b\0')).toEqual(['a', 'b']);
    expect(parseZTokens('')).toEqual([]);
  });
});

describe('changeTypeFromLetter', () => {
  it('maps status letters', () => {
    expect(changeTypeFromLetter('A')).toBe('ADDED');
    expect(changeTypeFromLetter('D')).toBe('DELETED');
    expect(changeTypeFromLetter('R')).toBe('RENAMED');
    expect(changeTypeFromLetter('C')).toBe('COPIED');
    expect(changeTypeFromLetter('T')).toBe('CHANGED');
  });

  it('defaults to modified', () => {
    expect(changeTypeFromLetter('M')).toBe('MODIFIED');
    expect(changeTypeFromLetter('?')).toBe('MODIFIED');
  });
});

describe('stripOriginPrefix', () => {
  it('removes a leading origin/ only', () => {
    expect(stripOriginPrefix('origin/main')).toBe('main');
    expect(stripOriginPrefix('feature/origin/x')).toBe('feature/origin/x');
  });
});
