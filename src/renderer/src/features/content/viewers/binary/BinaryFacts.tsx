import type { ReactNode } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { SectionHeading } from '../../../../components/SectionHeading';
import { Surface } from '../../../../components/Surface';
import { byteUnit } from '../../../../helpers/binary';
import { ViewerFrame } from '../ViewerFrame';

const messages = defineMessages({
  path: {
    id: 'content.binaryViewer.path',
    defaultMessage: 'Path',
  },
});

const Card = styled(Surface).attrs({ $elevation: 'flat' as const })`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  max-width: 480px;
  padding: ${({ theme }) => theme.space[4]};
  text-align: left;
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[4]};
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Term = styled.dt`
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Value = styled.dd`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: ${({ theme }) => theme.colors.fg};
`;

const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
`;

function useFormatBytes(): (bytes: number, signed?: boolean) => string {
  const intl = useIntl();
  return (bytes, signed = false) => {
    const { value, unit } = byteUnit(bytes);
    return intl.formatNumber(value, {
      style: 'unit',
      unit,
      unitDisplay: unit === 'byte' ? 'long' : 'short',
      maximumFractionDigits: 1,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
  };
}

export function BinaryFact({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Term>{label}</Term>
      <Value>{children}</Value>
    </>
  );
}

export function BinaryFactPath({
  label,
  path,
}: {
  label: ReactNode;
  path: string;
}): React.JSX.Element {
  return (
    <BinaryFact label={label}>
      <Mono title={path}>{path}</Mono>
    </BinaryFact>
  );
}

export function BinaryFactSize({
  bytes,
  signed = false,
}: {
  bytes: number;
  signed?: boolean;
}): React.JSX.Element {
  const intl = useIntl();
  const formatBytes = useFormatBytes();
  return (
    <span title={intl.formatNumber(bytes, { style: 'unit', unit: 'byte', unitDisplay: 'long' })}>
      {formatBytes(bytes, signed)}
    </span>
  );
}

export function BinaryFacts({
  title,
  path,
  children,
}: {
  title: ReactNode;
  path: string;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <ViewerFrame $center>
      <Card>
        <SectionHeading title={title} />
        <Facts>
          <BinaryFactPath label={<FormattedMessage {...messages.path} />} path={path} />
          {children}
        </Facts>
      </Card>
    </ViewerFrame>
  );
}
