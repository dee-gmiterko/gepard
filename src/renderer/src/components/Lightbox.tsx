import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Maximize, X, ZoomIn, ZoomOut } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import type { LightboxContent } from '../state/reducer';
import {
  initialView,
  MAX_SCALE,
  MIN_SCALE,
  panView,
  zoomView,
  type View,
} from '../helpers/lightbox';
import { IconButton } from './IconButton';
import { Surface } from './Surface';

const messages = defineMessages({
  close: { id: 'components.lightbox.close', defaultMessage: 'Close' },
  zoomIn: { id: 'components.lightbox.zoomIn', defaultMessage: 'Zoom in' },
  zoomOut: { id: 'components.lightbox.zoomOut', defaultMessage: 'Zoom out' },
  reset: { id: 'components.lightbox.reset', defaultMessage: 'Reset zoom' },
});

const Dialog = styled.dialog`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: none;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.overlay};
  color: ${({ theme }) => theme.colors.fg};

  &::backdrop {
    background: transparent;
  }
`;

const Stage = styled.div<{ $dragging: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: ${({ $dragging }) => ($dragging ? 'grabbing' : 'grab')};
  touch-action: none;
`;

const Content = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 90vw;
  max-height: 85vh;
  user-select: none;

  img {
    max-width: 90vw;
    max-height: 85vh;
    background: ${({ theme }) => theme.colors.bgSubtle};
    -webkit-user-drag: none;
  }

  svg {
    width: min(90vw, 1400px);
    max-width: none;
    height: auto;
    max-height: 85vh;
  }
`;

const Controls = styled(Surface).attrs({ $elevation: 'floating' as const })`
  position: absolute;
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[3]};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]};
`;

const Percent = styled.span`
  min-width: 4ch;
  text-align: center;
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-variant-numeric: tabular-nums;
`;

export function Lightbox({
  content,
  onClose,
}: {
  content: LightboxContent;
  onClose: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const label = content.kind === 'image' ? content.alt : content.label;

  return (
    <Dialog
      ref={dialogRef}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Stage
        $dragging={dragging}
        data-testid="lightbox-stage"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onWheel={(e) => setView((v) => zoomView(v, e.deltaY < 0 ? 1 : -1))}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragRef.current = { x: e.clientX, y: e.clientY };
          setDragging(true);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const last = dragRef.current;
          if (!last) return;
          dragRef.current = { x: e.clientX, y: e.clientY };
          setView((v) => panView(v, e.clientX - last.x, e.clientY - last.y));
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onDoubleClick={() => setView(initialView)}
      >
        <Content
          data-testid="lightbox-content"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {content.kind === 'image' ? (
            <img src={content.src} alt={content.alt} draggable={false} />
          ) : (
            <div
              role="img"
              aria-label={content.label}
              dangerouslySetInnerHTML={{ __html: content.svg }}
            />
          )}
        </Content>
      </Stage>
      <Controls>
        <IconButton
          icon={ZoomOut}
          label={intl.formatMessage(messages.zoomOut)}
          disabled={view.scale <= MIN_SCALE}
          onClick={() => setView((v) => zoomView(v, -1))}
        />
        <Percent>
          {intl.formatNumber(view.scale, { style: 'percent', maximumFractionDigits: 0 })}
        </Percent>
        <IconButton
          icon={ZoomIn}
          label={intl.formatMessage(messages.zoomIn)}
          disabled={view.scale >= MAX_SCALE}
          onClick={() => setView((v) => zoomView(v, 1))}
        />
        <IconButton
          icon={Maximize}
          label={intl.formatMessage(messages.reset)}
          onClick={() => setView(initialView)}
        />
        <IconButton icon={X} label={intl.formatMessage(messages.close)} onClick={onClose} />
      </Controls>
    </Dialog>
  );
}
