import type { Actor, Viewer } from '@gepard/common';

export function authorDisplayName(author: Actor | null, viewer: Viewer | null): string {
  if (author) return author.name ?? author.login;
  return viewer?.name ?? viewer?.login ?? '';
}
