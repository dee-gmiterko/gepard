import type {
  ChangedFile,
  DiffRow,
  Comment,
  Commit,
  PersistedLayout,
  PersistedTargeting,
  PrListItem,
  ReviewThread,
} from '@gepard/common';
import type { Handlers } from './fakeIpc';

export const PROJECT_ID = 'acme-widgets';
export const NOW = '2026-01-01T00:00:00Z';

export function sha(seed: string): string {
  return seed.repeat(40).slice(0, 40);
}

export const BASE = sha('b');
export const HEAD = sha('a');

export function commit(oid: string, headline: string): Commit {
  return {
    oid,
    messageHeadline: headline,
    messageBody: '',
    authoredDate: NOW,
    committedDate: NOW,
    authors: [{ login: 'alice', name: 'Alice', email: 'alice@example.com' }],
  };
}

export function pr(number: number, title: string): PrListItem {
  return {
    number,
    id: `PR_${number}`,
    title,
    author: { login: 'alice' },
    headRefName: `feature-${number}`,
    baseRefName: 'main',
    headRefOid: HEAD,
    createdAt: NOW,
    changedFiles: 1,
    labels: [],
    url: `https://github.com/acme/widgets/pull/${number}`,
  };
}

export function changedFile(path: string): ChangedFile {
  return { path, previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 0 };
}

export function comment(id: string, threadId: string, body: string): Comment {
  return {
    id,
    threadId,
    reviewId: null,
    reviewState: null,
    author: { login: 'me' },
    body,
    createdAt: NOW,
    updatedAt: NOW,
    lastEditedAt: null,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: true,
    viewerCanDelete: true,
    local: { status: 'new', updatedAt: NOW, references: [] },
  };
}

export function fileThread(
  id: string,
  path: string,
  line: number | null,
  body: string,
  side: 'LEFT' | 'RIGHT' = 'RIGHT',
): ReviewThread {
  return {
    id,
    prId: 'PR_0',
    anchor: {
      path,
      subjectType: line === null ? 'FILE' : 'LINE',
      side,
      line,
      startLine: null,
      startSide: null,
      originalLine: line,
      originalStartLine: null,
      commitOid: null,
      originalCommitOid: null,
    },
    isResolved: false,
    isOutdated: false,
    comments: [comment(`${id}-c1`, id, body)],
    local: { status: 'new', updatedAt: NOW },
  };
}

export interface WorldOptions {
  targeting?: Partial<PersistedTargeting>;
  layout?: Partial<PersistedLayout>;
  files?: Record<string, string>;
  commits?: Commit[];
  searchableCommits?: Commit[];
  prs?: PrListItem[];
  searchablePrs?: PrListItem[];
  threads?: ReviewThread[];
  diffRows?: Record<string, DiffRow[]>;
}

export interface World {
  handlers: Handlers;
  threads: ReviewThread[];
}

const defaultLayout: PersistedLayout = {
  sidePanelWidth: 300,
  fileCommentsPanelWidth: 300,
  fileCommentsPanelOpen: false,
  hideViewedFiles: false,
  fileControlsDocked: false,
  fileControlsPosition: null,
  wrapLongLines: false,
  fullFileDiff: false,
};

function matches(text: string, search: string | undefined): boolean {
  return !search || text.toLowerCase().includes(search.toLowerCase());
}

