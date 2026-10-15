import type { HandlerMap } from '../registry';
import { systemPreference } from '../../helpers/systemPreference';

export class SystemPreferenceHandlers {
  toHandlerMap(): Pick<HandlerMap, 'systemPreference.get'> {
    return { 'systemPreference.get': () => systemPreference() };
  }
}
