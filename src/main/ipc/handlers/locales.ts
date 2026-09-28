import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';

export const localesHandlers: Pick<HandlerMap, 'locales.list'> = {
  'locales.list': () => extensionRegistry.enabledLocales(),
};
