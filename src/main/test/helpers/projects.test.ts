import { describe, expect, it } from 'vitest';
import type { Project } from '@gepard/common';
import { findProjectByName } from '../../helpers/projects';

function project(owner: string, repo: string): Project {
  return {
    id: `${owner}__${repo}`.toLowerCase(),
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    addedAt: '2024-01-01T00:00:00.000Z',
    cloned: true,
  };
}

describe('findProjectByName', () => {
  const projects = [project('Dee', 'gepard'), project('acme', 'tool'), project('other', 'tool')];

  it('matches owner/repo as shown in the launchpad, ignoring case', () => {
    expect(findProjectByName(projects, 'dee/gepard')).toBe(projects[0]);
    expect(findProjectByName(projects, 'Acme/Tool')).toBe(projects[1]);
  });

  it('matches the project id', () => {
    expect(findProjectByName(projects, 'other__tool')).toBe(projects[2]);
  });

  it('matches a bare repo name only when it is unambiguous', () => {
    expect(findProjectByName(projects, 'gepard')).toBe(projects[0]);
    expect(findProjectByName(projects, 'tool')).toBeNull();
  });

  it('returns null for unknown names', () => {
    expect(findProjectByName(projects, 'nobody/nothing')).toBeNull();
    expect(findProjectByName([], 'gepard')).toBeNull();
  });
});
