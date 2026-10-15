import type { HandlerMap } from '../registry';
import { extensionsService } from '../../di';
import { getLocaleId, setLocaleId } from '../../store/settings';

export const localesHandlers: Pick<
  HandlerMap,
  'locale.getLocaleId' | 'locale.setLocaleId' | 'locales.list'
> = {
  'locale.getLocaleId': () => getLocaleId(),
  'locale.setLocaleId': ({ localeId }) => setLocaleId(localeId),
  'locales.list': async () =>
    (await extensionsService.enabledLocales()).map(({ id, displayName, messages }) => ({
      id,
      displayName,
      messages,
    })),
};
