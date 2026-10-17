import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ReferencesPanel } from './ReferencesPanel';
import {
  initialReferenceChoices,
  pipelineRefsOf,
  type ReferenceChoices,
} from '../../helpers/reference';
import { useFileAnnotations } from '../../queries/checks';
import { useDerivedReferences } from './useDerivedReferences';
import { useUpsertComment, type CommentDraftBody } from '../../queries/comments';
import { Button } from '../../components/Button';
import { ActionRow, Stack } from '../../components/Layout';
import { TextArea } from '../../components/TextInput';
import type { CommentReference, DraftAnchor } from '@gepard/common';
import type { RefAnchor } from '../../helpers/anchor';
import { draftKeyOf } from '../../helpers/comment';
import { useActionHandler } from '../../keyboard/actionHandlers';
import { useUiDispatch, useUiStore } from '../../state/UiContext';

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
  const draftKey = draftKeyOf(target);
  const uiStore = useUiStore();
  const dispatch = useUiDispatch();
  const [focused, setFocused] = useState(false);
  const [body, setBody] = useState(() =>
    target.kind === 'edit'
      ? target.initialBody
      : ((draftKey && uiStore.getState().commentDrafts[draftKey]) ?? ''),
  );

  function updateBody(value: string): void {
    setBody(value);
    if (draftKey) dispatch({ type: 'commentDraft/set', key: draftKey, body: value });
  }
  const { data: annotations } = useFileAnnotations(
    target.kind === 'thread' && target.anchor.side === 'RIGHT' ? target.anchor.path : '',
  );
  const pipelineRefs = useMemo(() => {
    if (target.kind === 'edit')
      return target.initialReferences.filter((r) => r.kind === 'pipeline');
    if (target.kind !== 'thread' || target.anchor.line === null) return [];
    return pipelineRefsOf(annotations ?? [], target.anchor.path, target.anchor.line);
  }, [target, annotations]);
  const [choices, setChoices] = useState<ReferenceChoices>(() =>
    initialReferenceChoices(
      target.kind === 'edit'
        ? target.initialReferences
        : target.kind === 'thread'
          ? pipelineRefs
          : [],
    ),
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
          updateBody('');
          setChoices(initialReferenceChoices([]));
        }
        onSubmitted();
      },
    });
  }

  useActionHandler('submitComment', () => !upsert.isPending && handleSubmit(), focused);

  return (
    <Stack>
      <TextArea
        value={body}
        onChange={(e) => updateBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onCancel) {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={intl.formatMessage(messages.placeholder)}
        rows={3}
      />
      <ReferencesPanel
        refAnchor={refAnchor}
        choices={choices}
        onChoicesChange={setChoices}
        symbols={derivedReferences.symbols}
        symbolsLoading={derivedReferences.symbolsLoading}
        symbolDisabled={derivedReferences.symbolDisabled}
        exactDisabled={derivedReferences.exactDisabled}
        exactData={derivedReferences.exactData}
        exactFetching={derivedReferences.exactFetching}
        patterns={derivedReferences.patterns}
        pipelineRefs={pipelineRefs}
      />
      <ActionRow>
        {onCancel && (
          <Button
            onClick={() => {
              if (draftKey) dispatch({ type: 'commentDraft/set', key: draftKey, body: '' });
              onCancel();
            }}
          >
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
