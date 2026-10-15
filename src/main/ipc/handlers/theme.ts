import type { HandlerMap } from '../registry';
import { getTemplateId, setTemplateId } from '../../store/settings';
import { extensionsService } from '../../di';

export const themeHandlers: Pick<
  HandlerMap,
  'theme.getTemplateId' | 'theme.setTemplateId' | 'themes.list'
> = {
  'theme.getTemplateId': () => getTemplateId(),
  'theme.setTemplateId': ({ templateId }) => setTemplateId(templateId),
  'themes.list': async () =>
    (await extensionsService.enabledThemeTemplates()).map(
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
