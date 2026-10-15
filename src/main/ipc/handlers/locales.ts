import type { HandlerMap } from '../registry';
import type { ExtensionsService } from '../../services/extensions';
import { getLocaleId, setLocaleId } from '../../store/settings';

export class LocalesHandlers {
  constructor(private readonly extensions: ExtensionsService) {}

  toHandlerMap(): Pick<HandlerMap, 'locale.getLocaleId' | 'locale.setLocaleId' | 'locales.list'> {
    return {
      'locale.getLocaleId': () => getLocaleId(),
      'locale.setLocaleId': ({ localeId }) => setLocaleId(localeId),
      'locales.list': async () =>
        (await this.extensions.enabledLocales()).map(({ id, displayName, messages }) => ({
          id,
          displayName,
          messages,
        })),
    };
  }
}
