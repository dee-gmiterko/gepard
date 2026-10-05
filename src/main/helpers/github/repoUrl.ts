import { AppError } from '@gepard/common';

const NAME_RE = /^[A-Za-z0-9_.-]+$/;

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('BAD_INPUT', `not a valid URL: ${url}`);
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const owner = segments[0];
  const repo = segments[1]?.replace(/\.git$/, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'github.com' ||
    segments.length !== 2 ||
    !NAME_RE.test(owner) ||
    !repo ||
    !NAME_RE.test(repo)
  )
    throw new AppError('BAD_INPUT', `expected https://github.com/<owner>/<repo>, got: ${url}`);
  return { owner, repo };
}

export function isGitHubRepoUrl(text: string): boolean {
  try {
    parseGitHubRepoUrl(text);
    return true;
  } catch {
    return false;
  }
}
