import styled from 'styled-components';
import { HighlightedText, type TextRange } from '../HighlightedText';
import { truncate } from '../Ellipsis';
import { LineTag } from '../LineTag';

const Row = styled.span`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[2]};
  flex: 1;
  min-width: 0;
`;

const LineNo = styled(LineTag)`
  min-width: 3em;
  text-align: right;
  color: ${({ theme }) => theme.colors.fgSubtle};
`;

const Preview = styled.span`
  flex: 1;
  min-width: 0;
  ${truncate}
  white-space: pre;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fg};
`;

export function MatchLine({
  line,
  preview,
  spans,
}: {
  line: number;
  preview: string;
  spans: readonly TextRange[];
}): React.JSX.Element {
  const indent = preview.length - preview.trimStart().length;
  const shifted = spans.map(([start, end]): TextRange => [
    Math.max(start, indent) - indent,
    Math.max(end, indent) - indent,
  ]);
  return (
    <Row>
      <LineNo>{line}</LineNo>
      <Preview>
        <HighlightedText text={preview.slice(indent)} ranges={shifted} />
      </Preview>
    </Row>
  );
}
