import type { HandlerMap } from '../registry';
import { extensionsService } from '../../di';

export const grammarsHandlers: Pick<HandlerMap, 'grammars.list'> = {
  'grammars.list': () => extensionsService.enabledGrammars(),
};
