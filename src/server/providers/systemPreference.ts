import type { SystemPreference } from '@gepard/common';
import type { SystemPreferenceSource } from '@gepard/main/services/systemPreference';

export class DefaultSystemPreferenceSource implements SystemPreferenceSource {
  read(): SystemPreference {
    return { mode: 'light', contrast: 'normal', reducedMotion: false };
  }
}
