// The `prefers-color-scheme` matchMedia `change` event can arrive late in a
// background-throttled Electron window.
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components'
import { useIpcEvent } from '../ipc/client'
import { useThemeTemplateId } from '../queries/theme'
import { buildTheme } from './tokens'
import { resolveTemplate } from './resolveTemplate'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToSystemTheme(callback: () => void): () => void {
  const mql = window.matchMedia(DARK_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSystemThemeSnapshot(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

export const GlobalStyle = createGlobalStyle`
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
`

export function AppThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    () => false
  )
  const [mainDark, setMainDark] = useState<boolean | null>(null)
  const systemPrefersDark = mainDark ?? systemDark

  useIpcEvent('theme.changed', (payload) => setMainDark(payload.dark))

  const { data: templateId } = useThemeTemplateId()
  const resolvedTemplateId = templateId ?? null
  const theme = useMemo(
    () => buildTheme(resolveTemplate(resolvedTemplateId, systemPrefersDark)),
    [resolvedTemplateId, systemPrefersDark]
  )

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  )
}
