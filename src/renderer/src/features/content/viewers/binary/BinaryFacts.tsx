import type { ReactNode } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import { SectionHeading } from '../../../../components/SectionHeading';
import { Surface } from '../../../../components/Surface';
import { ViewerFrame } from '../ViewerFrame';
import { BinaryFactPath } from './BinaryFactPath';

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
