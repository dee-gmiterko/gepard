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
  edge: 'left' | 'right';
  onCommit: (width: number) => void;
  className?: string;
  children: React.ReactNode;
}

export function ResizablePanel({
  width,
  min,
  max,
  edge,
  onCommit,
  className,
  children,
}: ResizablePanelProps): React.JSX.Element {
  const [live, setLive] = useState<number | null>(null);
  const shownRef = useRef(width);
  useLayoutEffect(() => {
    shownRef.current = live ?? width;
  });
  const getValue = useCallback(() => shownRef.current, []);
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
    sign: edge === 'right' ? 1 : -1,
    getValue,
    onChange: setLive,
    onCommit: handleCommit,
  });

  return (
    <div className={className} style={{ width: live ?? width }}>
      <Handle $edge={edge} onPointerDown={onPointerDown} />
      {children}
    </div>
  );
}
