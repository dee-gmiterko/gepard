import type { SearchScope } from '../../components/ScopeToggle';
import type { CommentReference } from '@gepard/common/ipc/schemas/comment';

export interface ReferenceChoices {
  symbolOpen: boolean;
  symbols: CommentReference[];
  exactOpen: boolean;
  exactScope: SearchScope;
  patternOpen: boolean;
  patternScope: SearchScope;
  patternSymbol: string;
}

export function initialReferenceChoices(references: CommentReference[]): ReferenceChoices {
  return {
    symbolOpen: references.some((r) => r.kind === 'symbol'),
    symbols: references.filter((r) => r.kind === 'symbol'),
    exactOpen: references.some((r) => r.kind === 'exact'),
    exactScope: 'all',
    patternOpen: references.some((r) => r.kind === 'pattern'),
    patternScope: 'all',
    patternSymbol: '',
  };
}
