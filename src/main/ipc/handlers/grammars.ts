import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';

export const grammarsHandlers: Pick<HandlerMap, 'grammars.list'> = {
  'grammars.list': () => extensionRegistry.enabledGrammars(),
};
