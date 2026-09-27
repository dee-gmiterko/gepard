import type { HandlerMap } from '../registry'
import { getTemplateId, setTemplateId } from '../../store/theme'

export const themeHandlers: Pick<HandlerMap, 'theme.getTemplateId' | 'theme.setTemplateId'> = {
  'theme.getTemplateId': () => getTemplateId(),
  'theme.setTemplateId': ({ templateId }) => setTemplateId(templateId)
}
