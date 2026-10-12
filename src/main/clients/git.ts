import { AuthError, ConnectionError, ExecError } from '@gepard/common';
import { run, runBuffer, type RunBufferResult, type RunResult } from '../helpers/process/exec';
import { connectivity, type RemoteObserver } from '../services/connectivity';

// `GIT_TERMINAL_PROMPT=0` makes git fail instead of prompting for credentials.
const GIT_ENV: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const GIT_TIMEOUT_MS = 2 * 60_000;

const GH_CREDENTIAL_ARGS = [
  '-c',
  'credential.helper=',
  '-c',
  'credential.helper=!gh auth git-credential',
];

const REMOTE_SUBCOMMANDS = new Set(['fetch', 'clone', 'push', 'pull', 'ls-remote']);

// Over https git relays curl's messages after "unable to access '<url>':";
// over ssh it relays OpenSSH's "ssh: ..." lines.
const CONNECTION_PATTERNS: RegExp[] = [
  /could ?n.t resolve (host|hostname|proxy)/i,
  /temporary failure in name resolution/i,
  /nodename nor servname provided/i,
  /failed to connect to/i,
  /could ?n.t connect to server/i,
  /unable to connect to/i,
  /connection (refused|reset|timed out)/i,
  /timeout was reached/i,
  /operation timed out/i,
  /network is unreachable/i,
  /no route to host/i,
  /recv failure/i,
  /empty reply from server/i,
  /gnutls recv error/i,
  /ssl_error_syscall/i,
];

// `GIT_TERMINAL_PROMPT=0` turns a missing credential into "could not read Username".
const AUTH_PATTERNS: RegExp[] = [
  /authentication failed/i,
  /could not read (username|password)/i,
  /permission denied \(publickey/i,
  /invalid username or password/i,
  /requested URL returned error: 40[13]\b/,
];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyRemoteFailure(error: unknown): unknown {
  if (!(error instanceof ExecError)) return error;
  const { stderr, message, details } = error;
  if (matches(CONNECTION_PATTERNS, stderr)) return new ConnectionError(message, details);
  if (matches(AUTH_PATTERNS, stderr)) return new AuthError(message, details);
  return error;
}

export function gitSubcommand(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '-C') {
      i++;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

export function isRemoteGitCommand(args: string[]): boolean {
  const subcommand = gitSubcommand(args);
  return subcommand !== null && REMOTE_SUBCOMMANDS.has(subcommand);
}

export interface GitRunOptions {
  stdin?: string;
}

export interface GitCloneOptions {
  hooksPath: string;
  onStderrLine?: (line: string) => void;
}

export type GitExec = Pick<typeof import('../helpers/process/exec'), 'run' | 'runBuffer'>;

export class GitClient {
  constructor(
    private readonly observer: RemoteObserver = connectivity,
    private readonly exec: GitExec = { run, runBuffer },
  ) {}

  private async observe<T>(args: string[], call: Promise<T>): Promise<T> {
    if (!isRemoteGitCommand(args)) return call;
    try {
      const value = await call;
      this.observer.onRemoteResult(true);
      return value;
    } catch (e) {
      const failure = classifyRemoteFailure(e);
      this.observer.onRemoteResult(false, failure);
      throw failure;
    }
  }

  run(repoRoot: string, args: string[], opts: GitRunOptions = {}): Promise<RunResult> {
    return this.observe(
      args,
      this.exec.run('git', [...GH_CREDENTIAL_ARGS, ...args], {
        cwd: repoRoot,
        env: GIT_ENV,
        timeoutMs: GIT_TIMEOUT_MS,
        stdin: opts.stdin,
      }),
    );
  }

  buffer(repoRoot: string, args: string[]): Promise<RunBufferResult> {
    return this.observe(
      args,
      this.exec.runBuffer('git', [...GH_CREDENTIAL_ARGS, ...args], {
        cwd: repoRoot,
        env: GIT_ENV,
        timeoutMs: GIT_TIMEOUT_MS,
      }),
    );
  }

  clone(
    url: string,
    dir: string,
    { hooksPath, onStderrLine }: GitCloneOptions,
  ): Promise<RunResult> {
    const args = [
      ...GH_CREDENTIAL_ARGS,
      '-c',
      `core.hooksPath=${hooksPath}`,
      '-c',
      'core.fsmonitor=false',
      '-c',
      'advice.detachedHead=false',
      'clone',
      '--progress',
      '--config',
      `core.hooksPath=${hooksPath}`,
      '--config',
      'core.fsmonitor=false',
      url,
      dir,
    ];
    return this.observe(args, this.exec.run('git', args, { env: GIT_ENV, onStderrLine }));
  }
}

export const gitClient = new GitClient();
