import type { Actor } from '@gepard/common/ipc/schemas/pr';
import type { Viewer } from '@gepard/common/ipc/schemas/project';

export function authorDisplayName(author: Actor | null, viewer: Viewer | null): string {
  if (author) return author.name ?? author.login;
  return viewer?.name ?? viewer?.login ?? '';
}
