import { describe, expect, it } from 'vitest';
import { prFilterText, repoFilterText, repoSearchQuery, repoUrl } from '../src/helpers/github';

import type { PrListItem, ViewerRepo } from '@gepard/common';

const repo: ViewerRepo = { owner: 'acme', repo: 'widgets', url: 'https://github.com/acme/widgets' };

describe('repoUrl', () => {
  it('builds the GitHub URL', () => {
    expect(repoUrl(repo)).toBe('https://github.com/acme/widgets');
  });
});

describe('repoFilterText', () => {
  it('joins owner and repo', () => {
    expect(repoFilterText(repo)).toBe('acme/widgets');
  });
});

describe('repoSearchQuery', () => {
  it('strips a pasted GitHub URL prefix and leading slashes', () => {
    expect(repoSearchQuery('https://github.com/acme/widgets')).toBe('acme/widgets');
    expect(repoSearchQuery('HTTP://www.github.com//acme')).toBe('acme');
    expect(repoSearchQuery('/acme')).toBe('acme');
  });

  it('leaves other text untouched', () => {
    expect(repoSearchQuery('widgets')).toBe('widgets');
  });
});

describe('prFilterText', () => {
  it('combines number, title, author, branch and labels', () => {
    const pr: PrListItem = {
      number: 7,
      id: 'PR_7',
      title: 'Fix it',
      author: { login: 'al' },
      headRefName: 'fix/it',
      baseRefName: 'main',
      headRefOid: 'a'.repeat(40),
      isCrossRepository: false,
      headRepository: null,
      headRepositoryOwner: null,
      createdAt: '2026-01-01T00:00:00Z',
      changedFiles: 1,
      labels: [
        { name: 'bug', color: 'ff0000' },
        { name: 'ui', color: '00ff00' },
      ],
      url: 'https://github.com/acme/widgets/pull/7',
    };
    expect(prFilterText(pr)).toBe('#7 Fix it al fix/it bug ui');
  });
});
