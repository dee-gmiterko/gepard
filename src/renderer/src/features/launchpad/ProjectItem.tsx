import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styled, { keyframes } from 'styled-components';
import { Download, Folder, RefreshCw, Trash2 } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Ellipsis } from '../../components/Ellipsis';
import { Inline } from '../../components/Layout';
import { ListRow, RowTitle } from '../../components/List';
import { reportQueryError } from '../../errors/report';
import { useIpcEvent } from '../../ipc/client';
import { qk } from '../../queries/keys';
import {
  useCloneStart,
  useFetchProject,
  useLaunchingProjectIds,
  useOpenProject,
  useRemoveProject,
} from '../../queries/projects';
import type { EventPayload, Project } from '@gepard/common';

type CloneProgress = EventPayload<'clone.progress'>;

const messages = defineMessages({
  open: {
    id: 'launchpad.open',
    defaultMessage: 'Open',
  },
  clone: {
    id: 'launchpad.clone',
    defaultMessage: 'Clone',
  },
  remove: {
    id: 'launchpad.remove',
    defaultMessage: 'Remove',
  },
  fetch: {
    id: 'launchpad.fetch',
    defaultMessage: 'Fetch',
  },
  launching: {
    id: 'launchpad.launching',
    defaultMessage: 'Opening in a new window…',
  },
  confirmRemoveQuestion: {
    id: 'launchpad.confirmRemoveQuestion',
    defaultMessage: 'Remove this project and its local review data?',
  },
  cancelRemove: {
    id: 'launchpad.cancelRemove',
    defaultMessage: 'Cancel',
  },
  phaseCounting: {
    id: 'launchpad.progress.counting',
    defaultMessage: 'Counting',
  },
  phaseCompressing: {
    id: 'launchpad.progress.compressing',
    defaultMessage: 'Compressing',
  },
  phaseReceiving: {
    id: 'launchpad.progress.receiving',
    defaultMessage: 'Receiving',
  },
  phaseResolving: {
    id: 'launchpad.progress.resolving',
    defaultMessage: 'Resolving',
  },
  phaseCheckout: {
    id: 'launchpad.progress.checkout',
    defaultMessage: 'Checkout',
  },
  phaseCountingDetail: {
    id: 'launchpad.progress.countingDetail',
    defaultMessage: 'Counting — {detail}',
  },
  phaseCompressingDetail: {
    id: 'launchpad.progress.compressingDetail',
    defaultMessage: 'Compressing — {detail}',
  },
  phaseReceivingDetail: {
    id: 'launchpad.progress.receivingDetail',
    defaultMessage: 'Receiving — {detail}',
  },
  phaseResolvingDetail: {
    id: 'launchpad.progress.resolvingDetail',
    defaultMessage: 'Resolving — {detail}',
  },
  phaseCheckoutDetail: {
    id: 'launchpad.progress.checkoutDetail',
    defaultMessage: 'Checkout — {detail}',
  },
  projectSlug: {
    id: 'launchpad.projectSlug',
    defaultMessage: '{owner}/{repo}',
  },
});

type ActivePhase = Exclude<CloneProgress['phase'], 'done' | 'error'>;

function phaseLabel(phase: ActivePhase): MessageDescriptor {
  switch (phase) {
    case 'counting':
      return messages.phaseCounting;
    case 'compressing':
      return messages.phaseCompressing;
    case 'receiving':
      return messages.phaseReceiving;
    case 'resolving':
      return messages.phaseResolving;
    case 'checkout':
      return messages.phaseCheckout;
  }
}

function phaseDetailLabel(phase: ActivePhase): MessageDescriptor {
  switch (phase) {
    case 'counting':
      return messages.phaseCountingDetail;
    case 'compressing':
      return messages.phaseCompressingDetail;
    case 'receiving':
      return messages.phaseReceivingDetail;
    case 'resolving':
      return messages.phaseResolvingDetail;
    case 'checkout':
      return messages.phaseCheckoutDetail;
  }
}

const ProjectListRow = styled(ListRow)`
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[4]};
`;

const RowMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowUrl = styled(Ellipsis)`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgSubtle};
`;

const ProgressBar = styled.div`
  position: relative;
  margin-top: ${({ theme }) => theme.space[1]};
  height: 6px;
  background: ${({ theme }) => theme.colors.bgHover};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${({ theme }) => theme.colors.accent};
  transition: width 0.2s ease;
`;

const ProgressLabel = styled.div`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

function isActiveClone(
  progress: CloneProgress | undefined,
): progress is CloneProgress & { phase: ActivePhase } {
  return progress !== undefined && progress.phase !== 'done' && progress.phase !== 'error';
}

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const SpinningFetchIcon = styled(RefreshCw)`
  animation: ${spin} 0.8s linear infinite;
