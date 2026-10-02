import { useEffect } from 'react';
import { useOpenProject } from '../queries/projects';
import { windowTitle } from '../helpers/windowTitle';

export function useWindowTitle(): void {
  const projectName = useOpenProject().data?.project.repo ?? null;
  useEffect(() => {
    document.title = windowTitle(projectName);
  }, [projectName]);
}
