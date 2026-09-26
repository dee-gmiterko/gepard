// Start interface for managing projects (spec: "Projects (launchpad)") —
// selecting one from a GitHub url with prefill from the signed-in `gh`
// profile, remove, clone progress, open.
import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import styled from 'styled-components'
import { Download, Folder, Trash2 } from 'react-feather'
import { IconButton } from '../../components/IconButton'
import { Button } from '../../components/Button'
import { Inline } from '../../components/Layout'
import { TextInput } from '../../components/TextInput'
import { Message } from '../../components/Message'
import { useIpcEvent } from '../../ipc/client'
import { qk } from '../../queries/keys'
import {
  useAddProject,
  useCloneStart,
  useProjects,
  useRemoveProject,
  useViewer
} from '../../queries/projects'
import { useAppDispatch } from '../../state/AppContext'
import type { EventPayload } from '@shared/ipc/contract'

type CloneProgress = EventPayload<'clone.progress'>

const Page = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[6]} ${({ theme }) => theme.space[4]};
`

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.space[5]};
`

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: 600;
`

const ViewerBadge = styled(Inline)`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`

const Avatar = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`

const AddForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[2]};
`

const List = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.space[4]} 0 0;
  padding: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const Row = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const RowMain = styled.div`
  flex: 1;
  min-width: 0;
`

const RowName = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.colors.fg};
`

const RowUrl = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgSubtle};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ProgressBar = styled.div`
  position: relative;
  margin-top: ${({ theme }) => theme.space[1]};
  height: 6px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
`

const ProgressFill = styled.div`
  height: 100%;
  background: ${({ theme }) => theme.colors.accent};
  transition: width 0.2s ease;
`

const ProgressLabel = styled.div`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`

function isActiveClone(progress: CloneProgress | undefined): boolean {
  return progress !== undefined && progress.phase !== 'done' && progress.phase !== 'error'
}

export function Launchpad(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const qc = useQueryClient()
  const { data: viewer } = useViewer()
  const { data: projects, isLoading } = useProjects()
  const addProject = useAddProject()
  const removeProject = useRemoveProject()
  const cloneStart = useCloneStart()

  const [url, setUrl] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [progressById, setProgressById] = useState<Record<string, CloneProgress>>({})

  // Prefill from the signed-in gh profile (spec): until the user types, the
  // URL defaults to the viewer's own namespace so adding one of their own
  // repos only needs a name.
  const prefill = viewer ? `https://github.com/${viewer.login}/` : ''
  const urlValue = urlTouched ? url : prefill

  useIpcEvent('clone.progress', (payload) => {
    setProgressById((prev) => ({ ...prev, [payload.projectId]: payload }))
    if (payload.phase === 'done' || payload.phase === 'error') {
      qc.invalidateQueries({ queryKey: qk.projects() })
    }
    // A failed clone ('error' phase) is toasted by the always-mounted
    // subscription in main.tsx, not here: the Launchpad unmounts while
    // another project is open, and a clone can fail in the meantime.
  })

  function startClone(projectId: string): void {
    setProgressById((prev) => ({
      ...prev,
      [projectId]: { projectId, phase: 'counting', percent: 0 }
    }))
    // A rejection here (e.g. PROJECT_NOT_FOUND) is a real mutation failure
    // and already reaches the unified toast surface via the global mutation
    // cache (main.tsx); this local handler only needs to reset the row's
    // progress display.
    cloneStart.mutate(projectId, {
      onError: () =>
        setProgressById((prev) => {
          if (!(projectId in prev)) return prev
          const next = { ...prev }
          delete next[projectId]
          return next
        })
    })
  }

  function handleAdd(e: FormEvent): void {
    e.preventDefault()
    if (urlValue.trim().length === 0) return
    addProject.mutate(
      { url: urlValue.trim() },
      {
        onSuccess: (project) => {
          setUrl('')
          setUrlTouched(false)
          if (!project.cloned) startClone(project.id)
        }
      }
    )
  }

  function handleOpen(projectId: string): void {
    // Report 04 §5.2: refetch project-scoped data on project switch (the
    // working tree may have moved since it was last open).
    qc.invalidateQueries({ queryKey: qk.project(projectId) })
    dispatch({ type: 'project/open', projectId })
  }

  function handleRemove(projectId: string): void {
    removeProject.mutate(projectId)
    setProgressById((prev) => {
      if (!(projectId in prev)) return prev
      const next = { ...prev }
      delete next[projectId]
      return next
    })
  }

  return (
    <Page>
      <TopBar>
        <Title>Projects</Title>
        {viewer && (
          <ViewerBadge>
            <Avatar src={viewer.avatarUrl} alt="" />
            <span>{viewer.name ?? viewer.login}</span>
          </ViewerBadge>
        )}
      </TopBar>

      <AddForm onSubmit={handleAdd}>
        <TextInput
          type="text"
          placeholder="https://github.com/owner/repo"
          value={urlValue}
          onChange={(e) => {
            setUrl(e.target.value)
            setUrlTouched(true)
          }}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={addProject.isPending || urlValue.trim().length === 0}
        >
          Add project
        </Button>
      </AddForm>

      {isLoading && <Message>Loading projects…</Message>}
      {!isLoading && (projects?.length ?? 0) === 0 && (
        <Message>No projects yet — add one above.</Message>
      )}

      <List>
        {projects?.map((project) => {
          const progress = progressById[project.id]
          const cloning = isActiveClone(progress)
          return (
            <Row key={project.id}>
              <RowMain>
                <RowName>
                  {project.owner}/{project.repo}
                </RowName>
                <RowUrl>{project.url}</RowUrl>
                {cloning && (
                  <ProgressBar>
                    <ProgressFill style={{ width: `${progress?.percent ?? 0}%` }} />
                  </ProgressBar>
                )}
                {cloning && (
                  <ProgressLabel>
                    {progress?.phase}
                    {progress?.message ? ` — ${progress.message}` : ''}
                  </ProgressLabel>
                )}
              </RowMain>
              <Inline $gap={1}>
                {project.cloned ? (
                  <IconButton icon={Folder} label="Open" onClick={() => handleOpen(project.id)} />
                ) : (
                  <IconButton
                    icon={Download}
                    label="Clone"
                    disabled={cloning}
                    onClick={() => startClone(project.id)}
                  />
                )}
                <IconButton icon={Trash2} label="Remove" onClick={() => handleRemove(project.id)} />
              </Inline>
            </Row>
          )
        })}
      </List>
    </Page>
  )
}
