import { defineMessages, FormattedMessage } from 'react-intl';
import type { OverviewPr } from '@gepard/common';
import { Muted } from '../shared/overviewStyles';

const messages = defineMessages({
  open: {
    id: 'content.overview.project.summaryOpen',
    defaultMessage:
      '{open, plural, =0 {No open pull requests} one {# open pull request} other {# open pull requests}}',
  },
  waiting: {
    id: 'content.overview.project.summaryWaiting',
    defaultMessage: '{waiting} awaiting review',
  },
  drafts: {
    id: 'content.overview.project.summaryDrafts',
    defaultMessage: '{drafts, plural, one {# draft} other {# drafts}}',
  },
  separator: { id: 'content.overview.project.separator', defaultMessage: ' · ' },
});

export function ProjectSummary({ prs }: { prs: readonly OverviewPr[] }): React.JSX.Element {
  const waiting = prs.filter((p) => !p.isDraft && p.reviewDecision !== 'APPROVED').length;
  const drafts = prs.filter((p) => p.isDraft).length;
  return (
    <Muted>
      <FormattedMessage {...messages.open} values={{ open: prs.length }} />
      <FormattedMessage {...messages.separator} />
      <FormattedMessage {...messages.waiting} values={{ waiting }} />
      <FormattedMessage {...messages.separator} />
      <FormattedMessage {...messages.drafts} values={{ drafts }} />
    </Muted>
  );
}
