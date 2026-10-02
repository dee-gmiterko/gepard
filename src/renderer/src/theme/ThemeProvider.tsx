import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components';
import { invoke, useIpcEvent } from '../ipc/client';
import { useThemeTemplateId, useThemes } from '../queries/theme';
import { buildTheme } from './tokens';
import { resolveTemplate } from '../helpers/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemThemeSnapshot(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
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
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemThemeSnapshot);

  // The main process is authoritative: its portal sync overrides themeSource, which matchMedia may not reflect.
  useEffect(() => {
    invoke('theme.getSystemPrefersDark')
      .then(setSystemPrefersDark)
      .catch(() => {});
  }, []);

  useIpcEvent('theme.changed', (payload) => setSystemPrefersDark(payload.dark));

  const { data: templateId } = useThemeTemplateId();
  const resolvedTemplateId = templateId ?? null;
  const { data: templates } = useThemes();
  const theme = useMemo(
    () => buildTheme(resolveTemplate(resolvedTemplateId, systemPrefersDark, templates ?? [])),
    [resolvedTemplateId, systemPrefersDark, templates],
  );

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  );
}
