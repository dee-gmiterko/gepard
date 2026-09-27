import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Move, RefreshCw } from 'react-feather'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
import { useAppState } from '../../../state/AppContext'
import { usePendingCount, useSetViewed, useSync, useViewed } from '../../../queries/comments'
import { useIsCheckedOutChangedFile } from '../commentScope'
import { Checkbox } from '../../../components/Checkbox'
import { Accordion } from '../../../components/Accordion'
import { Button } from '../../../components/Button'
import { IconButton } from '../../../components/IconButton'
import { Surface } from '../../../components/Surface'
import { FileComments } from '../../commentEditor/FileComments'

const messages = defineMessages({
  viewed: {
    id: 'content.fileControls.viewed',
    defaultMessage: 'Viewed'
  },
  move: {
    id: 'content.fileControls.move',
    defaultMessage: 'Move'
  },
  fileComments: {
    id: 'content.fileControls.fileComments',
    defaultMessage: 'File comments'
  },
  sync: {
    id: 'content.fileControls.sync',
    defaultMessage: 'Sync'
  },
  syncWithCount: {
    id: 'content.fileControls.syncWithCount',
    defaultMessage: 'Sync +{count}'
  }
})

const Floating = styled(Surface).attrs({ $elevation: 'floating' as const })`
  position: absolute;
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[3]};
  z-index: ${({ theme }) => theme.z.floating};
  width: 280px;
  max-height: calc(100% - ${({ theme }) => theme.space[6]});
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.space[1]};
`

const Grip = styled(IconButton)`
  margin-left: auto;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

const Spinning = styled(RefreshCw)<{ $spinning: boolean }>`
  ${({ $spinning }) =>
    $spinning &&
    css`
      animation: ${spin} 0.8s linear infinite;
    `}
`

const GRIP_STEP = 16

function useDragOffset(): {
  offset: { x: number; y: number }
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
} {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  function onPointerDown(e: PointerEvent<HTMLElement>): void {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    start.current = { px: e.clientX, py: e.clientY, ...offset }
    const move = (ev: globalThis.PointerEvent): void => {
      const s = start.current
      if (s) setOffset({ x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py })
    }
    // Browsers fire pointercancel instead of pointerup when they interrupt a gesture.
    const end = (): void => {
      start.current = null
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>): void {
    const step = e.shiftKey ? GRIP_STEP * 4 : GRIP_STEP
    switch (e.key) {
      case 'ArrowUp':
        setOffset((o) => ({ ...o, y: o.y - step }))
        break
      case 'ArrowDown':
        setOffset((o) => ({ ...o, y: o.y + step }))
        break
      case 'ArrowLeft':
        setOffset((o) => ({ ...o, x: o.x - step }))
        break
      case 'ArrowRight':
        setOffset((o) => ({ ...o, x: o.x + step }))
        break
      case 'Home':
        setOffset({ x: 0, y: 0 })
        break
      default:
        return
    }
    e.preventDefault()
  }

  return { offset, onPointerDown, onKeyDown }
}

export function FileControls(): React.JSX.Element | null {
  const intl = useIntl()
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const path = state.activeFile
  const [accordionOpen, setAccordionOpen] = useState(false)
  const { offset, onPointerDown, onKeyDown } = useDragOffset()

  const { data: viewed } = useViewed(projectId, pr ?? NaN)
  const { mutate: setViewed } = useSetViewed(projectId, pr ?? NaN)
  const { mutate: runSync, isPending: syncing } = useSync(projectId, pr ?? NaN)
  const { data: pendingCount } = usePendingCount(projectId, pr ?? NaN)
  const isChangedFile = useIsCheckedOutChangedFile(path)

  if (pr === null) return null

  const isViewed = path !== null && (viewed?.find((v) => v.path === path)?.viewed ?? false)

  return (
    <Floating style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <Row>
        {path !== null && isChangedFile && (
          <Checkbox
            checked={isViewed}
            onChange={(checked) => setViewed({ paths: [path], viewed: checked })}
            label={intl.formatMessage(messages.viewed)}
          />
        )}
        <Grip
          icon={Move}
          size={14}
          label={intl.formatMessage(messages.move)}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />
      </Row>

      {path !== null && isChangedFile && (
        <Accordion
          open={accordionOpen}
          onToggle={() => setAccordionOpen((v) => !v)}
          title={intl.formatMessage(messages.fileComments)}
        >
          <FileComments projectId={projectId} pr={pr} path={path} />
        </Accordion>
      )}

      <Button block disabled={syncing} onClick={() => runSync('full')}>
        <Spinning size={14} $spinning={syncing} />
        {pendingCount ? (
          <FormattedMessage {...messages.syncWithCount} values={{ count: pendingCount }} />
        ) : (
          <FormattedMessage {...messages.sync} />
        )}
      </Button>
    </Floating>
  )
}
