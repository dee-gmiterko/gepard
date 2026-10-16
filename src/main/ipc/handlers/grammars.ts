import type { HandlerMap } from '../dispatch';
import type { ExtensionsService } from '../../services/extensions';

export class GrammarsHandlers {
  constructor(private readonly extensions: ExtensionsService) {}

  toHandlerMap(): Pick<HandlerMap, 'grammars.list'> {
    return { 'grammars.list': () => this.extensions.enabledGrammars() };
  }
}
