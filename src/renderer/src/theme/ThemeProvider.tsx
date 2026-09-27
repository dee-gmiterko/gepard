// Electron keeps the renderer's `prefers-color-scheme` in sync with
// `nativeTheme.shouldUseDarkColors`, but the matchMedia `change` event alone
// can arrive late in a background-throttled window, so main's
// `theme.changed` event (from `nativeTheme.on('updated')`) is treated as the
// live source of truth once it has fired at least once.
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ThemeProvider as StyledThemeProvider, createGlobalStyle } from 'styled-components'
import { useIpcEvent } from '../ipc/client'
import { darkTheme, lightTheme } from './tokens'

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
  const dark = mainDark ?? systemDark

  useIpcEvent('theme.changed', (payload) => setMainDark(payload.dark))

  const theme = dark ? darkTheme : lightTheme

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  )
}