export function createWorld(options: WorldOptions = {}): World {
  const files = options.files ?? { 'a.ts': 'const a = 1;\n', 'b.ts': 'const b = 2;\n' };
  const commits = options.commits ?? [];
  const searchableCommits = options.searchableCommits ?? [];
  const prs = options.prs ?? [];
  const searchablePrs = options.searchablePrs ?? [];
  const threads = [...(options.threads ?? [])];
  const paths = Object.keys(files);
  let counter = 0;
  const nextId = (prefix: string): string => `${prefix}_${++counter}`;

  const handlers: Handlers = {
    'app.startup': () => ({
      project: {
        id: PROJECT_ID,
        url: 'https://github.com/acme/widgets',
        owner: 'acme',
        repo: 'widgets',
        addedAt: NOW,
        cloned: true,
      },
      head: HEAD,
      targeting: { pr: null, commit: null, path: null, ...options.targeting },
      layout: { ...defaultLayout, ...options.layout },
    }),
    'app.viewer': () => null,
    'theme.getSystemPrefersDark': () => false,
    'theme.getTemplateId': () => null,
    'themes.list': () => [],
    'locale.getLocaleId': () => null,
    'locales.list': () => [],
    'keybindings.getOverrides': () => ({}),
    'extensions.list': () => [],
    'grammars.list': () => [],
    'log.write': () => undefined,
    'log.getPath': () => '/tmp/gepard.log',
    'contextMenu.setLabels': () => undefined,
    'contextMenu.setLineTarget': () => undefined,
    'projects.setTargeting': () => undefined,
    'projects.setLayout': () => undefined,
    'index.get': () => ({ state: 'idle' }),
    'index.languages': () => null,
    'pr.checkout': () => ({ base: BASE, head: HEAD }),
    'sync.run': () => ({
      base: BASE,
      head: HEAD,
      syncedAt: NOW,
      droppedRemoteDeleted: 0,
    }),
    'sync.pendingCount': () => 0,
    'viewed.list': () => [],
    'overview.project': () => ({ prs: [], closedPrs: [], activity: [] }),
    'overview.owners': () => null,
    'files.changed': () => paths.map(changedFile),
    'trees.get': () => paths,
    'files.content': ({ path, sha: contentSha }) => ({
      kind: 'text',
      path,
      sha: contentSha,
      text: files[path] ?? '',
    }),
    'files.diff': ({ path }) => ({
      kind: 'text',
      path,
      previousPath: null,
      rows:
        options.diffRows?.[path] ??
        (files[path] ?? '')
          .split('\n')
          .filter((_, i, all) => i < all.length - 1)
          .map((text, i) => ({
            kind: 'add' as const,
            oldLine: null,
            newLine: i + 1,
            text,
          })),
    }),
    'pr.view': ({ pr: number }) => {
      const found = [...prs, ...searchablePrs].find((p) => p.number === number);
      if (!found) throw new Error(`no pr ${number}`);
      return { ...found, baseRefOid: BASE };
    },
    'symbols.line': ({ path, line }) => ({ path, line, symbols: [] }),
    'commits.list': ({ search }) => {
      if (!search) return commits;
      return searchableCommits.filter((c) => matches(c.messageHeadline, search));
    },
    'pr.list': ({ search }) => {
      if (!search) return prs;
      return searchablePrs.filter((p) => matches(p.title, search));
    },
    'pr.commits': () => commits,
    'comments.list': () => structuredClone(threads),
    'comments.upsert': (draft) => {
      const body = draft.body;
      if (draft.id !== null && draft.id !== undefined) {
        for (const thread of threads) {
          const existing = thread.comments.find((c) => c.id === draft.id);
          if (existing) {
            existing.body = body;
            existing.local = { status: 'edited', updatedAt: NOW, references: [] };
            return existing;
          }
        }
        throw new Error(`no comment ${draft.id}`);
      }
      if (draft.threadId !== null && draft.threadId !== undefined) {
        const thread = threads.find((t) => t.id === draft.threadId);
        if (!thread) throw new Error(`no thread ${draft.threadId}`);
        const reply = comment(nextId('C'), thread.id, body);
        thread.comments.push(reply);
        return reply;
      }
      const anchor = draft.anchor;
      if (!anchor) throw new Error('draft without anchor');
      const threadId = nextId('T');
      const created = fileThread(threadId, anchor.path, anchor.line, body, anchor.side);
      threads.push(created);
      const root = created.comments[0];
      if (!root) throw new Error('created thread has no comment');
      return root;
    },
    'comments.delete': ({ commentId }) => {
      for (const [i, thread] of threads.entries()) {
        thread.comments = thread.comments.filter((c) => c.id !== commentId);
        if (thread.comments.length === 0) threads.splice(i, 1);
      }
    },
  };

  return { handlers, threads };
}
