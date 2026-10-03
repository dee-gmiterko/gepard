import styled from 'styled-components';

type Tone = 'success' | 'muted';

const Track = styled.span<{ $width: string }>`
  display: inline-block;
  flex-shrink: 0;
  width: ${({ $width }) => $width};
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled.span<{ $percent: number; $tone: Tone }>`
  display: block;
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.colors.success : theme.colors.fgMuted};
`;

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  tone?: Tone;
  width?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'success',
  width = '64px',
}: ProgressBarProps): React.JSX.Element {
  const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <Track
      $width={width}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <Fill $percent={percent} $tone={tone} />
    </Track>
  );
}
