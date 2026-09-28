import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';

const NEAR_END_ROWS = 10;

const Scroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Spacer = styled.div`
  position: relative;
  width: 100%;
`;

const Slot = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  overflow: hidden;

  & > * {
    flex: 1;
    min-width: 0;
  }
`;

export interface VirtualListProps {
  rowCount: number;
  rowHeight: number;
  getKey: (index: number) => string;
  renderRow: (index: number) => ReactNode;
  onNearEnd?: () => void;
  overscan?: number;
  role?: string;
}

export function VirtualList({
  rowCount,
  rowHeight,
  getKey,
  renderRow,
  onNearEnd,
  overscan = 8,
  role,
}: VirtualListProps): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const nearEndRef = useRef(onNearEnd);

  useEffect(() => {
    nearEndRef.current = onNearEnd;
  }, [onNearEnd]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = (): void => setViewport({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(viewport.top / rowHeight) - overscan);
  const last = Math.min(
    rowCount - 1,
    Math.ceil((viewport.top + viewport.height) / rowHeight) + overscan,
  );

  useEffect(() => {
    if (viewport.height > 0 && last >= rowCount - NEAR_END_ROWS) nearEndRef.current?.();
  }, [last, rowCount, viewport.height]);

  const rows: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    rows.push(
      <Slot key={getKey(i)} style={{ top: i * rowHeight, height: rowHeight }}>
        {renderRow(i)}
      </Slot>,
    );
  }

  return (
    <Scroller
      ref={scrollerRef}
      role={role}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setViewport((v) => (v.top === top ? v : { ...v, top }));
      }}
    >
      <Spacer style={{ height: rowCount * rowHeight }}>{rows}</Spacer>
    </Scroller>
  );
}
