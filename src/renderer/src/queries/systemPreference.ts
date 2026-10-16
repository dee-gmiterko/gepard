import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SystemPreference } from '@gepard/common';
import { invoke, subscribe } from '../ipc/client';
import {
  DARK_QUERY,
  HIGH_CONTRAST_QUERIES,
  REDUCED_MOTION_QUERY,
  mediaSystemPreference,
  watchMedia,
} from '../theme/media';
import { qk } from './keys';

// The desktop host is authoritative: its portal sync overrides themeSource, which matchMedia may not reflect.
// A browser has no host to ask, so its media queries are the only source.
export function useSystemPreference(): SystemPreference {
  const qc = useQueryClient();
  const { host } = window.gepard;
  const { data } = useQuery({
    queryKey: qk.systemPreference(),
    queryFn: () => (host === 'desktop' ? invoke('systemPreference.get') : mediaSystemPreference()),
    placeholderData: mediaSystemPreference,
    staleTime: Infinity,
  });

  useEffect(() => {
    const set = (next: SystemPreference): void => {
      qc.setQueryData<SystemPreference>(qk.systemPreference(), next);
    };
    if (host === 'desktop') return subscribe('systemPreference.changed', set);
    return watchMedia([DARK_QUERY, REDUCED_MOTION_QUERY, ...HIGH_CONTRAST_QUERIES], () =>
      set(mediaSystemPreference()),
    );
  }, [qc, host]);

  return data ?? mediaSystemPreference();
}
