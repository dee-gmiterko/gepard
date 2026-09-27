import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import styled from 'styled-components'
import { Download, Folder, Trash2 } from 'react-feather'
import { IconButton } from '../../components/IconButton'
import { Button } from '../../components/Button'
import { Ellipsis } from '../../components/Ellipsis'
import { Inline } from '../../components/Layout'
import { List, ListRow } from '../../components/List'
import { Message } from '../../components/Message'
import { useIpcEvent } from '../../ipc/client'
import { qk } from '../../queries/keys'
import {
  useAddProject,
  useCloneStart,
  useProjects,
  useRemoveProject,
  useViewer,
  useViewerRepos
} from '../../queries/projects'
import { useAppDispatch } from '../../state/AppContext'
import { RepoUrlCombobox } from './RepoUrlCombobox'
import { ExtensionsPanel } from './ExtensionsPanel'
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

const ProjectsList = styled(List)`
  margin-top: ${({ theme }) => theme.space[4]};
`

const RowMain = styled.div`
  flex: 1;
  min-width: 0;
`

const RowName = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.colors.fg};
`

const RowUrl = styled(Ellipsis)`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgSubtle};
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
  const { data: viewerRepos, isFetching: viewerReposLoading } = useViewerRepos()
  const { data: projects, isLoading } = useProjects()
  const addProject = useAddProject()
  const removeProject = useRemoveProject()
  const cloneStart = useCloneStart()

  const [url, setUrl] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [progressById, setProgressById] = useState<Record<string, CloneProgress>>({})

  const prefill = viewer ? `https://github.com/${viewer.login}/` : ''
  const urlValue = urlTouched ? url : prefill

  useIpcEvent('clone.progress', (payload) => {
    setProgressById((prev) => ({ ...prev, [payload.projectId]: payload }))
    if (payload.phase === 'done' || payload.phase === 'error') {
      qc.invalidateQueries({ queryKey: qk.projects() })
    }
  })

  function startClone(projectId: string): void {
    setProgressById((prev) => ({
      ...prev,
      [projectId]: { projectId, phase: 'counting', percent: 0 }
    }))
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
        <RepoUrlCombobox
          value={urlValue}
          onChange={(next) => {
            setUrl(next)
            setUrlTouched(true)
          }}
          repos={viewerRepos ?? []}
          loading={viewerReposLoading}
          placeholder="https://github.com/owner/repo"
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

      <ProjectsList>
        {projects?.map((project) => {
          const progress = progressById[project.id]
          const cloning = isActiveClone(progress)
          return (
            <ListRow
              key={project.id}
              $clickable={project.cloned}
              onClick={project.cloned ? () => handleOpen(project.id) : undefined}
            >
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
              <Inline $gap={1} onClick={(e) => e.stopPropagation()}>
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
            </ListRow>
          )
        })}
      </ProjectsList>

      <ExtensionsPanel />
    </Page>
  )
}
