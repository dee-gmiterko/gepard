// The IPC contract: one entry per channel/event, each carrying its zod input
// and output schema. Pattern verified in report 04 §2.3; this is the full
// channel list for the spec (docs/gh-large-review.md).
//
// Domain schemas: report 01 §7 (PR/commit/file/thread/comment/viewed) and
// report 03 §7 (search/symbols/index) verbatim, ported to the zod 4.6.5 API.
// Request shapes and a few results the reports do not spell out are
// constructed; each schema file's header says which.
import { z } from 'zod'
import { Viewer, Project } from './schemas/project'
import {
  ChangedFile,
  CheckoutResult,
  Commit,
  FileContent,
  FileDiff,
  PrListItem,
  RepoPath,
  Sha,
  TargetRef
} from './schemas/pr'
import { Comment, CommentDraft, LocalViewedState, ReviewThread } from './schemas/comment'
import { GroupedResult, Pos, SearchQuery, WorkspaceSymbol } from './schemas/search'
import { DefinitionResult, IndexStatus, LineSymbolsResult } from './schemas/index'
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

/** Request/response channels: renderer -> main -> renderer. */
export const channels = {
  /** Signed-in `gh` profile for the launchpad prefill; null when not signed in. */
  'app.viewer': ch(z.void(), Viewer.nullable()),

  // ---- projects / clone ----
  'projects.list': ch(z.void(), z.array(Project)),
  /** Registers the project (project.json); cloning is a separate clone.start.
   * Only a github.com repository URL is accepted (spec: "selecting one from
   * GitHub url"); main also requires the path to be exactly /owner/repo. */
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
  /** Opens a cloned project: starts its background index (LSP session,
   * `index.status` events; not awaited) and returns the sha the working tree
   * is at, which the file browser uses before any PR/commit is targeted. */
  'projects.open': ch(z.object(ProjectRef), z.object({ project: Project, head: Sha })),
  /** Deletes the project directory (clone, review store, project.json). */
  'projects.remove': ch(z.object(ProjectRef), z.void()),
  /** Returns at once; progress arrives as `clone.progress` events. */
  'clone.start': ch(z.object(ProjectRef), z.void()),

  // ---- PRs / commits / checkout ----
  'pr.list': ch(z.object({ ...ProjectRef, search: z.string().optional() }), z.array(PrListItem)),
  /** Commits of one PR (commit combobox when a PR is set). */
  'pr.commits': ch(z.object(PrRef), z.array(Commit)),
  /** Checks out the target (fetching it if needed), re-indexes, returns the
   * diff pair. `default` = no PR and no commit targeted: the default branch head. */
  'pr.checkout': ch(z.object({ ...ProjectRef, target: TargetRef }), CheckoutResult),
  /** Repository commits from local git (commit combobox with no PR set);
   * `path` limits to commits touching a targeted folder. */
  'commits.list': ch(
    z.object({
      ...ProjectRef,
      search: z.string().optional(),
      path: RepoPath.optional(),
      limit: z.int().positive().optional()
    }),
    z.array(Commit)
  ),

  // ---- changed files / file content / diff rows / trees ----
  'files.changed': ch(z.object({ ...ProjectRef, base: Sha, head: Sha }), z.array(ChangedFile)),
  'files.diff': ch(z.object({ ...ProjectRef, base: Sha, head: Sha, path: RepoPath }), FileDiff),
  'files.content': ch(z.object({ ...ProjectRef, sha: Sha, path: RepoPath }), FileContent),
  /** Every tracked file path at sha (`git ls-tree -r --name-only -z`);
   * folders are derived client-side. */
  'trees.get': ch(z.object({ ...ProjectRef, sha: Sha }), z.array(RepoPath)),

  // ---- search / symbols ----
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

  // ---- comments / viewed (local review store, report 04 §4.3; PR only) ----
  'comments.list': ch(z.object(PrRef), z.array(ReviewThread)),
  'comments.upsert': ch(CommentDraft, Comment),
  /** Local delete: drops a local `new` comment, marks a synced one `deleted` for the next Sync. */
  'comments.delete': ch(z.object({ ...PrRef, commentId: z.string() }), z.void()),
  'viewed.list': ch(z.object(PrRef), z.array(LocalViewedState)),
  /** Batch so a folder checkbox applies to every file under it (spec). */
  'viewed.set': ch(
    z.object({ ...PrRef, paths: z.array(RepoPath).min(1), viewed: z.boolean() }),
    z.array(LocalViewedState)
  ),

  // ---- sync / index status ----
  /** 'full' = the Sync button (push, then pull); 'pull' = on PR switch
   * (spec: "fetches remote comments and viewed state"), pushes nothing. */
  'sync.run': ch(
    z.object({ ...PrRef, mode: z.enum(['full', 'pull']).default('full') }),
    z.object({ syncedAt: z.iso.datetime({ offset: true }) })
  ),
  /** Current index status (initial value; live updates via `index.status`). */
  'index.get': ch(z.object(ProjectRef), IndexStatus),

  // ---- renderer -> main logging (coordinator spec: unified failure surface) ----
  /** Every renderer-originated failure (render errors, window/unhandled
   * rejection, failed queries/mutations) is forwarded here so it lands in the
   * same `<userData>/logs/main.log` main already writes (src/main/log.ts),
   * not just a toast the user can dismiss. */
  'log.write': ch(
    z.object({
      level: z.enum(['info', 'warn', 'error']),
      scope: z.string(),
      message: z.string()
    }),
    z.void()
  )
} as const satisfies Record<ChannelNameList, { input: z.ZodType; output: z.ZodType }>

