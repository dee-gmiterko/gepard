import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import styled, { css, keyframes } from 'styled-components';
import { ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, Move, RefreshCw } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { useSetLayout } from '../../../queries/projects';
import { usePendingCount, useSetViewed, useSync, useViewed } from '../../../queries/comments';
import { useCommands } from '../../../keyboard/useCommands';
import { useIsCheckedOutChangedFile } from '../useIsCheckedOutChangedFile';
import { Checkbox } from '../../../components/Checkbox';
import { Button } from '../../../components/Button';
import { IconButton } from '../../../components/IconButton';
import { Inline, Stack } from '../../../components/Layout';
import { Surface } from '../../../components/Surface';

const messages = defineMessages({
  viewed: {
    id: 'content.fileControls.viewed',
    defaultMessage: 'Viewed',
  },
  move: {
    id: 'content.fileControls.move',
    defaultMessage: 'Move',
  },
  sync: {
    id: 'content.fileControls.sync',
    defaultMessage: 'Sync',
  },
  previousFile: {
    id: 'content.fileControls.previousFile',
    defaultMessage: 'Previous file',
  },
  revertLast: {
    id: 'content.fileControls.revertLast',
    defaultMessage: 'Revert last approval',
  },
  approveNext: {
    id: 'content.fileControls.approveNext',
    defaultMessage: 'Approve and go to next file',
  },
  nextFile: {
    id: 'content.fileControls.nextFile',
    defaultMessage: 'Next file',
  },
  syncWithCount: {
    id: 'content.fileControls.syncWithCount',
    defaultMessage: 'Sync +{count}',
  },
});

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
`;

const Row = styled(Inline)`
  padding: 0 ${({ theme }) => theme.space[1]};
`;

const NavRow = styled.div`
  display: flex;
`;

const NavButton = styled(IconButton)<{ $tone?: 'danger' | 'success' }>`
  flex: 1 1 0;
  width: auto;
  ${({ $tone, theme }) =>
    $tone &&
    css`
      color: ${$tone === 'danger' ? theme.colors.danger : theme.colors.success};
    `}
`;

const Grip = styled(IconButton)`
  margin-left: auto;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const Spinning = styled(RefreshCw)<{ $spinning: boolean }>`
  ${({ $spinning }) =>
    $spinning &&
    css`
      animation: ${spin} 0.8s linear infinite;
    `}
`;

const GRIP_STEP = 16;
const EDGE_PADDING = 12;

interface Point {
  x: number;
  y: number;
}

interface NaturalBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function naturalBox(panel: HTMLElement, offset: Point): NaturalBox {
  const rect = panel.getBoundingClientRect();
  return {
    left: rect.left - offset.x,
    top: rect.top - offset.y,
    width: rect.width,
    height: rect.height,
  };
}

function clampToContainer(panel: HTMLElement, natural: NaturalBox, candidate: Point): Point {
  const container = (panel.offsetParent ?? panel.parentElement)?.getBoundingClientRect();
  if (!container) return candidate;
  const minX = container.left + EDGE_PADDING - natural.left;
  const minY = container.top + EDGE_PADDING - natural.top;
  const maxX = Math.max(minX, container.right - EDGE_PADDING - natural.width - natural.left);
  const maxY = Math.max(minY, container.bottom - EDGE_PADDING - natural.height - natural.top);
  return {
    x: Math.min(Math.max(candidate.x, minX), maxX),
    y: Math.min(Math.max(candidate.y, minY), maxY),
  };
}

function useDragOffset(
  panelRef: RefObject<HTMLElement | null>,
  initial: Point,
  onCommit: (offset: Point) => void,
): {
  offset: Point;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
} {
  const [offset, setOffset] = useState<Point>(initial);
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    if (!draggingRef.current) setOffset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.x, initial.y]);

  function onPointerDown(e: PointerEvent<HTMLElement>): void {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const panel = panelRef.current;
    const natural = panel ? naturalBox(panel, offset) : null;
    start.current = { px: e.clientX, py: e.clientY, ...offset };
    draggingRef.current = true;
    let latest = offset;
    const move = (ev: globalThis.PointerEvent): void => {
      const s = start.current;
      if (!s) return;
      const candidate = { x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py };
      latest = natural && panel ? clampToContainer(panel, natural, candidate) : candidate;
      setOffset(latest);
    };
    // Browsers fire pointercancel instead of pointerup when they interrupt a gesture.
    const end = (): void => {
      start.current = null;
      draggingRef.current = false;
      cleanupRef.current?.();
      onCommit(latest);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    cleanupRef.current = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      cleanupRef.current = null;
    };
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>): void {
    const step = e.shiftKey ? GRIP_STEP * 4 : GRIP_STEP;
    let candidate: Point;
    switch (e.key) {
      case 'ArrowUp':
        candidate = { ...offset, y: offset.y - step };
        break;
      case 'ArrowDown':
        candidate = { ...offset, y: offset.y + step };
        break;
      case 'ArrowLeft':
        candidate = { ...offset, x: offset.x - step };
        break;
      case 'ArrowRight':
        candidate = { ...offset, x: offset.x + step };
        break;
      case 'Home':
        candidate = { x: 0, y: 0 };
        break;
      default:
        return;
    }
    e.preventDefault();
    const panel = panelRef.current;
    const next = panel ? clampToContainer(panel, naturalBox(panel, offset), candidate) : candidate;
    setOffset(next);
    onCommit(next);
  }

  return { offset, onPointerDown, onKeyDown };
}

export function FileControls(): React.JSX.Element | null {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const setLayout = useSetLayout();
  const pr = state.targeting.pr;
  const path = state.activeFile;
  const panelRef = useRef<HTMLDivElement>(null);
  const initialPosition = state.layout.fileControlsPosition ?? { x: 0, y: 0 };
  const { offset, onPointerDown, onKeyDown } = useDragOffset(panelRef, initialPosition, (next) => {
    dispatch({ type: 'layout/setFileControlsPosition', position: next });
    setLayout.mutate({ ...state.layout, fileControlsPosition: next });
  });

  const { data: viewed } = useViewed();
  const { mutate: setViewed } = useSetViewed();
  const { mutate: runSync, isPending: syncing } = useSync();
  const { data: pendingCount } = usePendingCount();
  const isChangedFile = useIsCheckedOutChangedFile(path);
  const commands = useCommands();

  if (pr === null) return null;

  const isViewed = path !== null && (viewed?.find((v) => v.path === path)?.viewed ?? false);

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

        <NavRow>
          <NavButton
            icon={ArrowLeft}
            label={intl.formatMessage(messages.previousFile)}
            onClick={() => commands.prevFile()}
          />
          <NavButton
            $tone="danger"
            icon={CornerUpLeft}
            label={intl.formatMessage(messages.revertLast)}
            disabled={state.acceptedFiles.length === 0}
            onClick={() => commands.revertPrev()}
          />
          <NavButton
            $tone="success"
            icon={CornerUpRight}
            label={intl.formatMessage(messages.approveNext)}
            onClick={() => commands.acceptNext()}
          />
          <NavButton
            icon={ArrowRight}
            label={intl.formatMessage(messages.nextFile)}
            onClick={() => commands.nextFile()}
          />
        </NavRow>

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
  );
}
