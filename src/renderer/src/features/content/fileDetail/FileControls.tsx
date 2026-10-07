import { z } from 'zod';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  MoreHorizontal,
  Move,
  Sidebar,
} from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch } from '../../../state/AppContext';
import { useAcceptedFiles, useActiveFile, useLayout, useTargetPr } from '../../../state/hooks';
import { invoke } from '../../../ipc/client';
import { reportQueryError } from '../../../errors/report';
import { useSetLayout } from '../../../queries/projects';
import { useViewed } from '../../../queries/comments';
import { useCommands, useFileNavigation } from '../../../keyboard/useCommands';
import { useIsCheckedOutChangedFile } from '../../../queries/review';
import { IconButton } from '../../../components/IconButton';
import { Inline, Stack } from '../../../components/Layout';
import { Surface } from '../../../components/Surface';
import { SyncButton } from '../sync/SyncButton';
import { ComposeIssueButton } from '../issue/ComposeIssueButton';

const messages = defineMessages({
  viewed: {
    id: 'content.fileControls.viewed',
    defaultMessage: 'Viewed',
  },
  viewOptions: {
    id: 'content.fileControls.viewOptions',
    defaultMessage: 'View options',
  },
  move: {
    id: 'content.fileControls.move',
    defaultMessage: 'Move',
  },
  dock: {
    id: 'content.fileControls.dock',
    defaultMessage: 'Dock to file details',
  },
  undock: {
    id: 'content.fileControls.undock',
    defaultMessage: 'Detach from file details',
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

const Docked = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Row = styled(Inline)`
  padding: 0 ${({ theme }) => theme.space[1]};
`;

const NavRow = styled.div`
  display: flex;
`;

const NavTone = z.enum(['danger', 'success']);
type NavTone = z.infer<typeof NavTone>;

const NavButton = styled(IconButton)<{ $tone?: NavTone }>`
  flex: 1 1 0;
  width: auto;

  svg {
    stroke-width: 3;
  }

  ${({ $tone, theme }) =>
    $tone &&
    css`
      color: ${$tone === 'danger' ? theme.colors.danger : theme.colors.success};
    `}
`;

const ring = keyframes`
  from {
    transform: scale(0.4);
    opacity: 0.7;
  }
  to {
    transform: scale(2.4);
    opacity: 0;
  }
`;

const ViewedLabel = styled.label`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  align-self: stretch;
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radius.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const CheckboxWrap = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.success};
  pointer-events: none;
  animation: ${ring} 0.6s ease-out forwards;
`;

const ViewedInput = styled.input`
  position: relative;
  width: 20px;
  height: 20px;
  margin: 0;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.success};
`;

const MenuToggle = styled(IconButton)`
  margin-left: auto;
`;

const Grip = styled(IconButton)`
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
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

  const { x: initialX, y: initialY } = initial;
  useEffect(() => {
    if (!draggingRef.current) setOffset({ x: initialX, y: initialY });
  }, [initialX, initialY]);

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

export function FileControls({ docked = false }: { docked?: boolean }): React.JSX.Element {
  const intl = useIntl();
  const acceptedFiles = useAcceptedFiles();
  const layout = useLayout();
  const dispatch = useAppDispatch();
  const setLayout = useSetLayout();
  const pr = useTargetPr();
  const path = useActiveFile();
  const panelRef = useRef<HTMLDivElement>(null);
  const initialPosition = layout.fileControlsPosition ?? { x: 0, y: 0 };
  const { offset, onPointerDown, onKeyDown } = useDragOffset(panelRef, initialPosition, (next) => {
    dispatch({ type: 'layout/setFileControlsPosition', position: next });
    setLayout.mutate({ ...layout, fileControlsPosition: next });
  });

  const { data: viewed } = useViewed();
  const isChangedFile = useIsCheckedOutChangedFile(path);
  const commands = useCommands();
  const { canGoPrev, canGoNext } = useFileNavigation();
  const [pulse, setPulse] = useState(0);

  const isViewed = path !== null && (viewed?.find((v) => v.path === path)?.viewed ?? false);

  function openViewOptions(button: HTMLElement): void {
    const rect = button.getBoundingClientRect();
    invoke('contextMenu.showFileView', {
      x: rect.left,
      y: rect.bottom,
      wrapLongLines: layout.wrapLongLines,
      fullFileDiff: layout.fullFileDiff,
    })
      .then((pick) => {
        if (pick === 'wrapLongLines') commands.toggleWrapLines();
        if (pick === 'fullFile') commands.toggleFullFileDiff();
      })
      .catch((error: unknown) => reportQueryError('contextMenu.showFileView', error));
  }

  function toggleDocked(): void {
    dispatch({ type: 'layout/setFileControlsDocked', docked: !docked });
    setLayout.mutate({ ...layout, fileControlsDocked: !docked });
  }

  const Wrapper = docked ? Docked : Floating;

  return (
    <Wrapper
      ref={panelRef}
      style={docked ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <Stack>
        <Row>
          {pr !== null && path !== null && isChangedFile && (
            <ViewedLabel>
              <CheckboxWrap>
                {pulse > 0 && <Ring key={pulse} />}
                <ViewedInput
                  type="checkbox"
                  checked={isViewed}
                  onChange={(e) => {
                    commands.markViewed([path], e.target.checked);
                    if (e.target.checked) setPulse((n) => n + 1);
                  }}
                />
              </CheckboxWrap>
              {intl.formatMessage(messages.viewed)}
            </ViewedLabel>
          )}
          <MenuToggle
            icon={MoreHorizontal}
            size={14}
            label={intl.formatMessage(messages.viewOptions)}
            aria-haspopup="menu"
            onClick={(e) => openViewOptions(e.currentTarget)}
          />
          <IconButton
            icon={Sidebar}
            size={14}
            label={intl.formatMessage(docked ? messages.undock : messages.dock)}
            onClick={toggleDocked}
          />
          {!docked && (
            <Grip
              icon={Move}
              size={14}
              label={intl.formatMessage(messages.move)}
              onPointerDown={onPointerDown}
              onKeyDown={onKeyDown}
            />
          )}
        </Row>

        <NavRow>
          <NavButton
            icon={ArrowLeft}
            label={intl.formatMessage(messages.previousFile)}
            disabled={!canGoPrev}
            onClick={() => commands.prevFile()}
          />
          <NavButton
            $tone="danger"
            icon={CornerUpLeft}
            label={intl.formatMessage(messages.revertLast)}
            disabled={acceptedFiles.length === 0}
            onClick={() => commands.revertPrev()}
          />
          <NavButton
            $tone="success"
            icon={CornerUpRight}
            label={intl.formatMessage(messages.approveNext)}
            disabled={path === null}
            onClick={() => commands.acceptNext()}
          />
          <NavButton
            icon={ArrowRight}
            label={intl.formatMessage(messages.nextFile)}
            disabled={!canGoNext}
            onClick={() => commands.nextFile()}
          />
        </NavRow>

        {pr === null ? <ComposeIssueButton block /> : <SyncButton block />}
      </Stack>
    </Wrapper>
  );
}
