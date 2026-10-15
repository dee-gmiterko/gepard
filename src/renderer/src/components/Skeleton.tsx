import styled, { css, keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const Block = styled.span<{ $width: string; $height: string }>`
  display: inline-block;
  vertical-align: middle;
  width: ${({ $width }) => $width};
  max-width: 100%;
  height: ${({ $height }) => $height};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.border};

  @media (prefers-reduced-motion: no-preference) {
    ${css`
      animation: ${pulse} 1.4s ease-in-out infinite;
    `}
  }
`;

export function Skeleton({
  width = '100%',
  height = '1em',
}: {
  width?: string;
  height?: string;
}): React.JSX.Element {
  return <Block $width={width} $height={height} aria-hidden="true" />;
}