`;

interface ProjectItemProps {
  project: Project;
  autoClone: boolean;
}

export function ProjectItem({ project, autoClone }: ProjectItemProps): React.JSX.Element {
  const intl = useIntl();
  const qc = useQueryClient();
  const removeProject = useRemoveProject();
  const cloneStart = useCloneStart();
  const fetchProject = useFetchProject();
  const launchingIds = useLaunchingProjectIds();
  const { mutate: openProject } = useOpenProject();

  const [progress, setProgress] = useState<CloneProgress | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [fetching, setFetching] = useState(false);

  useIpcEvent('clone.progress', (payload) => {
    if (payload.projectId !== project.id) return;
    setProgress(payload);
    if (payload.phase === 'done' || payload.phase === 'error') {
      qc.invalidateQueries({ queryKey: qk.projects() }).catch((error: unknown) =>
        reportQueryError('clone.progress', error),
      );
    }
  });

  function startClone(): void {
    setProgress({ projectId: project.id, phase: 'counting', percent: 0 });
    cloneStart.mutate(project.id, { onError: () => setProgress(undefined) });
  }

  const autoCloneStarted = useRef(false);
  useEffect(() => {
    if (!autoClone || project.cloned || autoCloneStarted.current) return;
    autoCloneStarted.current = true;
    setProgress({ projectId: project.id, phase: 'counting', percent: 0 });
    cloneStart.mutate(project.id, { onError: () => setProgress(undefined) });
  }, [autoClone, project.cloned, project.id, cloneStart]);

  function handleOpen(e: MouseEvent): void {
    openProject({ projectId: project.id, detached: e.ctrlKey || e.metaKey });
  }

  function handleRemove(): void {
    removeProject.mutate(project.id);
    setConfirmRemove(false);
    setProgress(undefined);
  }

  function handleFetch(): void {
    setFetching(true);
    fetchProject.mutate(project.id, { onSettled: () => setFetching(false) });
  }

  const activeProgress = isActiveClone(progress) ? progress : undefined;
  const cloning = activeProgress !== undefined;
  const launching = launchingIds.includes(project.id);
  const openable = project.cloned && !launching;
  return (
    <ProjectListRow
      $clickable={openable}
      $disabled={launching}
      aria-disabled={launching || undefined}
      onClick={openable ? (e) => handleOpen(e) : undefined}
    >
      <RowMain>
        <RowTitle>
          <FormattedMessage
            {...messages.projectSlug}
            values={{ owner: project.owner, repo: project.repo }}
          />
        </RowTitle>
        <RowUrl>{project.url}</RowUrl>
        {launching && (
          <ProgressLabel>
            <FormattedMessage {...messages.launching} />
          </ProgressLabel>
        )}
        {cloning && (
          <ProgressBar>
            <ProgressFill style={{ width: `${progress?.percent ?? 0}%` }} />
          </ProgressBar>
        )}
        {activeProgress &&
          (() => {
            const phase = activeProgress.phase;
            const detail = activeProgress.message;
            return detail ? (
              <ProgressLabel>
                <FormattedMessage {...phaseDetailLabel(phase)} values={{ detail }} />
              </ProgressLabel>
            ) : (
              <ProgressLabel>{intl.formatMessage(phaseLabel(phase))}</ProgressLabel>
            );
          })()}
      </RowMain>
      <Inline $gap={1} onClick={(e) => e.stopPropagation()}>
        {project.cloned ? (
          <IconButton
            icon={Folder}
            label={intl.formatMessage(messages.open)}
            disabled={launching}
            onClick={(e) => handleOpen(e)}
          />
        ) : (
          <IconButton
            icon={Download}
            label={intl.formatMessage(messages.clone)}
            disabled={cloning}
            onClick={() => startClone()}
          />
        )}
        {project.cloned && !confirmRemove && (
          <IconButton
            icon={fetching ? SpinningFetchIcon : RefreshCw}
            label={intl.formatMessage(messages.fetch)}
            disabled={cloning || launching || fetching}
            onClick={() => handleFetch()}
          />
        )}
        {confirmRemove ? (
          <>
            <Caption>
              <FormattedMessage {...messages.confirmRemoveQuestion} />
            </Caption>
            <Button
              variant="danger"
              disabled={cloning || removeProject.isPending}
              onClick={() => handleRemove()}
            >
              <FormattedMessage {...messages.remove} />
            </Button>
            <Button onClick={() => setConfirmRemove(false)}>
              <FormattedMessage {...messages.cancelRemove} />
            </Button>
          </>
        ) : (
          <IconButton
            icon={Trash2}
            label={intl.formatMessage(messages.remove)}
            disabled={cloning || launching}
            onClick={() => setConfirmRemove(true)}
          />
        )}
      </Inline>
    </ProjectListRow>
  );
}
