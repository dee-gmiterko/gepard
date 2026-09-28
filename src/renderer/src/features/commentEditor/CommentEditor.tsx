import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ReferencesPanel } from './ReferencesPanel';
import { initialReferenceChoices, type ReferenceChoices } from './referenceChoices';
import { useDerivedReferences } from './useDerivedReferences';
import { useUpsertComment, type CommentDraftBody } from '../../queries/comments';
import { Button } from '../../components/Button';
import { ActionRow, Stack } from '../../components/Layout';
import { TextArea } from '../../components/TextInput';
import type { CommentReference, DraftAnchor } from '@gepard/common/ipc/schemas/comment';
import type { RefAnchor } from './anchorLine';

const messages = defineMessages({
  placeholder: {
    id: 'commentEditor.placeholder',
    defaultMessage: 'Leave a comment…',
  },
  cancel: {
    id: 'commentEditor.cancel',
    defaultMessage: 'Cancel',
  },
  save: {
    id: 'commentEditor.save',
    defaultMessage: 'Save',
  },
  reply: {
    id: 'commentEditor.reply',
    defaultMessage: 'Reply',
  },
  submit: {
    id: 'commentEditor.submit',
    defaultMessage: 'Submit',
  },
});

type CommentEditorTarget =
  | { kind: 'thread'; anchor: DraftAnchor }
  | { kind: 'reply'; threadId: string }
  | {
      kind: 'edit';
      id: string;
      threadId: string;
      initialBody: string;
      initialReferences: CommentReference[];
    };

interface CommentEditorProps {
  refAnchor: RefAnchor | null;
  target: CommentEditorTarget;
  onSubmitted: () => void;
  onCancel?: () => void;
}

export function CommentEditor({
  refAnchor,
  target,
  onSubmitted,
  onCancel,
}: CommentEditorProps): React.JSX.Element {
  const intl = useIntl();
  const [body, setBody] = useState(target.kind === 'edit' ? target.initialBody : '');
  const [choices, setChoices] = useState<ReferenceChoices>(() =>
    initialReferenceChoices(target.kind === 'edit' ? target.initialReferences : []),
  );
  const derivedReferences = useDerivedReferences(choices, refAnchor);
  const upsert = useUpsertComment();

  const submitMessage =
    target.kind === 'edit'
      ? messages.save
      : target.kind === 'reply'
        ? messages.reply
        : messages.submit;

  function handleSubmit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    const references: CommentReference[] = derivedReferences.references;
    const draft: CommentDraftBody = {
      id: target.kind === 'edit' ? target.id : null,
      threadId: target.kind === 'reply' || target.kind === 'edit' ? target.threadId : null,
      anchor: target.kind === 'thread' ? target.anchor : null,
      body: trimmed,
      references,
    };
    upsert.mutate(draft, {
      onSuccess: () => {
        if (target.kind !== 'edit') {
          setBody('');
          setChoices(initialReferenceChoices([]));
        }
        onSubmitted();
      },
    });
  }

  return (
    <Stack>
      <TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={intl.formatMessage(messages.placeholder)}
        rows={3}
      />
      <ReferencesPanel
        refAnchor={refAnchor}
        choices={choices}
        onChoicesChange={setChoices}
        symbols={derivedReferences.symbols}
        symbolsLoading={derivedReferences.symbolsLoading}
        symbolsError={derivedReferences.symbolsError}
        exactDisabled={derivedReferences.exactDisabled}
        exactData={derivedReferences.exactData}
        exactFetching={derivedReferences.exactFetching}
        patternDisabled={derivedReferences.patternDisabled}
        patternData={derivedReferences.patternData}
        patternFetching={derivedReferences.patternFetching}
        effectivePatternSymbol={derivedReferences.effectivePatternSymbol}
      />
      <ActionRow>
        {onCancel && (
          <Button onClick={onCancel}>
            <FormattedMessage {...messages.cancel} />
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!body.trim() || upsert.isPending}
        >
          <FormattedMessage {...submitMessage} />
        </Button>
      </ActionRow>
    </Stack>
  );
}
