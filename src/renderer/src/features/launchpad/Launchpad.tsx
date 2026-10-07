import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { Settings } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
import { Inline } from '../../components/Layout';
import { List, ListRow } from '../../components/List';
import { Message } from '../../components/Message';
import { SectionHeading } from '../../components/SectionHeading';
import { useAddProject, useProjects, useViewer, useViewerRepos } from '../../queries/projects';
import { useUiDispatch } from '../../state/UiContext';
import { ProjectItem } from './ProjectItem';
import { RepoUrlCombobox } from './RepoUrlCombobox';

const messages = defineMessages({
  title: {
    id: 'launchpad.title',
    defaultMessage: 'Projects',
  },
  urlPlaceholder: {
    id: 'launchpad.urlPlaceholder',
    defaultMessage: 'https://github.com/owner/repo',
  },
  addProject: {
    id: 'launchpad.addProject',
    defaultMessage: 'Add project',
  },
  loading: {
    id: 'launchpad.loading',
    defaultMessage: 'Loading projects…',
  },
  empty: {
    id: 'launchpad.empty',
    defaultMessage: 'No projects yet — add one above.',
  },
  openSettings: {
    id: 'launchpad.openSettings',
    defaultMessage: 'Settings',
  },
});

const Page = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[6]} ${({ theme }) => theme.space[4]};
`;

const TopBar = styled.div`
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const ViewerBadge = styled(Inline)`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Avatar = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const AddForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: stretch;
  margin-bottom: ${({ theme }) => theme.space[2]};

  > :first-child {
    flex: 1 1 0;
    min-width: 0;
  }
`;

const AddButton = styled(Button)`
  flex: 0 0 auto;
  white-space: nowrap;
`;

const ProjectsList = styled(List)`
  margin-top: ${({ theme }) => theme.space[4]};
`;

export function Launchpad(): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useUiDispatch();
  const { data: viewer } = useViewer();
  const { data: viewerRepos, isFetching: viewerReposLoading } = useViewerRepos();
  const { data: projects, isLoading } = useProjects();
  const addProject = useAddProject();

  const [url, setUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [autoCloneId, setAutoCloneId] = useState<string | null>(null);

  const prefill = viewer ? `https://github.com/${viewer.login}/` : '';
  const urlValue = urlTouched ? url : prefill;

  function handleAdd(e: FormEvent): void {
    e.preventDefault();
    if (urlValue.trim().length === 0) return;
    addProject.mutate(
      { url: urlValue.trim() },
      {
        onSuccess: (project) => {
          setUrl('');
          setUrlTouched(false);
          if (!project.cloned) setAutoCloneId(project.id);
        },
      },
    );
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
            setUrl(next);
            setUrlTouched(true);
          }}
          repos={viewerRepos ?? []}
          loading={viewerReposLoading}
          placeholder={intl.formatMessage(messages.urlPlaceholder)}
        />
        <AddButton
          type="submit"
          variant="primary"
          disabled={addProject.isPending || urlValue.trim().length === 0}
        >
          <FormattedMessage {...messages.addProject} />
        </AddButton>
      </AddForm>

      <ProjectsList>
        {isLoading && (
          <ListRow>
            <Message layout="inline">
              <FormattedMessage {...messages.loading} />
            </Message>
          </ListRow>
        )}
        {!isLoading && (projects?.length ?? 0) === 0 && (
          <ListRow>
            <Message layout="inline">
              <FormattedMessage {...messages.empty} />
            </Message>
          </ListRow>
        )}
        {projects?.map((project) => (
          <ProjectItem key={project.id} project={project} autoClone={project.id === autoCloneId} />
        ))}
      </ProjectsList>
    </Page>
  );
}
