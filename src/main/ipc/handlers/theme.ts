import type { HandlerMap } from '../dispatch';
import type { ExtensionsService } from '../../services/extensions';
import type { SettingsStore } from '../../store/settings';

export class ThemeHandlers {
  constructor(
    private readonly settings: SettingsStore,
    private readonly extensions: ExtensionsService,
  ) {}

  toHandlerMap(): Pick<HandlerMap, 'theme.getTemplateId' | 'theme.setTemplateId' | 'themes.list'> {
    return {
      'theme.getTemplateId': () => this.settings.getTemplateId(),
      'theme.setTemplateId': ({ templateId }) => this.settings.setTemplateId(templateId),
      'themes.list': async () =>
        (await this.extensions.enabledThemeTemplates()).map(
          ({ id, name, mode, contrast, shadow, colors, syntax }) => ({
            id,
            name,
            mode,
            contrast,
            shadow,
            colors,
            syntax,
          }),
        ),
    };
  }
}
