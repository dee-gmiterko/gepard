import { z } from 'zod';
import {
  ClonePhase,
  Viewer,
  ViewerRepo,
  Project,
  ProjectId,
  PersistedLayout,
} from './schemas/project';
import {
  ChangedFile,
  CheckoutResult,
  Commit,
  FileContent,
  FileDiff,
  NodeId,
  PersistedTargeting,
  PrListItem,
  PrSummary,
  RepoPath,
  Sha,
  SyncMode,
  TargetRef,
} from './schemas/pr';
import { Comment, CommentDraft, LocalViewedState, ReviewThread } from './schemas/comment';
import { GroupedResult, Pos, SearchQuery, SymbolKind, WorkspaceSymbol } from './schemas/search';
import {
  DefinitionResult,
  DocumentSymbolsResult,
  IndexStatus,
  LineSymbolsResult,
} from './schemas/lsp';
import { LogLevel } from './schemas/log';
import { ChangedFileOwners, PrOverviewDetails, ProjectOverview } from './schemas/overview';
import { ExtensionInfo } from './schemas/extensions';
import { GrammarModule } from './schemas/grammar';
import { ThemeTemplateData } from './schemas/theme';
import { LocaleData } from './schemas/locale';
import type { ChannelNameList, EventNameList } from './names';

const ch = <I extends z.ZodType, O extends z.ZodType>(
  input: I,
  output: O,
): { input: I; output: O } => ({
  input,
  output,
});

const ProjectRef = { projectId: ProjectId };
const PrRef = { projectId: ProjectId, pr: z.int().positive() };

export const channels = {
  'app.viewer': ch(z.void(), Viewer.nullable()),
  'app.viewerRepos': ch(z.void(), z.array(ViewerRepo)),

  'projects.list': ch(z.void(), z.array(Project)),
  'projects.add': ch(
    z.object({
      url: z.url({
        protocol: /^https$/,
        hostname: /^github\.com$/,
        error: 'expected https://github.com/<owner>/<repo>',
      }),
    }),
    Project,
  ),
  'projects.open': ch(
    z.object(ProjectRef),
    z.object({
      project: Project,
      head: Sha,
      targeting: PersistedTargeting,
      layout: PersistedLayout,
    }),
  ),
  'projects.setTargeting': ch(z.object({ ...ProjectRef, targeting: PersistedTargeting }), z.void()),
  'projects.setLayout': ch(z.object({ ...ProjectRef, layout: PersistedLayout }), z.void()),
  'projects.remove': ch(z.object(ProjectRef), z.void()),
  'projects.fetch': ch(z.object(ProjectRef), z.void()),
  'clone.start': ch(z.object(ProjectRef), z.void()),

  'pr.list': ch(
    z.object({
      ...ProjectRef,
      search: z.string().optional(),
      commit: Sha.optional(),
      path: RepoPath.optional(),
    }),
    z.array(PrListItem),
  ),
  'pr.view': ch(z.object(PrRef), PrSummary),
  'pr.commits': ch(z.object({ ...PrRef, path: RepoPath.optional() }), z.array(Commit)),
  'pr.checkout': ch(z.object({ ...ProjectRef, target: TargetRef }), CheckoutResult),
  'pr.branches': ch(
    z.object(ProjectRef),
    z.object({
      branches: z.array(z.string().min(1)),
      defaultBranch: z.string().min(1).nullable(),
    }),
  ),
  'pr.create': ch(
    z.object({
      ...ProjectRef,
      base: z.string().min(1),
      head: z.string().min(1),
      title: z.string().min(1),
      body: z.string().default(''),
    }),
    PrSummary,
  ),
  'commits.list': ch(
    z.object({
      ...ProjectRef,
      search: z.string().optional(),
      path: RepoPath.optional(),
      limit: z.int().positive().optional(),
    }),
    z.array(Commit),
  ),

  'overview.project': ch(z.object(ProjectRef), ProjectOverview),
  'overview.pr': ch(z.object(PrRef), PrOverviewDetails),
  'overview.owners': ch(
    z.object({ ...ProjectRef, base: Sha, head: Sha }),
    ChangedFileOwners.nullable(),
  ),

  'files.changed': ch(z.object({ ...ProjectRef, base: Sha, head: Sha }), z.array(ChangedFile)),
  'files.diff': ch(z.object({ ...ProjectRef, base: Sha, head: Sha, path: RepoPath }), FileDiff),
  'files.content': ch(z.object({ ...ProjectRef, sha: Sha, path: RepoPath }), FileContent),
  'trees.get': ch(z.object({ ...ProjectRef, sha: Sha }), z.array(RepoPath)),

  'search.run': ch(SearchQuery, GroupedResult),
  'symbols.line': ch(
    z.object({ ...ProjectRef, sha: Sha, path: RepoPath, line: z.int().positive() }),
    LineSymbolsResult,
  ),
  'symbols.definition': ch(
    z.object({ ...ProjectRef, sha: Sha, path: RepoPath, pos: Pos }),
    DefinitionResult,
  ),
  'symbols.workspace': ch(
    z.object({
      ...ProjectRef,
      sha: Sha,
      query: z.string(),
      limit: z.int().positive().optional(),
      kinds: z.array(SymbolKind).optional(),
    }),
    z.array(WorkspaceSymbol),
  ),
  'symbols.document': ch(
    z.object({ ...ProjectRef, sha: Sha, path: RepoPath }),
    DocumentSymbolsResult,
  ),

  'comments.list': ch(z.object(PrRef), z.array(ReviewThread)),
  'comments.upsert': ch(CommentDraft, Comment),
  'comments.delete': ch(z.object({ ...PrRef, commentId: z.string() }), z.void()),
  'viewed.list': ch(z.object(PrRef), z.array(LocalViewedState)),
  'viewed.set': ch(
    z.object({
      ...PrRef,
      paths: z.array(RepoPath).min(1),
      viewed: z.boolean(),
      prId: NodeId.nullable().default(null),
    }),
    z.array(LocalViewedState),
  ),

  'sync.run': ch(
    z.object({ ...PrRef, mode: SyncMode.default('full') }),
    z.object({
      syncedAt: z.iso.datetime({ offset: true }),
      droppedRemoteDeleted: z.int().nonnegative(),
      ...CheckoutResult.shape,
    }),
  ),
  'sync.pendingCount': ch(z.object(PrRef), z.int().nonnegative()),
  'index.get': ch(z.object(ProjectRef), IndexStatus),

  'log.write': ch(
    z.object({
      level: LogLevel,
      scope: z.string(),
      message: z.string(),
    }),
    z.void(),
  ),
  'log.getPath': ch(z.void(), z.string()),

  'extensions.list': ch(z.void(), z.array(ExtensionInfo)),
  'extensions.setEnabled': ch(
    z.object({ id: z.string(), enabled: z.boolean() }),
    z.array(ExtensionInfo),
  ),
  'extensions.install': ch(z.object({ dialogTitle: z.string().min(1) }), z.array(ExtensionInfo)),
  'extensions.dir': ch(z.void(), z.string()),

  'grammars.list': ch(z.void(), z.array(GrammarModule)),

  'theme.getSystemPrefersDark': ch(z.void(), z.boolean()),
  'theme.getTemplateId': ch(z.void(), z.string().nullable()),
  'theme.setTemplateId': ch(z.object({ templateId: z.string().nullable() }), z.string().nullable()),
  'themes.list': ch(z.void(), z.array(ThemeTemplateData)),

  'locale.getLocaleId': ch(z.void(), z.string().nullable()),
  'locale.setLocaleId': ch(z.object({ localeId: z.string().nullable() }), z.string().nullable()),
  'locales.list': ch(z.void(), z.array(LocaleData)),

  'keybindings.getOverrides': ch(z.void(), z.record(z.string(), z.string())),
  'keybindings.setOverride': ch(
    z.object({ id: z.string(), key: z.string().nullable() }),
    z.record(z.string(), z.string()),
  ),
} as const satisfies Record<ChannelNameList, { input: z.ZodType; output: z.ZodType }>;

