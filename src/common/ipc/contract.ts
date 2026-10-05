import { z } from 'zod';
import { ClonePhase, Viewer, ViewerRepo, Project, PersistedLayout } from './schemas/project';
import { CommentsRef, PrRef, ProjectRef } from './schemas/refs';
import {
  ChangedFile,
  CheckoutResult,
  Commit,
  FileContent,
  FileDiff,
  IssueRef,
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
  LanguageServerStatus,
  LineSymbolsResult,
} from './schemas/lsp';
import { LogLevel } from './schemas/log';
import { ChangedFileOwners, PrOverviewDetails, ProjectOverview } from './schemas/overview';
import { ExtensionInfo } from './schemas/extensions';
import { GrammarModule } from './schemas/grammar';
import { ThemeTemplateData } from './schemas/theme';
import { LocaleData } from './schemas/locale';
import {
  ContextMenuLabels,
  ContextMenuLineTarget,
  FileViewMenuPick,
  FileViewMenuRequest,
} from './schemas/contextMenu';
import type { ChannelNameList, EventNameList } from './names';

interface ChannelSpec {
  input: z.ZodType;
  output: z.ZodType;
}

export const channels = {
  'app.viewer': { input: z.void(), output: Viewer.nullable() },
  'app.viewerRepos': { input: z.void(), output: z.array(ViewerRepo) },
  'app.launch': {
    input: z.discriminatedUnion('detached', [
      z.object({ detached: z.literal(false) }),
      ProjectRef.extend({ detached: z.literal(true) }),
    ]),
    output: Project.nullable(),
  },

  'projects.list': { input: z.void(), output: z.array(Project) },
  'projects.add': {
    input: z.object({
      url: z.url({
        protocol: /^https$/,
        hostname: /^github\.com$/,
        error: 'expected https://github.com/<owner>/<repo>',
      }),
    }),
    output: Project,
  },
  'projects.open': {
    input: ProjectRef,
    output: z.object({
      project: Project,
      head: Sha,
      targeting: PersistedTargeting,
      layout: PersistedLayout,
    }),
  },
  'projects.setTargeting': {
    input: ProjectRef.extend({ targeting: PersistedTargeting }),
    output: z.void(),
  },
  'projects.setLayout': { input: ProjectRef.extend({ layout: PersistedLayout }), output: z.void() },
  'projects.remove': { input: ProjectRef, output: z.void() },
  'projects.fetch': { input: ProjectRef, output: z.void() },
  'clone.start': { input: ProjectRef, output: z.void() },

  'pr.list': {
    input: ProjectRef.extend({
      search: z.string().optional(),
      commit: Sha.optional(),
      path: RepoPath.optional(),
    }),
    output: z.array(PrListItem),
  },
  'pr.view': { input: PrRef, output: PrSummary },
  'pr.commits': { input: PrRef.extend({ path: RepoPath.optional() }), output: z.array(Commit) },
  'pr.checkout': { input: ProjectRef.extend({ target: TargetRef }), output: CheckoutResult },
  'pr.branches': {
    input: ProjectRef,
    output: z.object({
      branches: z.array(z.string().min(1)),
      defaultBranch: z.string().min(1).nullable(),
    }),
  },
  'pr.create': {
    input: ProjectRef.extend({
      base: z.string().min(1),
      head: z.string().min(1),
      title: z.string().min(1),
      body: z.string().default(''),
    }),
    output: PrSummary,
  },
  'issues.create': {
    input: ProjectRef.extend({
      title: z.string().min(1),
      body: z.string().default(''),
      clearUnassignedThreadIds: z.array(NodeId).default([]),
    }),
    output: IssueRef,
  },
  'commits.list': {
    input: ProjectRef.extend({
      search: z.string().optional(),
      path: RepoPath.optional(),
      limit: z.int().positive().optional(),
    }),
    output: z.array(Commit),
  },

  'overview.project': { input: ProjectRef, output: ProjectOverview },
  'overview.pr': { input: PrRef, output: PrOverviewDetails },
  'overview.owners': {
    input: ProjectRef.extend({ base: Sha, head: Sha }),
    output: ChangedFileOwners.nullable(),
  },

  'files.changed': {
    input: ProjectRef.extend({ base: Sha, head: Sha }),
    output: z.array(ChangedFile),
  },
  'files.diff': {
    input: ProjectRef.extend({ base: Sha, head: Sha, path: RepoPath }),
    output: FileDiff,
  },
  'files.content': { input: ProjectRef.extend({ sha: Sha, path: RepoPath }), output: FileContent },
  'trees.get': { input: ProjectRef.extend({ sha: Sha }), output: z.array(RepoPath) },

  'search.run': { input: SearchQuery, output: GroupedResult },
  'symbols.line': {
    input: ProjectRef.extend({ sha: Sha, path: RepoPath, line: z.int().positive() }),
    output: LineSymbolsResult,
  },
  'symbols.definition': {
    input: ProjectRef.extend({ sha: Sha, path: RepoPath, pos: Pos }),
    output: DefinitionResult,
  },
  'symbols.workspace': {
    input: ProjectRef.extend({
      sha: Sha,
      query: z.string(),
      limit: z.int().positive().optional(),
      kinds: z.array(SymbolKind).optional(),
    }),
    output: z.array(WorkspaceSymbol),
  },
  'symbols.document': {
    input: ProjectRef.extend({ sha: Sha, path: RepoPath }),
    output: DocumentSymbolsResult,
  },

  'comments.list': { input: CommentsRef, output: z.array(ReviewThread) },
  'comments.upsert': { input: CommentDraft, output: Comment },
  'comments.delete': { input: CommentsRef.extend({ commentId: z.string() }), output: z.void() },
  'viewed.list': { input: PrRef, output: z.array(LocalViewedState) },
  'viewed.set': {
    input: PrRef.extend({
      paths: z.array(RepoPath).min(1),
      viewed: z.boolean(),
      prId: NodeId.nullable().default(null),
    }),
    output: z.array(LocalViewedState),
  },

  'sync.run': {
    input: PrRef.extend({ mode: SyncMode.default('full') }),
    output: CheckoutResult.extend({
      syncedAt: z.iso.datetime({ offset: true }),
      droppedRemoteDeleted: z.int().nonnegative(),
    }),
  },
  'sync.pendingCount': { input: PrRef, output: z.int().nonnegative() },
  'index.get': { input: ProjectRef, output: IndexStatus },
  'index.languages': { input: ProjectRef, output: z.array(LanguageServerStatus).nullable() },

  'log.write': {
    input: z.object({
      level: LogLevel,
      scope: z.string(),
      message: z.string(),
    }),
    output: z.void(),
  },
  'log.getPath': { input: z.void(), output: z.string() },

  'extensions.list': { input: z.void(), output: z.array(ExtensionInfo) },
  'extensions.setEnabled': {
    input: z.object({ id: z.string(), enabled: z.boolean() }),
    output: z.array(ExtensionInfo),
  },
  'extensions.install': {
    input: z.object({ dialogTitle: z.string().min(1) }),
    output: z.array(ExtensionInfo),
  },
  'extensions.dir': { input: z.void(), output: z.string() },

  'grammars.list': { input: z.void(), output: z.array(GrammarModule) },

  'theme.getSystemPrefersDark': { input: z.void(), output: z.boolean() },
  'theme.getTemplateId': { input: z.void(), output: z.string().nullable() },
  'theme.setTemplateId': {
    input: z.object({ templateId: z.string().nullable() }),
    output: z.string().nullable(),
  },
  'themes.list': { input: z.void(), output: z.array(ThemeTemplateData) },

  'locale.getLocaleId': { input: z.void(), output: z.string().nullable() },
  'locale.setLocaleId': {
    input: z.object({ localeId: z.string().nullable() }),
    output: z.string().nullable(),
  },
  'locales.list': { input: z.void(), output: z.array(LocaleData) },

  'keybindings.getOverrides': { input: z.void(), output: z.record(z.string(), z.string()) },
  'keybindings.setOverride': {
    input: z.object({ id: z.string(), key: z.string().nullable() }),
    output: z.record(z.string(), z.string()),
  },

  'contextMenu.setLabels': { input: ContextMenuLabels, output: z.void() },
  'contextMenu.setLineTarget': { input: ContextMenuLineTarget, output: z.void() },
  'contextMenu.showFileView': { input: FileViewMenuRequest, output: FileViewMenuPick.nullable() },
} as const satisfies Record<ChannelNameList, ChannelSpec>;

export const events = {
  'clone.progress': ProjectRef.extend({
    phase: ClonePhase,
    percent: z.number().min(0).max(100).nullable(),
    message: z.string().optional(),
  }),
  'index.status': ProjectRef.extend({ status: IndexStatus }),
  'theme.changed': z.object({ dark: z.boolean() }),
  'app.error': z.object({ scope: z.string(), message: z.string() }),
} as const satisfies Record<EventNameList, z.ZodType>;

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
