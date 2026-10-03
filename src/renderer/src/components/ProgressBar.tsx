import styled from 'styled-components';

const Track = styled.span`
  display: inline-block;
  width: 64px;
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled.span<{ $percent: number }>`
  display: block;
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.success};
`;

export function ProgressBar({ done, total }: { done: number; total: number }): React.JSX.Element {
  return (
    <Track>
      <Fill $percent={total > 0 ? Math.round((done / total) * 100) : 0} />
    </Track>
  );
}
