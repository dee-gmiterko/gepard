import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reportQueryError } from '../errors/report';
import { qk } from '../queries/keys';
import { useCloneStart, useLaunchProject, useOpenProjectAction } from '../queries/projects';

export function useLaunchProjectOnStartup(): void {
  const qc = useQueryClient();
  const { data: project } = useLaunchProject();
  const openProject = useOpenProjectAction();
  const { mutate: startClone } = useCloneStart();
  const handled = useRef(false);

  useEffect(() => {
    if (!project || handled.current) return;
    handled.current = true;
    qc.invalidateQueries({ queryKey: qk.projects() }).catch((error: unknown) =>
      reportQueryError('app.launch', error),
    );
    if (project.cloned) void openProject(project.id);
    else startClone(project.id);
  }, [project, qc, openProject, startClone]);
}
