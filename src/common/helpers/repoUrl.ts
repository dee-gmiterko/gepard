import { AppError } from '../errors';

const NAME_RE = /^[A-Za-z0-9_.-]+$/;

export interface RepositoryInput {
  owner: string;
  repo: string;
}

export function parseGitHubRepoUrl(url: string): RepositoryInput {
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

export function parseRepositoryInput(text: string): RepositoryInput {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return parseGitHubRepoUrl(trimmed);
  const segments = trimmed.split('/');
  if (segments.length !== 2 || !segments.every((s) => NAME_RE.test(s))) {
    throw new AppError('BAD_INPUT', `expected <owner>/<repo>, got: ${text}`);
  }
  return { owner: segments[0], repo: segments[1] };
}

export interface RepositorySource {
  repository: string;
  path: string | null;
}

// `owner/repo[/path/inside/repo]`, or a github.com URL (optionally a
// `/tree/<branch>/<path>` link): the first two segments name the repository and
// whatever follows is the extension path inside it.
export function splitRepositorySource(text: string): RepositorySource {
  const trimmed = text.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  let segments: string[];
  if (isUrl) {
    try {
      segments = new URL(trimmed).pathname.split('/').filter(Boolean);
    } catch {
      return { repository: trimmed, path: null };
    }
  } else {
    segments = trimmed.split('/').filter(Boolean);
  }
  const rest = segments.slice(2);
  if (isUrl && (rest[0] === 'tree' || rest[0] === 'blob')) rest.splice(0, 2);
  const repo = isUrl ? segments[1]?.replace(/\.git$/, '') : segments[1];
  const repository = isUrl
    ? `${trimmed.replace(/^(https?:\/\/[^/]+).*$/i, '$1')}/${segments[0] ?? ''}/${repo ?? ''}`
    : segments.slice(0, 2).join('/');
  return { repository, path: rest.join('/') || null };
}

export function isRepositoryInput(text: string): boolean {
  try {
    parseRepositoryInput(text);
    return true;
  } catch {
    return false;
  }
}

export function repositorySlug({ owner, repo }: RepositoryInput): string {
  return `${owner}/${repo}`;
}
