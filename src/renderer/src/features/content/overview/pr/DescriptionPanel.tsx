import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { UseQueryResult } from '@tanstack/react-query';
import type { PrOverviewDetails } from '@gepard/common';
import { Surface } from '../../../../components/Surface';
import { Markdown } from '../../../../components/Markdown';
import { Panel } from '../shared/Panel';
import { PanelBody } from '../shared/PanelBody';
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

function DescriptionBody({ body }: { body: string }): React.JSX.Element {
  return body.trim() ? (
    <Scroll>
      <Markdown>{body}</Markdown>
    </Scroll>
  ) : (
    <Muted>
      <FormattedMessage {...messages.none} />
    </Muted>
  );
}

export function DescriptionPanel({
  detailsQuery,
}: {
  detailsQuery: UseQueryResult<PrOverviewDetails>;
}): React.JSX.Element {
  const { data, isPending, error } = detailsQuery;
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <PanelBody isPending={isPending} error={error}>
        {data && <DescriptionBody body={data.body} />}
      </PanelBody>
    </Panel>
  );
}
