import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { Surface } from '../../../../components/Surface';
import { Markdown } from '../../../../components/Markdown';
import { Panel } from '../shared/Panel';
import { Muted } from '../shared/overviewStyles';

const messages = defineMessages({
  title: { id: 'content.overview.pr.description', defaultMessage: 'Description' },
  none: {
    id: 'content.overview.pr.noDescription',
    defaultMessage: 'No description provided.',
  },
});

const Scroll = styled(Surface).attrs({ $elevation: 'flat' })`
  max-height: 240px;
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
`;

export function DescriptionPanel({ body }: { body: string }): React.JSX.Element {
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      {body.trim() ? (
        <Scroll>
          <Markdown>{body}</Markdown>
        </Scroll>
      ) : (
        <Muted>
          <FormattedMessage {...messages.none} />
        </Muted>
      )}
    </Panel>
  );
}
