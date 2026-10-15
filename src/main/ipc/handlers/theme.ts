import type { HandlerMap } from '../registry';
import type { ExtensionsService } from '../../services/extensions';
import { getTemplateId, setTemplateId } from '../../store/settings';

export class ThemeHandlers {
  constructor(private readonly extensions: ExtensionsService) {}

  toHandlerMap(): Pick<HandlerMap, 'theme.getTemplateId' | 'theme.setTemplateId' | 'themes.list'> {
    return {
      'theme.getTemplateId': () => getTemplateId(),
      'theme.setTemplateId': ({ templateId }) => setTemplateId(templateId),
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
