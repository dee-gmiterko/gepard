import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components';
import type { SystemPreference } from '@gepard/common';
import { useSystemPreference } from '../queries/systemPreference';
import { HIGH_CONTRAST_QUERIES, mediaContrast, watchMedia } from './media';
import { useThemeTemplateId, useThemes } from '../queries/theme';
import { buildTheme } from './tokens';
import { resolveTemplate } from '../helpers/theme';

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
  const systemPreference = useSystemPreference();
  const [contrast, setContrast] = useState(mediaContrast);

  // Chromium reports the OS contrast setting on Windows and macOS; main covers Linux.
  useEffect(() => watchMedia(HIGH_CONTRAST_QUERIES, () => setContrast(mediaContrast())), []);

  useEffect(() => {
    document.documentElement.dataset.motion = systemPreference.reducedMotion ? 'reduced' : 'normal';
  }, [systemPreference.reducedMotion]);

  const { data: templateId } = useThemeTemplateId();
  const resolvedTemplateId = templateId ?? null;
  const { data: templates } = useThemes();
  const theme = useMemo(() => {
    const resolved: SystemPreference = {
      ...systemPreference,
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
