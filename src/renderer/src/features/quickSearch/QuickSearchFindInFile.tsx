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
import {
  findBestMatch,
  foldCase,
  matchOffsets,
  nextMatch,
  type TextMatch,
} from '../../helpers/match';
import { useActionHandler } from '../../keyboard/actionHandlers';
import { keyBindings } from '../../keyboard/bindings';
import { useKeybindingOverrides } from '../../queries/keybindings';
import { effectiveKey, keyLabel } from '../../helpers/key';
import { QuickSearchStatus } from './QuickSearchStatus';
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

  function stepBinding(chord: string): string | undefined {
    return keyBindings.find(
      (b) =>
        (b.id === 'findNext' || b.id === 'findPrevious') && effectiveKey(b, overrides) === chord,
    )?.id;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      editor?.view.focus();
    } else if (stepBinding(keyChord(e))) {
      e.preventDefault();
      step(stepBinding(keyChord(e)) === 'findNext' ? 1 : -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    }
  }

  useActionHandler('findNext', () => step(1));
  useActionHandler('findPrevious', () => step(-1));

  const stepKeys = Object.fromEntries(
    ['findNext', 'findPrevious'].map((id) => {
      const binding = keyBindings.find((b) => b.id === id);
      return [id, binding ? keyLabel(effectiveKey(binding, overrides)) : ''];
    }),
  );

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
              values={{ next: stepKeys.findNext, previous: stepKeys.findPrevious }}
            />
          )}
        </QuickSearchStatus>
      )}
    </>
  );
}
