import type { HandlerMap } from '../registry';
import { systemPreference } from '../../helpers/systemPreference';

export const systemPreferenceHandlers: Pick<HandlerMap, 'systemPreference.get'> = {
  'systemPreference.get': () => systemPreference(),
};
