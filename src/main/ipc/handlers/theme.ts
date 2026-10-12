import type { HandlerMap } from '../registry';
import { getTemplateId, setTemplateId } from '../../store/settings';
import { extensionRegistry } from '../../extensions/registry';
import { systemThemePreference } from '../../helpers/systemTheme';

export const themeHandlers: Pick<
  HandlerMap,
  'theme.getSystemPreference' | 'theme.getTemplateId' | 'theme.setTemplateId' | 'themes.list'
> = {
  'theme.getSystemPreference': () => systemThemePreference(),
  'theme.getTemplateId': () => getTemplateId(),
  'theme.setTemplateId': ({ templateId }) => setTemplateId(templateId),
  'themes.list': async () =>
    (await extensionRegistry.enabledThemeTemplates()).map(
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
