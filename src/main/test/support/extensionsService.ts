import { KindRegistry } from '../../extensions/kindRegistry';
import { GRAMMAR_SPEC, LOCALE_SPEC, LSP_SPEC, THEME_SPEC } from '../../extensions/kindSpecs';
import { ExtensionsService } from '../../services/extensions';

export function makeExtensionsService(
  userDir: () => string,
  builtinDir: () => string,
): ExtensionsService {
  return new ExtensionsService(
    userDir,
    new KindRegistry(LSP_SPEC, userDir, builtinDir),
    new KindRegistry(GRAMMAR_SPEC, userDir, builtinDir),
    new KindRegistry(THEME_SPEC, userDir, builtinDir),
    new KindRegistry(LOCALE_SPEC, userDir, builtinDir),
  );
}
