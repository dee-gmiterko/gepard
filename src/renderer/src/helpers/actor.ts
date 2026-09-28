import type { Actor } from '@shared/ipc/schemas/pr';
import type { Viewer } from '@shared/ipc/schemas/project';

export function authorDisplayName(author: Actor | null, viewer: Viewer | null): string {
  if (author) return author.name ?? author.login;
  return viewer?.name ?? viewer?.login ?? '';
}
