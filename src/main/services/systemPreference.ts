import type { SystemPreference } from '@gepard/common';

export interface SystemPreferenceSource {
  read(): SystemPreference;
}

export class DefaultSystemPreferenceSource implements SystemPreferenceSource {
  read(): SystemPreference {
    return { mode: 'light', contrast: 'normal', reducedMotion: false };
  }
}

export class SystemPreferenceService {
  constructor(private readonly source: SystemPreferenceSource) {}

  get(): SystemPreference {
    return this.source.read();
  }
}
