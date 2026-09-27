import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject
} from 'react'
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
import { Inline, Stack } from '../../../components/Layout'
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
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
`

const Row = styled(Inline)`
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

interface Point {
  x: number
  y: number
}

interface NaturalBox {
  left: number
  top: number
  width: number
  height: number
}

// `panel`'s current rect already includes `offset` (applied via CSS
// transform); subtracting it back out gives the un-offset position to clamp
// candidate offsets against, so the panel never ends up off-screen.
function naturalBox(panel: HTMLElement, offset: Point): NaturalBox {
  const rect = panel.getBoundingClientRect()
  return {
    left: rect.left - offset.x,
    top: rect.top - offset.y,
    width: rect.width,
    height: rect.height
  }
}

function clampToViewport(natural: NaturalBox, candidate: Point): Point {
  const minX = -natural.left
  const minY = -natural.top
  const maxX = Math.max(minX, window.innerWidth - natural.width - natural.left)
  const maxY = Math.max(minY, window.innerHeight - natural.height - natural.top)
  return {
    x: Math.min(Math.max(candidate.x, minX), maxX),
    y: Math.min(Math.max(candidate.y, minY), maxY)
  }
}

function useDragOffset(panelRef: RefObject<HTMLElement | null>): {
  offset: Point
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
} {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // If this unmounts mid-drag, the listeners must not outlive it.
  useEffect(() => () => cleanupRef.current?.(), [])

  function onPointerDown(e: PointerEvent<HTMLElement>): void {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const panel = panelRef.current
    const natural = panel ? naturalBox(panel, offset) : null
    start.current = { px: e.clientX, py: e.clientY, ...offset }
    const move = (ev: globalThis.PointerEvent): void => {
      const s = start.current
      if (!s) return
      const candidate = { x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py }
      setOffset(natural ? clampToViewport(natural, candidate) : candidate)
    }
    // Browsers fire pointercancel instead of pointerup when they interrupt a gesture.
    const end = (): void => {
      start.current = null
      cleanupRef.current?.()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    cleanupRef.current = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      cleanupRef.current = null
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>): void {
    const step = e.shiftKey ? GRIP_STEP * 4 : GRIP_STEP
    let candidate: Point
    switch (e.key) {
      case 'ArrowUp':
        candidate = { ...offset, y: offset.y - step }
        break
      case 'ArrowDown':
        candidate = { ...offset, y: offset.y + step }
        break
      case 'ArrowLeft':
        candidate = { ...offset, x: offset.x - step }
        break
      case 'ArrowRight':
        candidate = { ...offset, x: offset.x + step }
        break
      case 'Home':
        candidate = { x: 0, y: 0 }
        break
      default:
        return
    }
    e.preventDefault()
    const panel = panelRef.current
    setOffset(panel ? clampToViewport(naturalBox(panel, offset), candidate) : candidate)
  }

  return { offset, onPointerDown, onKeyDown }
}

export function FileControls(): React.JSX.Element | null {
  const intl = useIntl()
  const state = useAppState()
  const pr = state.targeting.pr
  const path = state.activeFile
  const [accordionOpen, setAccordionOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { offset, onPointerDown, onKeyDown } = useDragOffset(panelRef)

  const { data: viewed } = useViewed()
  const { mutate: setViewed } = useSetViewed()
  const { mutate: runSync, isPending: syncing } = useSync()
  const { data: pendingCount } = usePendingCount()
  const isChangedFile = useIsCheckedOutChangedFile(path)

  if (pr === null) return null

  const isViewed = path !== null && (viewed?.find((v) => v.path === path)?.viewed ?? false)

  return (
    <Floating ref={panelRef} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <Stack>
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
            <FileComments path={path} />
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
      </Stack>
    </Floating>
  )
}
