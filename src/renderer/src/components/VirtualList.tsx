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
  scrollTo?: { key: string; index: number };
}

export function VirtualList({
  rowCount,
  rowHeight,
  getKey,
  renderRow,
  onNearEnd,
  overscan = 8,
  role,
  scrollTo,
}: VirtualListProps): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollRow: 0, height: 0 });
  const nearEndRef = useRef(onNearEnd);

  useEffect(() => {
    nearEndRef.current = onNearEnd;
  }, [onNearEnd]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = (): void =>
      setViewport({ scrollRow: Math.floor(el.scrollTop / rowHeight), height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rowHeight]);

  const first = Math.max(0, viewport.scrollRow - overscan);
  const last = Math.min(
    rowCount - 1,
    viewport.scrollRow + Math.ceil(viewport.height / rowHeight) + overscan,
  );

  useEffect(() => {
    if (viewport.height > 0 && last >= rowCount - NEAR_END_ROWS) nearEndRef.current?.();
  }, [last, rowCount, viewport.height]);

  const appliedScrollKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!scrollTo) {
      appliedScrollKey.current = null;
      return;
    }
    if (!el || viewport.height === 0 || scrollTo.index < 0 || scrollTo.index >= rowCount) return;
    if (appliedScrollKey.current === scrollTo.key) return;
    appliedScrollKey.current = scrollTo.key;
    const top = scrollTo.index * rowHeight;
    if (top < el.scrollTop || top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTop = top - Math.max(0, (el.clientHeight - rowHeight) / 2);
    }
  }, [scrollTo, rowCount, rowHeight, viewport.height]);

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
        const scrollRow = Math.floor(e.currentTarget.scrollTop / rowHeight);
        setViewport((v) => (v.scrollRow === scrollRow ? v : { ...v, scrollRow }));
      }}
    >
      <Spacer style={{ height: rowCount * rowHeight }}>{rows}</Spacer>
    </Scroller>
  );
}
