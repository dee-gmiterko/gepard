import { Component, type ErrorInfo, type ReactNode } from 'react'
import styled from 'styled-components'
import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../i18n/defineMessages'
import { Button } from '../components/Button'
import { Message, centerLayout } from '../components/Message'
import { Stack } from '../components/Layout'
import { reportError } from './report'

const messages = defineMessages({
  crashed: {
    id: 'errors.errorBoundary.crashed',
    defaultMessage: 'This view crashed and could not continue.'
  },
  reload: {
    id: 'errors.errorBoundary.reload',
    defaultMessage: 'Reload'
  }
})

const Centered = styled.div`
  ${centerLayout}
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
        <Stack $gap={3} $align="center">
          <Message tone="danger">
            <FormattedMessage {...messages.crashed} />
          </Message>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <FormattedMessage {...messages.reload} />
          </Button>
        </Stack>
      </Centered>
    )
  }
}
