import { useMemo } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { ImageData } from '@shared/ipc/schemas/pr';
import { Image } from '../../../../components/Image';
import { Message } from '../../../../components/Message';
import { ViewerFrame } from '../ViewerFrame';
import { imageSrc } from '../utils/imageSrc';

const messages = defineMessages({
  before: {
    id: 'content.imageDiffViewer.before',
    defaultMessage: 'Before',
  },
  after: {
    id: 'content.imageDiffViewer.after',
    defaultMessage: 'After',
  },
  noImage: {
    id: 'content.imageDiffViewer.noImage',
    defaultMessage: 'No image',
  },
  beforeAlt: {
    id: 'content.imageDiffViewer.beforeAlt',
    defaultMessage: 'Before: {path}',
  },
  afterAlt: {
    id: 'content.imageDiffViewer.afterAlt',
    defaultMessage: 'After: {path}',
  },
});

const Side = styled.div`
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: ${({ theme }) => theme.space[4]};

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const Label = styled.div`
  margin-bottom: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

function ImageSide({
  label,
  alt,
  path,
  image,
}: {
  label: MessageDescriptor;
  alt: MessageDescriptor;
  path: string;
  image: ImageData | null;
}): React.JSX.Element {
  const intl = useIntl();
  const url = useMemo(() => (image ? imageSrc(image) : null), [image]);

  return (
    <Side>
      <Label>
        <FormattedMessage {...label} />
      </Label>
      {url ? (
        <Image src={url} alt={intl.formatMessage(alt, { path })} />
      ) : (
        <Message tone="subtle" layout="inline">
          <FormattedMessage {...messages.noImage} />
        </Message>
      )}
    </Side>
  );
}

export function ImageDiffViewer({
  path,
  before,
  after,
}: {
  path: string;
  before: ImageData | null;
  after: ImageData | null;
}): React.JSX.Element {
  return (
    <ViewerFrame>
      <ImageSide label={messages.before} alt={messages.beforeAlt} path={path} image={before} />
      <ImageSide label={messages.after} alt={messages.afterAlt} path={path} image={after} />
    </ViewerFrame>
  );
}
