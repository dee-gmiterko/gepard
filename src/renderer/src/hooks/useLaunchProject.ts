import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reportQueryError } from '../errors/report';
import { qk } from '../queries/keys';
import { useCloneStart, useLaunch, useOpenProject } from '../queries/projects';

export function useLaunchProjectOnStartup(): void {
  const qc = useQueryClient();
  const { mutate: launch } = useLaunch();
  const openProject = useOpenProject();
  const { mutate: startClone } = useCloneStart();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(
      { detached: false },
      {
        onSuccess: (project) => {
          if (!project) return;
          qc.invalidateQueries({ queryKey: qk.projects() }).catch((error: unknown) =>
            reportQueryError('app.launch', error),
          );
          if (project.cloned) openProject(project.id, false);
          else startClone(project.id);
        },
      },
    );
  }, [launch, openProject, startClone, qc]);
}
