import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components';
import type { SystemPreference, ThemeContrast } from '@gepard/common';
import { invoke, useIpcEvent } from '../ipc/client';
import { useThemeTemplateId, useThemes } from '../queries/theme';
import { buildTheme } from './tokens';
import { resolveTemplate } from '../helpers/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const HIGH_CONTRAST_QUERIES = ['(prefers-contrast: more)', '(forced-colors: active)'];

function mediaMatches(query: string): boolean {
  return window.matchMedia(query).matches;
}

function mediaContrast(): ThemeContrast {
  return HIGH_CONTRAST_QUERIES.some(mediaMatches) ? 'high' : 'normal';
}

function mediaSystemPreference(): SystemPreference {
  return { mode: mediaMatches(DARK_QUERY) ? 'dark' : 'light', contrast: mediaContrast() };
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
  const [systemPreference, setSystemPreference] = useState(mediaSystemPreference);
  const [contrast, setContrast] = useState(mediaContrast);

  // The main process is authoritative: its portal sync overrides themeSource, which matchMedia may not reflect.
  useEffect(() => {
    invoke('systemPreference.get')
      .then(setSystemPreference)
      .catch(() => {});
  }, []);

  useIpcEvent('systemPreference.changed', setSystemPreference);

  // Chromium reports the OS contrast setting on Windows and macOS; main covers Linux.
  useEffect(() => {
    const lists = HIGH_CONTRAST_QUERIES.map((query) => window.matchMedia(query));
    const update = (): void => setContrast(mediaContrast());
    for (const list of lists) list.addEventListener('change', update);
    return () => {
      for (const list of lists) list.removeEventListener('change', update);
    };
  }, []);

  const { data: templateId } = useThemeTemplateId();
  const resolvedTemplateId = templateId ?? null;
  const { data: templates } = useThemes();
  const theme = useMemo(() => {
    const resolved: SystemPreference = {
      mode: systemPreference.mode,
      contrast: systemPreference.contrast === 'high' || contrast === 'high' ? 'high' : 'normal',
    };
    return buildTheme(resolveTemplate(resolvedTemplateId, resolved, templates ?? []));
  }, [resolvedTemplateId, systemPreference, contrast, templates]);

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  );
}
