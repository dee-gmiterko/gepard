import { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { useSetViewed, useViewed } from '../../../../queries/comments';
import { Button } from '../../../../components/Button';
import { IconButton } from '../../../../components/IconButton';
import { Inline, Stack } from '../../../../components/Layout';
import { PathLabel } from '../../../../components/PathLabel';

const messages = defineMessages({
  markAllViewed: {
    id: 'content.massActions.markAllViewed',
    defaultMessage: 'Mark all viewed',
  },
  applied: {
    id: 'content.massActions.applied',
    defaultMessage: 'Viewed',
  },
  showFiles: {
    id: 'content.massActions.showFiles',
    defaultMessage: 'Show files',
  },
  hideFiles: {
    id: 'content.massActions.hideFiles',
    defaultMessage: 'Hide files',
  },
});

const Files = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 160px;
  overflow: auto;
  padding: ${({ theme }) => theme.space[1]} 0;
`;

const Title = styled.span`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
`;

export function MassActionRow({
  message,
  paths,
}: {
  message: MessageDescriptor;
  paths: string[];
}): React.JSX.Element {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const { data: viewed } = useViewed();
  const setViewed = useSetViewed();
  const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path));
  const applied = paths.every((p) => viewedPaths.has(p));

  return (
    <Stack $gap={1}>
      <Inline>
        <Title>
          <FormattedMessage {...message} values={{ count: paths.length }} />
        </Title>
        <Button
          variant={applied ? 'primary' : 'secondary'}
          aria-pressed={applied}
          onClick={() => setViewed.mutate({ paths, viewed: !applied })}
        >
          {intl.formatMessage(applied ? messages.applied : messages.markAllViewed)}
        </Button>
        <IconButton
          icon={open ? ChevronDown : ChevronRight}
          size={14}
          label={intl.formatMessage(open ? messages.hideFiles : messages.showFiles)}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
      </Inline>
      {open && (
        <Files>
          {paths.map((p) => (
            <PathLabel key={p} $small title={p}>
              {p}
            </PathLabel>
          ))}
        </Files>
      )}
    </Stack>
  );
}
