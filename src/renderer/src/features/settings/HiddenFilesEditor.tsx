import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';
import { Caption } from '../../components/Caption';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { TextArea } from '../../components/TextInput';

const messages = defineMessages({
  hint: {
    id: 'settings.hiddenFiles.hint',
    defaultMessage: 'One regular expression per line. Matching files are hidden from file views.',
  },
  placeholder: {
    id: 'settings.hiddenFiles.placeholder',
    defaultMessage: '\\.lock$',
  },
  invalid: {
    id: 'settings.hiddenFiles.invalid',
    defaultMessage: 'Ignored invalid expressions: {patterns}',
  },
  saveFailed: {
    id: 'settings.hiddenFiles.saveFailed',
    defaultMessage: 'Failed to save hidden files.',
  },
});

const Hint = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const Warning = styled(Caption)`
  display: block;
  margin-top: ${({ theme }) => theme.space[1]};
  color: ${({ theme }) => theme.colors.danger};
`;

function parsePatterns(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function invalidPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((pattern) => {
    try {
      new RegExp(pattern);
      return false;
    } catch {
      return true;
    }
  });
}

export interface HiddenFilesEditorProps {
  title: string;
  patterns: readonly string[] | undefined;
  failed: boolean;
  onSave: (patterns: string[]) => void;
}

export function HiddenFilesEditor({
  title,
  patterns,
  failed,
  onSave,
}: HiddenFilesEditorProps): React.JSX.Element {
  const intl = useIntl();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? patterns?.join('\n') ?? '';

  const invalid = invalidPatterns(parsePatterns(text));

  function commit(): void {
    const next = parsePatterns(text);
    if (patterns && next.join('\n') === patterns.join('\n')) return;
    onSave(next);
  }

  return (
    <Section $flush>
      <SectionHeading title={title} />
      <Hint>
        <FormattedMessage {...messages.hint} />
      </Hint>
      <TextArea
        aria-label={title}
        value={text}
        placeholder={intl.formatMessage(messages.placeholder)}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {invalid.length > 0 && (
        <Warning>
          <FormattedMessage {...messages.invalid} values={{ patterns: invalid.join(', ') }} />
        </Warning>
      )}
      {failed && (
        <Warning>
          <FormattedMessage {...messages.saveFailed} />
        </Warning>
      )}
    </Section>
  );
}
