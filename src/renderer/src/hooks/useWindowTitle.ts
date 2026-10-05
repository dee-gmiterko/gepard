import { useEffect } from 'react';
import { useOpenedProject } from '../queries/projects';
import { windowTitle } from '../helpers/windowTitle';

export function useWindowTitle(): void {
  const projectName = useOpenedProject().data?.project.repo ?? null;
  useEffect(() => {
    document.title = windowTitle(projectName);
  }, [projectName]);
}
