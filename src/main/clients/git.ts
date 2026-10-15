import type {
  run as runProcess,
  runBuffer as runBufferProcess,
  RunBufferResult,
  RunResult,
} from '../helpers/process/exec';
import { classifyRemoteFailure } from './gitError';
import type { RemoteObserver } from '../services/connectivity';

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

export class GitClient {
  constructor(
    private readonly observer: RemoteObserver,
    private readonly execRun: typeof runProcess,
    private readonly execRunBuffer: typeof runBufferProcess,
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
      this.execRun('git', [...GH_CREDENTIAL_ARGS, ...args], {
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
      this.execRunBuffer('git', [...GH_CREDENTIAL_ARGS, ...args], {
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
    return this.observe(args, this.execRun('git', args, { env: GIT_ENV, onStderrLine }));
  }
}
