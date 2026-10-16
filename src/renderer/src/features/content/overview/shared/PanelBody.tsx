import type { ReactNode } from 'react';
import { QueryState } from './QueryState';
import { SkeletonRows } from './SkeletonRows';

export function PanelBody({
  isPending,
  error = null,
  rows = 4,
  children,
}: {
  isPending: boolean;
  error?: Error | null;
  rows?: number;
  children: ReactNode;
}): React.JSX.Element {
  if (isPending) return <SkeletonRows rows={rows} />;
  if (error) return <QueryState isLoading={false} error={error} />;
  return <>{children}</>;
}
