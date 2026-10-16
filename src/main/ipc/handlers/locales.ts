import type { HandlerMap } from '../dispatch';
import type { ExtensionsService } from '../../services/extensions';
import type { SettingsStore } from '../../store/settings';

export class LocalesHandlers {
  constructor(
    private readonly settings: SettingsStore,
    private readonly extensions: ExtensionsService,
  ) {}

  toHandlerMap(): Pick<HandlerMap, 'locale.getLocaleId' | 'locale.setLocaleId' | 'locales.list'> {
    return {
      'locale.getLocaleId': () => this.settings.getLocaleId(),
      'locale.setLocaleId': ({ localeId }) => this.settings.setLocaleId(localeId),
      'locales.list': async () =>
        (await this.extensions.enabledLocales()).map(({ id, displayName, messages }) => ({
          id,
          displayName,
          messages,
        })),
    };
  }
}
