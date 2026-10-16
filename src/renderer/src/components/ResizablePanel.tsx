import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useResizeHandle } from '../hooks/useResizeHandle';
import { ResizeHandle } from './ResizeHandle';

const Handle = styled(ResizeHandle)<{ $edge: 'left' | 'right' }>`
  ${({ $edge }) => $edge}: -3px;
`;

interface ResizablePanelProps {
  width: number;
  min: number;
  max: number;
  maxShare: number;
  edge: 'left' | 'right';
  collapsedWidth?: number;
  onCommit: (width: number) => void;
  className?: string;
  children: React.ReactNode;
}

export function ResizablePanel({
  width,
  min,
  max,
  maxShare,
  edge,
  collapsedWidth,
  onCommit,
  className,
  children,
}: ResizablePanelProps): React.JSX.Element {
  const [live, setLive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shownRef = useRef(width);
  useLayoutEffect(() => {
    shownRef.current = live ?? width;
  });
  const getValue = useCallback(() => shownRef.current, []);
  const getMax = useCallback(
    () => (ref.current?.parentElement?.clientWidth ?? Infinity) * maxShare,
    [maxShare],
  );
  const handleCommit = useCallback(
    (value: number) => {
      setLive(null);
      onCommit(value);
    },
    [onCommit],
  );

  const { onPointerDown } = useResizeHandle({
    min,
    max,
    getMax,
    sign: edge === 'right' ? 1 : -1,
    getValue,
    onChange: setLive,
    onCommit: handleCommit,
  });

  return (
    <div
      ref={ref}
      className={className}
      style={
        collapsedWidth !== undefined
          ? { width: collapsedWidth }
          : { width: live ?? width, maxWidth: `${maxShare * 100}cqw` }
      }
    >
      {collapsedWidth === undefined && <Handle $edge={edge} onPointerDown={onPointerDown} />}
      {children}
    </div>
  );
}
