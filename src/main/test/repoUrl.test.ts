import { describe, expect, it } from 'vitest';
import { AppError } from '@gepard/common';
import { isGitHubRepoUrl, parseGitHubRepoUrl } from '../helpers/github/repoUrl';

describe('parseGitHubRepoUrl', () => {
  it('extracts owner and repo, dropping a .git suffix', () => {
    expect(parseGitHubRepoUrl('https://github.com/Dee/gepard')).toEqual({
      owner: 'Dee',
      repo: 'gepard',
    });
    expect(parseGitHubRepoUrl('https://github.com/o/r.git')).toEqual({ owner: 'o', repo: 'r' });
  });

  it('rejects anything that is not an https github.com repository URL', () => {
    for (const url of [
      'o/r',
      'github.com/o/r',
      'http://github.com/o/r',
      'https://gitlab.com/o/r',
      'https://github.com/o',
      'https://github.com/o/r/pull/1',
      'https://github.com/o/r@x',
    ])
      expect(() => parseGitHubRepoUrl(url)).toThrow(AppError);
  });
});

describe('isGitHubRepoUrl', () => {
  it('distinguishes repository URLs from project names', () => {
    expect(isGitHubRepoUrl('https://github.com/o/r')).toBe(true);
    expect(isGitHubRepoUrl('o/r')).toBe(false);
    expect(isGitHubRepoUrl('github.com/o/r')).toBe(false);
    expect(isGitHubRepoUrl('https://example.com/o/r')).toBe(false);
  });
});
