import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import styled from 'styled-components'
import { Download, Folder, Settings, Trash2 } from 'react-feather'
import { FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { IconButton } from '../../components/IconButton'
import { Button } from '../../components/Button'
import { Caption } from '../../components/Caption'
import { Ellipsis } from '../../components/Ellipsis'
import { Inline } from '../../components/Layout'
import { List, ListRow, RowTitle } from '../../components/List'
import { Message } from '../../components/Message'
import { SectionHeading } from '../../components/SectionHeading'
import { invoke, useIpcEvent } from '../../ipc/client'
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
import type { EventPayload } from '@shared/ipc/contract'

type CloneProgress = EventPayload<'clone.progress'>

const messages = defineMessages({
  title: {
    id: 'launchpad.title',
    defaultMessage: 'Projects'
  },
  urlPlaceholder: {
    id: 'launchpad.urlPlaceholder',
    defaultMessage: 'https://github.com/owner/repo'
  },
  addProject: {
    id: 'launchpad.addProject',
    defaultMessage: 'Add project'
  },
  loading: {
    id: 'launchpad.loading',
    defaultMessage: 'Loading projects…'
  },
  empty: {
    id: 'launchpad.empty',
    defaultMessage: 'No projects yet — add one above.'
  },
  open: {
    id: 'launchpad.open',
    defaultMessage: 'Open'
  },
  clone: {
    id: 'launchpad.clone',
    defaultMessage: 'Clone'
  },
  remove: {
    id: 'launchpad.remove',
    defaultMessage: 'Remove'
  },
  openSettings: {
    id: 'launchpad.openSettings',
    defaultMessage: 'Settings'
  },
  confirmRemoveQuestion: {
    id: 'launchpad.confirmRemoveQuestion',
    defaultMessage: 'Remove this project and its local review data?'
  },
  cancelRemove: {
    id: 'launchpad.cancelRemove',
    defaultMessage: 'Cancel'
  },
  phaseCounting: {
    id: 'launchpad.progress.counting',
    defaultMessage: 'Counting'
  },
  phaseCompressing: {
    id: 'launchpad.progress.compressing',
    defaultMessage: 'Compressing'
  },
  phaseReceiving: {
    id: 'launchpad.progress.receiving',
    defaultMessage: 'Receiving'
  },
  phaseResolving: {
    id: 'launchpad.progress.resolving',
    defaultMessage: 'Resolving'
  },
  phaseCheckout: {
    id: 'launchpad.progress.checkout',
    defaultMessage: 'Checkout'
  },
  phaseCountingDetail: {
    id: 'launchpad.progress.countingDetail',
    defaultMessage: 'Counting — {detail}'
  },
  phaseCompressingDetail: {
    id: 'launchpad.progress.compressingDetail',
    defaultMessage: 'Compressing — {detail}'
  },
  phaseReceivingDetail: {
    id: 'launchpad.progress.receivingDetail',
    defaultMessage: 'Receiving — {detail}'
  },
  phaseResolvingDetail: {
    id: 'launchpad.progress.resolvingDetail',
    defaultMessage: 'Resolving — {detail}'
  },
  phaseCheckoutDetail: {
    id: 'launchpad.progress.checkoutDetail',
    defaultMessage: 'Checkout — {detail}'
  },
  projectSlug: {
    id: 'launchpad.projectSlug',
    defaultMessage: '{owner}/{repo}'
  }
})

type ActivePhase = Exclude<CloneProgress['phase'], 'done' | 'error'>

function phaseLabel(phase: ActivePhase): MessageDescriptor {
  switch (phase) {
    case 'counting':
      return messages.phaseCounting
    case 'compressing':
      return messages.phaseCompressing
    case 'receiving':
      return messages.phaseReceiving
    case 'resolving':
      return messages.phaseResolving
    case 'checkout':
      return messages.phaseCheckout
  }
}

function phaseDetailLabel(phase: ActivePhase): MessageDescriptor {
  switch (phase) {
    case 'counting':
      return messages.phaseCountingDetail
    case 'compressing':
      return messages.phaseCompressingDetail
    case 'receiving':
      return messages.phaseReceivingDetail
    case 'resolving':
      return messages.phaseResolvingDetail
    case 'checkout':
      return messages.phaseCheckoutDetail
  }
}

const Page = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[6]} ${({ theme }) => theme.space[4]};
`

const TopBar = styled.div`
  margin-bottom: ${({ theme }) => theme.space[5]};
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
  const intl = useIntl()
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
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

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

  async function handleOpen(projectId: string): Promise<void> {
    qc.invalidateQueries({ queryKey: qk.project(projectId) })
    qc.removeQueries({ queryKey: qk.open(projectId) })
    try {
      const opened = await qc.fetchQuery({
        queryKey: qk.open(projectId),
        queryFn: () => invoke('projects.open', { projectId }),
        staleTime: Infinity
      })
      dispatch({
        type: 'project/open',
        projectId,
        targeting: opened.targeting,
        layout: opened.layout
      })
    } catch {
      // Reported via the query cache's global error handler.
    }
  }

  function handleRemove(projectId: string): void {
    removeProject.mutate(projectId)
    setConfirmRemoveId(null)
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
        <SectionHeading
          as="h1"
          size="lg"
          title={<FormattedMessage {...messages.title} />}
          actions={
            <Inline $gap={2}>
              {viewer && (
                <ViewerBadge>
                  <Avatar src={viewer.avatarUrl} alt="" />
                  <span>{viewer.name ?? viewer.login}</span>
                </ViewerBadge>
              )}
              <IconButton
                icon={Settings}
                label={intl.formatMessage(messages.openSettings)}
                onClick={() => dispatch({ type: 'settings/setOpen', open: true })}
              />
            </Inline>
          }
        />
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
          placeholder={intl.formatMessage(messages.urlPlaceholder)}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={addProject.isPending || urlValue.trim().length === 0}
        >
          <FormattedMessage {...messages.addProject} />
        </Button>
      </AddForm>

      {isLoading && (
        <Message>
          <FormattedMessage {...messages.loading} />
        </Message>
      )}
      {!isLoading && (projects?.length ?? 0) === 0 && (
        <Message>
          <FormattedMessage {...messages.empty} />
        </Message>
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
                <RowTitle>
                  <FormattedMessage
                    {...messages.projectSlug}
                    values={{ owner: project.owner, repo: project.repo }}
                  />
                </RowTitle>
                <RowUrl>{project.url}</RowUrl>
                {cloning && (
                  <ProgressBar>
                    <ProgressFill style={{ width: `${progress?.percent ?? 0}%` }} />
                  </ProgressBar>
                )}
                {cloning &&
                  progress &&
                  (() => {
                    const phase = progress.phase as ActivePhase
                    const detail = progress.message
                    return detail ? (
                      <ProgressLabel>
                        <FormattedMessage {...phaseDetailLabel(phase)} values={{ detail }} />
                      </ProgressLabel>
                    ) : (
                      <ProgressLabel>{intl.formatMessage(phaseLabel(phase))}</ProgressLabel>
                    )
                  })()}
              </RowMain>
              <Inline $gap={1} onClick={(e) => e.stopPropagation()}>
                {project.cloned ? (
                  <IconButton
                    icon={Folder}
                    label={intl.formatMessage(messages.open)}
                    onClick={() => handleOpen(project.id)}
                  />
                ) : (
                  <IconButton
                    icon={Download}
                    label={intl.formatMessage(messages.clone)}
                    disabled={cloning}
                    onClick={() => startClone(project.id)}
                  />
                )}
                {confirmRemoveId === project.id ? (
                  <>
                    <Caption>
                      <FormattedMessage {...messages.confirmRemoveQuestion} />
                    </Caption>
                    <Button
                      variant="danger"
                      disabled={cloning || removeProject.isPending}
                      onClick={() => handleRemove(project.id)}
                    >
                      <FormattedMessage {...messages.remove} />
                    </Button>
                    <Button onClick={() => setConfirmRemoveId(null)}>
                      <FormattedMessage {...messages.cancelRemove} />
                    </Button>
                  </>
                ) : (
                  <IconButton
                    icon={Trash2}
                    label={intl.formatMessage(messages.remove)}
                    disabled={cloning}
                    onClick={() => setConfirmRemoveId(project.id)}
                  />
                )}
              </Inline>
            </ListRow>
          )
        })}
      </ProjectsList>
    </Page>
  )
}
