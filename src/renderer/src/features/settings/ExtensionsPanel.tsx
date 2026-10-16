import styled from 'styled-components';
import { ExtensionsCatalogSection } from './ExtensionsCatalogSection';
import { ExtensionsInstalledSection } from './ExtensionsInstalledSection';
import { ExtensionsRepositorySection } from './ExtensionsRepositorySection';

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.space[5]};

  @container settingsScreen (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[6]};
  min-width: 0;
`;

export function ExtensionsPanel(): React.JSX.Element {
  return (
    <Columns>
      <Column>
        <ExtensionsRepositorySection />
        <ExtensionsCatalogSection />
      </Column>
      <Column>
        <ExtensionsInstalledSection />
      </Column>
    </Columns>
  );
}
