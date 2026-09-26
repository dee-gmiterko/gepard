// Renderer-originated React render errors must reach the same unified
// surface as everything else (coordinator spec). React discards the crashed
// subtree, so this is the one legitimate leftover "error rendering": a
// single top-level fallback, not a per-panel duplicate. Mounted around <App/>
// only (main.tsx), inside AppProvider, so ToastHost — a sibling, not a
// descendant of App — stays mounted and still shows the toast.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import styled from 'styled-components'
import { Button } from '../components/Button'
import { Message } from '../components/Message'
import { Stack } from '../components/Layout'
import { reportError } from './report'

const Centered = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
`

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError({
      scope: 'render',
      message: error.message || String(error),
      detail: [error.stack, info.componentStack].filter(Boolean).join('\n')
    })
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children
    return (
      <Centered>
        <Stack $gap={3} style={{ alignItems: 'center' }}>
          <Message tone="danger">This view crashed and could not continue.</Message>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
      </Centered>
    )
  }
}
