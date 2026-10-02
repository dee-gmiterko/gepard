import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';
import { getLocaleId, setLocaleId } from '../../store/settings';

export const localesHandlers: Pick<
  HandlerMap,
  'locale.getLocaleId' | 'locale.setLocaleId' | 'locales.list'
> = {
  'locale.getLocaleId': () => getLocaleId(),
  'locale.setLocaleId': ({ localeId }) => setLocaleId(localeId),
  'locales.list': async () =>
    (await extensionRegistry.enabledLocales()).map(({ id, displayName, messages }) => ({
      id,
      displayName,
      messages,
    })),
};
