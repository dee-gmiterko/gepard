import { z } from 'zod'
import { Viewer, ViewerRepo, Project } from './schemas/project'
import {
  ChangedFile,
  CheckoutResult,
  Commit,
  FileContent,
  FileDiff,
  PersistedTargeting,
  PrListItem,
  RepoPath,
  Sha,
  TargetRef
} from './schemas/pr'
import { Comment, CommentDraft, LocalViewedState, ReviewThread } from './schemas/comment'
import { GroupedResult, Pos, SearchQuery, WorkspaceSymbol } from './schemas/search'
import { DefinitionResult, IndexStatus, LineSymbolsResult } from './schemas/index'
import { ExtensionInfo } from './schemas/extensions'
import type { ChannelNameList, EventNameList } from './names'
export { channelNames, eventNames } from './names'

const ch = <I extends z.ZodType, O extends z.ZodType>(
  input: I,
  output: O
): { input: I; output: O } => ({
  input,
  output
})

const ProjectRef = { projectId: z.string() }
const PrRef = { projectId: z.string(), pr: z.int().positive() }

export const channels = {
  'app.viewer': ch(z.void(), Viewer.nullable()),
  'app.viewerRepos': ch(z.void(), z.array(ViewerRepo)),

  'projects.list': ch(z.void(), z.array(Project)),
  'projects.add': ch(
    z.object({
      url: z.url({
        protocol: /^https$/,
        hostname: /^github\.com$/,
        error: 'expected https://github.com/<owner>/<repo>'
      })
    }),
    Project
  ),
  'projects.open': ch(
    z.object(ProjectRef),
    z.object({ project: Project, head: Sha, targeting: PersistedTargeting })
  ),
  'projects.setTargeting': ch(z.object({ ...ProjectRef, targeting: PersistedTargeting }), z.void()),
  'projects.remove': ch(z.object(ProjectRef), z.void()),
  'clone.start': ch(z.object(ProjectRef), z.void()),

  /** `commit` narrows to PRs containing that commit via GitHub's REST "list
   * pull requests associated with a commit" endpoint. */
  'pr.list': ch(
    z.object({
      ...ProjectRef,
      search: z.string().optional(),
      commit: Sha.optional(),
      path: RepoPath.optional()
    }),
    z.array(PrListItem)
  ),
  /** Uses one `git diff-tree --stdin` call for all commit oids instead of
   * spawning git once per commit. */
  'pr.commits': ch(z.object({ ...PrRef, path: RepoPath.optional() }), z.array(Commit)),
  'pr.checkout': ch(z.object({ ...ProjectRef, target: TargetRef }), CheckoutResult),
  'commits.list': ch(
    z.object({
      ...ProjectRef,
      search: z.string().optional(),
      path: RepoPath.optional(),
      limit: z.int().positive().optional()
    }),
    z.array(Commit)
  ),

  'files.changed': ch(z.object({ ...ProjectRef, base: Sha, head: Sha }), z.array(ChangedFile)),
  'files.diff': ch(z.object({ ...ProjectRef, base: Sha, head: Sha, path: RepoPath }), FileDiff),
  'files.content': ch(z.object({ ...ProjectRef, sha: Sha, path: RepoPath }), FileContent),
  'trees.get': ch(z.object({ ...ProjectRef, sha: Sha }), z.array(RepoPath)),

  'search.run': ch(SearchQuery, GroupedResult),
  'symbols.line': ch(
    z.object({ ...ProjectRef, sha: Sha, path: RepoPath, line: z.int().positive() }),
    LineSymbolsResult
  ),
  'symbols.definition': ch(
    z.object({ ...ProjectRef, sha: Sha, path: RepoPath, pos: Pos }),
    DefinitionResult
  ),
  'symbols.workspace': ch(
    z.object({ ...ProjectRef, sha: Sha, query: z.string(), limit: z.int().positive().optional() }),
    z.array(WorkspaceSymbol)
  ),

  'comments.list': ch(z.object(PrRef), z.array(ReviewThread)),
  'comments.upsert': ch(CommentDraft, Comment),
  'comments.delete': ch(z.object({ ...PrRef, commentId: z.string() }), z.void()),
  'viewed.list': ch(z.object(PrRef), z.array(LocalViewedState)),
  'viewed.set': ch(
    z.object({ ...PrRef, paths: z.array(RepoPath).min(1), viewed: z.boolean() }),
    z.array(LocalViewedState)
  ),

  'sync.run': ch(
    z.object({ ...PrRef, mode: z.enum(['full', 'pull']).default('full') }),
    z.object({ syncedAt: z.iso.datetime({ offset: true }) })
  ),
  'sync.pendingCount': ch(z.object(PrRef), z.int().nonnegative()),
  'index.get': ch(z.object(ProjectRef), IndexStatus),

  'log.write': ch(
    z.object({
      level: z.enum(['info', 'warn', 'error']),
      scope: z.string(),
      message: z.string()
    }),
    z.void()
  ),

  'extensions.list': ch(z.void(), z.array(ExtensionInfo)),
  'extensions.setEnabled': ch(
    z.object({ id: z.string(), enabled: z.boolean() }),
    z.array(ExtensionInfo)
  ),
  'extensions.install': ch(z.void(), z.array(ExtensionInfo)),
  'extensions.dir': ch(z.void(), z.string())
} as const satisfies Record<ChannelNameList, { input: z.ZodType; output: z.ZodType }>

export const events = {
  'clone.progress': z.object({
    projectId: z.string(),
    phase: z.enum([
      'counting',
      'compressing',
      'receiving',
      'resolving',
      'checkout',
      'done',
      'error'
    ]),
    percent: z.number().min(0).max(100).nullable(),
    message: z.string().optional()
  }),
  'index.status': z.object({ projectId: z.string(), status: IndexStatus }),
  'theme.changed': z.object({ dark: z.boolean() }),
  'app.error': z.object({ scope: z.string(), message: z.string() })
} as const satisfies Record<EventNameList, z.ZodType>

type ExtraChannel = Exclude<keyof typeof channels, ChannelNameList>
type ExtraEvent = Exclude<keyof typeof events, EventNameList>
const _namesComplete: [ExtraChannel, ExtraEvent] extends [never, never]
  ? true
  : ['add to names.ts:', ExtraChannel | ExtraEvent] = true
void _namesComplete

export type Channels = typeof channels
export type ChannelName = keyof Channels
/** zod's `z.input` type excludes fields with `.default()`; this is what the renderer passes in. */
export type ChannelInput<C extends ChannelName> = z.input<Channels[C]['input']>
/** zod's `z.output` type has `.default()` fields applied; this is what main's handler receives. */
export type ChannelParsedInput<C extends ChannelName> = z.output<Channels[C]['input']>
export type ChannelOutput<C extends ChannelName> = z.output<Channels[C]['output']>

export type Events = typeof events
export type EventName = keyof Events
export type EventPayload<E extends EventName> = z.output<Events[E]>

/** Rejected `ipcMain.handle` promises lose everything but `.message` when
 * crossing the bridge, so errors travel as data instead. */
export interface IpcErrorShape {
  code: string
  message: string
  details?: unknown
}
export type Envelope<T> = { ok: true; value: T } | { ok: false; error: IpcErrorShape }

export type InvokeArgs<C extends ChannelName> =
  undefined extends ChannelInput<C> ? [input?: ChannelInput<C>] : [input: ChannelInput<C>]
