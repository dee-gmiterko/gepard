// File controls floating panel, default close to top right (spec) and
// movable by its grip: viewed checkbox, file comments accordion, Sync
// button. Comments/viewed exist only while a PR is targeted (report 04 §4.3:
// "With only a commit or folder targeted there is no comment editor, no
// viewed checkbox and no Sync") — the whole panel is hidden otherwise.
import { useRef, useState, type PointerEvent } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Move, RefreshCw } from 'react-feather'
import { useAppState } from '../../../state/AppContext'
import { useSetViewed, useSync, useViewed } from '../../../queries/comments'
import { Checkbox } from '../../../components/Checkbox'
import { Accordion } from '../../../components/Accordion'
import { Button } from '../../../components/Button'
import { FileComments } from '../../commentEditor/FileComments'

const Floating = styled.div`
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadow.floating};
  font-size: ${({ theme }) => theme.font.size.sm};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.space[1]};
`

const Grip = styled.span`
  display: inline-flex;
  margin-left: auto;
  color: ${({ theme }) => theme.colors.fgSubtle};
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

/** Offset from the default top-right position, changed by dragging the grip. */
function useDragOffset(): {
  offset: { x: number; y: number }
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
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
    const up = (): void => {
      start.current = null
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return { offset, onPointerDown }
}

export function FileControls(): React.JSX.Element | null {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const path = state.activeFile
  const [accordionOpen, setAccordionOpen] = useState(false)
  const { offset, onPointerDown } = useDragOffset()

  const { data: viewed } = useViewed(projectId, pr ?? NaN)
  const { mutate: setViewed } = useSetViewed(projectId, pr ?? NaN)
  const { mutate: runSync, isPending: syncing } = useSync(projectId, pr ?? NaN)

  if (pr === null) return null

  const isViewed = path !== null && (viewed?.find((v) => v.path === path)?.viewed ?? false)

  return (
    <Floating style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <Row>
        {path !== null && (
          <Checkbox
            checked={isViewed}
            onChange={(checked) => setViewed({ paths: [path], viewed: checked })}
            label="Viewed"
          />
        )}
        <Grip title="Move" onPointerDown={onPointerDown}>
          <Move size={14} />
        </Grip>
      </Row>

      {path !== null && (
        <Accordion
          open={accordionOpen}
          onToggle={() => setAccordionOpen((v) => !v)}
          title="File comments"
        >
          <FileComments projectId={projectId} pr={pr} path={path} />
        </Accordion>
      )}

      <Button block disabled={syncing} onClick={() => runSync('full')}>
        <Spinning size={14} $spinning={syncing} />
        Sync
      </Button>
    </Floating>
  )
}
