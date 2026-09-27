import { useState } from 'react'
import styled from 'styled-components'
import { ReferencesPanel } from './ReferencesPanel'
import { useDeleteComment, useUpsertComment } from '../../queries/comments'
import { Button } from '../../components/Button'
import { Stack } from '../../components/Layout'
import { TextArea } from '../../components/TextInput'
import type { CommentDraft, CommentReference, DraftAnchor } from '@shared/ipc/schemas/comment'
import type { RefAnchor } from './anchorLine'

export type CommentEditorTarget =
  | { kind: 'thread'; anchor: DraftAnchor }
  | { kind: 'reply'; threadId: string }
  | {
      kind: 'edit'
      id: string
      threadId: string
      initialBody: string
      initialReferences: CommentReference[]
    }

export interface CommentEditorProps {
  projectId: string
  pr: number
  refAnchor: RefAnchor | null
  targetedPaths: string[]
  target: CommentEditorTarget
  onSubmitted: () => void
  onCancel?: () => void
}

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space[2]};
`

export function CommentEditor({
  projectId,
  pr,
  refAnchor,
  targetedPaths,
  target,
  onSubmitted,
  onCancel
}: CommentEditorProps): React.JSX.Element {
  const [body, setBody] = useState(target.kind === 'edit' ? target.initialBody : '')
  const [references, setReferences] = useState<CommentReference[]>(
    target.kind === 'edit' ? target.initialReferences : []
  )
  const upsert = useUpsertComment(projectId, pr)
  const del = useDeleteComment(projectId, pr)

  const submitLabel = target.kind === 'edit' ? 'Save' : target.kind === 'reply' ? 'Reply' : 'Submit'

  function handleSubmit(): void {
    const trimmed = body.trim()
    if (!trimmed) return
    const draft: CommentDraft = {
      projectId,
      pr,
      id: target.kind === 'edit' ? target.id : null,
      threadId: target.kind === 'reply' || target.kind === 'edit' ? target.threadId : null,
      anchor: target.kind === 'thread' ? target.anchor : null,
      body: trimmed,
      references
    }
    upsert.mutate(draft, {
      onSuccess: () => {
        if (target.kind !== 'edit') {
          setBody('')
          setReferences([])
        }
        onSubmitted()
      }
    })
  }

  function handleDelete(): void {
    if (target.kind !== 'edit') return
    del.mutate(target.id, { onSuccess: onSubmitted })
  }

  return (
    <Stack>
      <TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment…"
        rows={3}
      />
      <ReferencesPanel
        projectId={projectId}
        refAnchor={refAnchor}
        targetedPaths={targetedPaths}
        references={references}
        onChange={setReferences}
      />
      <Actions>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        {target.kind === 'edit' && (
          <Button variant="danger" onClick={handleDelete} disabled={del.isPending}>
            Delete
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!body.trim() || upsert.isPending}
        >
          {submitLabel}
        </Button>
      </Actions>
    </Stack>
  )
}
