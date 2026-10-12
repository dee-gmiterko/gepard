import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Accordion } from '../../components/Accordion';
import { Checkbox } from '../../components/Checkbox';
import { Stack } from '../../components/Layout';
import { Message } from '../../components/Message';
import { sameRef } from '../../helpers/reference';
import type { CommentReference } from '@gepard/common';

const messages = defineMessages({
  title: {
    id: 'commentEditor.pipelineFailure.title',
    defaultMessage: 'Pipeline failure',
  },
});

export function PipelineFailureSection({
  refs,
  selected,
  onToggleRef,
}: {
  refs: CommentReference[];
  selected: CommentReference[];
  onToggleRef: (ref: CommentReference) => void;
}): React.JSX.Element {
  const intl = useIntl();

  return (
    <Stack>
      {refs.map((r) => {
        const checked = selected.some((c) => sameRef(c, r));
        return (
          <Accordion
            key={r.detail}
            open={checked}
            onToggle={() => onToggleRef(r)}
            leading={
              <Checkbox
                checked={checked}
                ariaLabel={intl.formatMessage(messages.title)}
                onChange={() => onToggleRef(r)}
              />
            }
            title={<FormattedMessage {...messages.title} />}
          >
            <Message layout="inline">{r.detail}</Message>
          </Accordion>
        );
      })}
    </Stack>
  );
}
