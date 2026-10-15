import { ExtensionsCatalogSection } from './ExtensionsCatalogSection';
import { ExtensionsInstalledSection } from './ExtensionsInstalledSection';
import { ExtensionsRepositorySection } from './ExtensionsRepositorySection';

export function ExtensionsPanel(): React.JSX.Element {
  return (
    <>
      <ExtensionsInstalledSection />
      <ExtensionsCatalogSection />
      <ExtensionsRepositorySection />
    </>
  );
}
