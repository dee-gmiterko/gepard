import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ChevronDown, ChevronUp } from 'react-feather';
import { useActiveEditor } from '../../codeEditor/activeEditor';
import { revealDocRange } from '../../codeEditor/reveal';
import { IconButton } from '../../components/IconButton';
import { Inline } from '../../components/Layout';
import { TextInput } from '../../components/TextInput';
import { Message } from '../../components/Message';
import { Caption } from '../../components/Caption';
import {
  findBestMatch,
  foldCase,
  matchOffsets,
  nextMatch,
  type TextMatch,
} from '../../helpers/match';
import { useActionHandler } from '../../keyboard/actionHandlers';
import { useKeybindingOverrides } from '../../queries/keybindings';
import { bindingKeyLabel } from '../../helpers/key';
import { useQuickSearchAutoFocus } from './useQuickSearchAutoFocus';

const messages = defineMessages({
  findPlaceholder: {
    id: 'quickSearch.find.placeholder',
    defaultMessage: 'Find in file…',
  },
  findNoEditor: {
    id: 'quickSearch.find.noEditor',
    defaultMessage: 'No text file is open.',
  },
  findHint: {
    id: 'quickSearch.find.hint',
    defaultMessage: '{next}: next match, {previous}: previous, Esc: close.',
  },
  findLine: {
    id: 'quickSearch.find.line',
    defaultMessage: 'Line {line}',
  },
  findPosition: {
    id: 'quickSearch.find.position',
    defaultMessage: '{index} of {total} · Line {line}',
  },
  findPrevious: {
    id: 'quickSearch.find.previous',
    defaultMessage: 'Previous match',
  },
  findNext: {
    id: 'quickSearch.find.next',
    defaultMessage: 'Next match',
  },
  noMatches: {
    id: 'quickSearch.find.noMatches',
    defaultMessage: 'No matches.',
  },
});

const QuickSearchStatus = styled(Caption)`
  padding: 0 ${({ theme }) => theme.space[1]};
`;

const StepButton = styled(IconButton)`
  flex-shrink: 0;
`;

export function QuickSearchFindInFile({ onClose }: { onClose: () => void }): React.JSX.Element {
  const intl = useIntl();
  const inputRef = useQuickSearchAutoFocus();
  const editor = useActiveEditor();
  const [text, setText] = useState('');
  const [anchor] = useState(() => editor?.view.state.selection.main.from ?? 0);
  const [stepped, setStepped] = useState<TextMatch | null>(null);

  const doc = useMemo(() => editor?.doc.toString() ?? '', [editor]);
  const folded = useMemo(() => foldCase(doc), [doc]);
  const best = useMemo(() => findBestMatch(doc, text, anchor, folded), [doc, text, anchor, folded]);
  const offsets = useMemo(() => matchOffsets(doc, text, folded), [doc, text, folded]);
  const match = stepped ?? best;

  useEffect(() => {
    if (editor && match) revealDocRange(editor.view, match.from, match.to);
  }, [editor, match]);

  function step(direction: 1 | -1): void {
    if (!match) return;
    const next = nextMatch(doc, text, match, direction, folded);
    if (next) setStepped(next);
  }

  const { data: overrides } = useKeybindingOverrides();

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    onClose();
    editor?.view.focus();
  }

  useActionHandler('findNext', () => step(1));
  useActionHandler('findPrevious', () => step(-1));

  const line = editor && match ? editor.doc.lineAt(match.from).number : null;
  const index = match ? offsets.indexOf(match.from) : -1;
  const canStep = offsets.length > 1;

  return (
    <>
      <Inline $gap={1}>
        <TextInput
          ref={inputRef}
          type="text"
          value={text}
          placeholder={intl.formatMessage(messages.findPlaceholder)}
          disabled={!editor}
          onChange={(e) => {
            setText(e.target.value);
            setStepped(null);
          }}
          onKeyDown={onKeyDown}
        />
        <StepButton
          icon={ChevronUp}
          label={intl.formatMessage(messages.findPrevious)}
          disabled={!canStep}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => step(-1)}
        />
        <StepButton
          icon={ChevronDown}
          label={intl.formatMessage(messages.findNext)}
          disabled={!canStep}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => step(1)}
        />
      </Inline>
      {!editor ? (
        <Message layout="inline" tone="subtle">
          <FormattedMessage {...messages.findNoEditor} />
        </Message>
      ) : (
        <QuickSearchStatus>
          {line !== null && index !== -1 ? (
            <FormattedMessage
              {...messages.findPosition}
              values={{ index: index + 1, total: offsets.length, line }}
            />
          ) : line !== null ? (
            <FormattedMessage {...messages.findLine} values={{ line }} />
          ) : text ? (
            <FormattedMessage {...messages.noMatches} />
          ) : (
            <FormattedMessage
              {...messages.findHint}
              values={{
                next: bindingKeyLabel('findNext', overrides),
                previous: bindingKeyLabel('findPrevious', overrides),
              }}
            />
          )}
        </QuickSearchStatus>
      )}
    </>
  );
}
