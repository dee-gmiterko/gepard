import { Stack } from '../../components/Layout';
import { LocalePanel } from './LocalePanel';
import { ThemePanel } from './ThemePanel';

export function GeneralPanel(): React.JSX.Element {
  return (
    <Stack $gap={5}>
      <ThemePanel />
      <LocalePanel />
    </Stack>
  );
}
