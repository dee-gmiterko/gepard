import { Stack } from '../../components/Layout';
import { GlobalHiddenFilesPanel } from './GlobalHiddenFilesPanel';
import { LocalePanel } from './LocalePanel';
import { ThemePanel } from './ThemePanel';

export function GeneralPanel(): React.JSX.Element {
  return (
    <Stack $gap={5}>
      <ThemePanel />
      <LocalePanel />
      <GlobalHiddenFilesPanel />
    </Stack>
  );
}
