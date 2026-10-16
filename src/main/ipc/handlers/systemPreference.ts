import type { HandlerMap } from '../dispatch';
import type { SystemPreferenceService } from '../../services/systemPreference';

export class SystemPreferenceHandlers {
  constructor(private readonly systemPreference: SystemPreferenceService) {}

  toHandlerMap(): Pick<HandlerMap, 'systemPreference.get'> {
    return { 'systemPreference.get': () => this.systemPreference.get() };
  }
}
