import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components';
import type { SystemThemePreference } from '@gepard/common';
import { invoke, useIpcEvent } from '../ipc/client';
import { useThemeTemplateId, useThemes } from '../queries/theme';
import { buildTheme } from './tokens';
import { resolveTemplate } from '../helpers/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const HIGH_CONTRAST_QUERIES = ['(prefers-contrast: more)', '(forced-colors: active)'];

function mediaMatches(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getMediaHighContrast(): boolean {
  return HIGH_CONTRAST_QUERIES.some(mediaMatches);
}

function getSystemPreferenceSnapshot(): SystemThemePreference {
  return { dark: mediaMatches(DARK_QUERY), highContrast: getMediaHighContrast() };
}

const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: ${({ theme }) => theme.mode};
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.fg};
    font-family: ${({ theme }) => theme.font.ui};
    font-size: ${({ theme }) => theme.font.size.md};
    line-height: ${({ theme }) => theme.font.lineHeight};
  }

  code,
  pre {
    font-family: ${({ theme }) => theme.font.mono};
  }
`;

export function AppThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [systemPreference, setSystemPreference] = useState(getSystemPreferenceSnapshot);
  const [mediaHighContrast, setMediaHighContrast] = useState(getMediaHighContrast);

  // The main process is authoritative: its portal sync overrides themeSource, which matchMedia may not reflect.
  useEffect(() => {
    invoke('theme.getSystemPreference')
      .then(setSystemPreference)
      .catch(() => {});
  }, []);

  useIpcEvent('theme.changed', setSystemPreference);

  // Chromium reports the OS contrast setting on Windows and macOS; main covers Linux.
  useEffect(() => {
    const lists = HIGH_CONTRAST_QUERIES.map((query) => window.matchMedia(query));
    const update = (): void => setMediaHighContrast(lists.some((list) => list.matches));
    for (const list of lists) list.addEventListener('change', update);
    return () => {
      for (const list of lists) list.removeEventListener('change', update);
    };
  }, []);

  const { data: templateId } = useThemeTemplateId();
  const resolvedTemplateId = templateId ?? null;
  const { data: templates } = useThemes();
  const theme = useMemo(() => {
    const system = {
      dark: systemPreference.dark,
      highContrast: systemPreference.highContrast || mediaHighContrast,
    };
    return buildTheme(resolveTemplate(resolvedTemplateId, system, templates ?? []));
  }, [resolvedTemplateId, systemPreference, mediaHighContrast, templates]);

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  );
}
