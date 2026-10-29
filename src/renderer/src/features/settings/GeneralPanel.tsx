import { Stack } from '../../components/Layout';
import { HiddenFilesPanel } from './HiddenFilesPanel';
import { LocalePanel } from './LocalePanel';
import { ThemePanel } from './ThemePanel';

export function GeneralPanel(): React.JSX.Element {
  return (
    <Stack $gap={5}>
      <ThemePanel />
      <LocalePanel />
      <HiddenFilesPanel scope="global" />
    </Stack>
  );
}
