import type { Anchor } from '../ipc/schemas/comment';

export function generalCommentAnchor(): Anchor {
  return {
    path: '',
    subjectType: 'PR',
    side: 'RIGHT',
    line: null,
    startLine: null,
    startSide: null,
    originalLine: null,
    originalStartLine: null,
    commitOid: null,
    originalCommitOid: null,
  };
}
