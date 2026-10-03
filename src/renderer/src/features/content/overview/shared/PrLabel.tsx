import { defineMessages, FormattedMessage } from 'react-intl';
import styled, { css } from 'styled-components';

const messages = defineMessages({
  prLabel: { id: 'content.overview.prLabel', defaultMessage: '#{number} {title}' },
});

const Label = styled.span<{ $truncate: boolean }>`
  min-width: 0;
  ${({ $truncate }) =>
    $truncate &&
    css`
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `}
`;

export function PrLabel({
  number,
  title,
  truncate = true,
}: {
  number: number;
  title: string;
  truncate?: boolean;
}): React.JSX.Element {
  return (
    <Label $truncate={truncate}>
      <FormattedMessage {...messages.prLabel} values={{ number, title }} />
    </Label>
  );
}
