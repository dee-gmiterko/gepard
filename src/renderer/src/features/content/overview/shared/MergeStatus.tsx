import { FormattedMessage, useIntl } from 'react-intl';
import type { MergeReadiness } from '@gepard/common';
import { Stack } from '../../../../components/Layout';
import { Message } from '../../../../components/Message';
import { blockerTexts, mergeMessages, warningTexts } from './mergeReadiness';

export function MergeStatus({ readiness }: { readiness: MergeReadiness }): React.JSX.Element {
  const intl = useIntl();
  if (readiness.state === 'CHECKING') {
    return (
      <Message tone="subtle" layout="inline">
        <FormattedMessage {...mergeMessages.checking} />
      </Message>
    );
  }
  if (readiness.state === 'CONFLICTING') {
    return (
      <Message tone="danger" layout="inline">
        <FormattedMessage {...mergeMessages.conflicting} />
      </Message>
    );
  }
  if (readiness.state === 'BLOCKED') {
    return (
      <Stack $gap={1}>
        <Message tone="danger" layout="inline">
          <FormattedMessage {...mergeMessages.blocked} />
        </Message>
        {blockerTexts(intl, readiness).map((text) => (
          <Message key={text} tone="danger" layout="inline">
            {text}
          </Message>
        ))}
      </Stack>
    );
  }
  return (
    <Stack $gap={1}>
      <Message layout="inline">
        <FormattedMessage {...mergeMessages.ready} />
      </Message>
      {warningTexts(intl, readiness).map((text) => (
        <Message key={text} tone="warning" layout="inline">
          {text}
        </Message>
      ))}
    </Stack>
  );
}
