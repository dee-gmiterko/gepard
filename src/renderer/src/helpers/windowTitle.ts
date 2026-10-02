export const APP_TITLE = 'Gepard';

export function windowTitle(projectName: string | null | undefined): string {
  return projectName ? `${APP_TITLE} - ${projectName}` : APP_TITLE;
}