export const events = {
  'clone.progress': z.object({
    projectId: z.string(),
    phase: ClonePhase,
    percent: z.number().min(0).max(100).nullable(),
    message: z.string().optional(),
  }),
  'index.status': z.object({ projectId: z.string(), status: IndexStatus }),
  'theme.changed': z.object({ dark: z.boolean() }),
  'app.error': z.object({ scope: z.string(), message: z.string() }),
} as const satisfies Record<EventNameList, z.ZodType>;

type ExtraChannel = Exclude<keyof typeof channels, ChannelNameList>;
type ExtraEvent = Exclude<keyof typeof events, EventNameList>;
type MustBeTrue<T extends true> = T;
export type NamesComplete = MustBeTrue<
  [ExtraChannel, ExtraEvent] extends [never, never] ? true : false
>;

export type Channels = typeof channels;
export type ChannelName = keyof Channels;
export type ChannelInput<C extends ChannelName> = z.input<Channels[C]['input']>;
export type ChannelParsedInput<C extends ChannelName> = z.output<Channels[C]['input']>;
export type ChannelOutput<C extends ChannelName> = z.output<Channels[C]['output']>;

export type Events = typeof events;
export type EventName = keyof Events;
export type EventPayload<E extends EventName> = z.output<Events[E]>;

// Electron keeps only `.message` of an error rejected from `ipcMain.handle`.
export interface IpcErrorShape {
  code: string;
  message: string;
  details?: unknown;
}
export type Envelope<T> = { ok: true; value: T } | { ok: false; error: IpcErrorShape };

export type InvokeArgs<C extends ChannelName> =
  undefined extends ChannelInput<C> ? [input?: ChannelInput<C>] : [input: ChannelInput<C>];
