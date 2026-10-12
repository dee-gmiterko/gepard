import { z } from 'zod';
import {
  AuthError,
  ConnectionError,
  ExecError,
  RateLimitError,
  RemoteNotFoundError,
  type GqlError,
} from '@gepard/common';
import { checkGqlErrors } from '../helpers/github/ghParsing';
import { run, runJson, type RunResult } from '../helpers/process/exec';
import { connectivity, type RemoteObserver } from '../services/connectivity';

const GH_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_PAGER: 'cat',
  NO_COLOR: '1',
  CLICOLOR: '0',
};

const DEFAULT_TIMEOUT_MS = 30_000;

// gh prints its own "error connecting to <host>" for dial failures and Go's
// net errors (`dial tcp ...`, `net/http: ...`) for everything else.
const CONNECTION_PATTERNS: RegExp[] = [
  /error connecting to /i,
  /check your internet connection/i,
  /dial tcp/i,
  /no such host/i,
  /temporary failure in name resolution/i,
  /i\/o timeout/i,
  /TLS handshake timeout/i,
  /context deadline exceeded/i,
  /connection (refused|reset)/i,
  /network is unreachable/i,
  /no route to host/i,
];

const AUTH_PATTERNS: RegExp[] = [
  /gh auth login/i,
  /not logged in/i,
  /HTTP 401/,
  /bad credentials/i,
  /requires authentication/i,
  /authentication (required|failed)/i,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [/rate limit/i, /HTTP 429/, /\(RATE_LIMITED\)/];

// REST failures end in "(HTTP 404)"; GraphQL partial errors in "(NOT_FOUND)".
const NOT_FOUND_PATTERNS: RegExp[] = [/HTTP 404/, /\(NOT_FOUND\)/];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyFailure(error: unknown): unknown {
  if (!(error instanceof ExecError)) return error;
  const { stderr, message, details } = error;
  if (matches(CONNECTION_PATTERNS, stderr)) return new ConnectionError(message, details);
  if (matches(AUTH_PATTERNS, stderr)) return new AuthError(message, details);
  if (matches(RATE_LIMIT_PATTERNS, stderr)) return new RateLimitError(message, details);
  if (matches(NOT_FOUND_PATTERNS, stderr)) return new RemoteNotFoundError(message, details);
  return error;
}

export interface GhCallOptions {
  stdin?: string;
  timeoutMs?: number;
}

export type GhExec = Pick<typeof import('../helpers/process/exec'), 'run' | 'runJson'>;

export class GhClient {
  constructor(
    private readonly observer: RemoteObserver = connectivity,
    private readonly exec: GhExec = { run, runJson },
  ) {}

  private opts(opts: GhCallOptions): { env: NodeJS.ProcessEnv; timeoutMs: number; stdin?: string } {
    return { env: GH_ENV, timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, stdin: opts.stdin };
  }

  private async observe<T>(call: Promise<T>): Promise<T> {
    try {
      const value = await call;
      this.observer.onRemoteResult(true);
      return value;
    } catch (e) {
      const failure = classifyFailure(e);
      this.observer.onRemoteResult(false, failure);
      throw failure;
    }
  }

  run(args: string[], opts: GhCallOptions = {}): Promise<RunResult> {
    return this.observe(this.exec.run('gh', args, this.opts(opts)));
  }

  json<T extends z.ZodType>(
    schema: T,
    args: string[],
    opts: GhCallOptions = {},
  ): Promise<z.output<T>> {
    return this.observe(this.exec.runJson(schema, 'gh', args, this.opts(opts)));
  }

  // `gh api --paginate` hangs on GraphQL queries whose cursor variable is not
  // named exactly `$endCursor`.
  async graphql<T extends { errors?: GqlError[] }>(
    schema: z.ZodType<T>,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const result = await this.json(schema, ['api', 'graphql', '--input', '-'], {
      stdin: JSON.stringify({ query, variables }),
    });
    checkGqlErrors(result.errors);
    return result;
  }
}

export const ghClient = new GhClient();
