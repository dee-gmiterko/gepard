import {
  findCatalogEntry,
  type CatalogEntry,
  type CatalogEntryStatus,
  type ExtensionCatalog,
  type RepositoryInput,
} from '@gepard/common';
import { catalogStatus } from '../helpers/catalog';
import type { ExtensionsService } from './extensions';

export class ExtensionCatalogService {
  constructor(
    private readonly catalog: ExtensionCatalog,
    private readonly extensions: ExtensionsService,
    private readonly target: string,
  ) {}

  find(repo: RepositoryInput, dir: string | null): CatalogEntry | null {
    return findCatalogEntry(this.catalog, repo, dir);
  }

  async status(): Promise<CatalogEntryStatus[]> {
    return catalogStatus(this.catalog, await this.extensions.list(), this.target);
  }
}
