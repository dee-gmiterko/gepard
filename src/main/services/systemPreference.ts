import type { SystemPreference } from '@gepard/common';

export interface SystemPreferenceSource {
  read(): SystemPreference;
}

export class SystemPreferenceService {
  constructor(private readonly source: SystemPreferenceSource) {}

  get(): SystemPreference {
    return this.source.read();
  }
}