/** Push/event channels: main -> renderer. */
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
  /** A main-process failure with no renderer request behind it (uncaught
   * exception/rejection, LSP crash or failed restart, session teardown
   * failure): main already logged it (src/main/notify.ts), so the renderer
   * only toasts it (coordinator spec: logged once, shown once). Failures
   * that already have their own domain channel and toast wiring
   * (`clone.progress`'s 'error' phase, `index.status`'s 'error' state) are
   * not sent here, to avoid a double toast. */
  'app.error': z.object({ scope: z.string(), message: z.string() })
} as const satisfies Record<EventNameList, z.ZodType>

// Reverse check: every schema key must also be in names.ts (preload allow-list).
type ExtraChannel = Exclude<keyof typeof channels, ChannelNameList>
type ExtraEvent = Exclude<keyof typeof events, EventNameList>
const _namesComplete: [ExtraChannel, ExtraEvent] extends [never, never]
  ? true
  : ['add to names.ts:', ExtraChannel | ExtraEvent] = true
void _namesComplete

export type Channels = typeof channels
export type ChannelName = keyof Channels
/** What the renderer passes in (zod *input* type, so `.default()` fields are optional). */
export type ChannelInput<C extends ChannelName> = z.input<Channels[C]['input']>
/** What main's handler receives (zod *output* type, defaults applied). */
export type ChannelParsedInput<C extends ChannelName> = z.output<Channels[C]['input']>
export type ChannelOutput<C extends ChannelName> = z.output<Channels[C]['output']>

export type Events = typeof events
export type EventName = keyof Events
export type EventPayload<E extends EventName> = z.output<Events[E]>

/** Wire envelope. Rejected `ipcMain.handle` promises lose everything but
 *  `.message` when crossing the bridge, so errors travel as data instead. */
export interface IpcErrorShape {
  code: string
  message: string
  details?: unknown
}
export type Envelope<T> = { ok: true; value: T } | { ok: false; error: IpcErrorShape }

/** Allows `invoke('projects.list')` without a second argument for void inputs. */
export type InvokeArgs<C extends ChannelName> =
  undefined extends ChannelInput<C> ? [input?: ChannelInput<C>] : [input: ChannelInput<C>]
