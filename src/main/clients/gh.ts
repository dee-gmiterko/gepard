import { z } from 'zod';
import type { GqlError } from '@gepard/common';
import { checkGqlErrors } from '../helpers/github/ghParsing';
import type {
  run as runProcess,
  runJson as runJsonProcess,
  RunResult,
} from '../helpers/process/exec';
import { classifyFailure } from './ghError';
import type { RemoteObserver } from '../services/connectivity';

const GH_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_PAGER: 'cat',
  NO_COLOR: '1',
  CLICOLOR: '0',
};

const DEFAULT_TIMEOUT_MS = 30_000;

export interface GhCallOptions {
  stdin?: string;
  timeoutMs?: number;
}

export class GhClient {
  constructor(
    private readonly observer: RemoteObserver,
    private readonly execRun: typeof runProcess,
    private readonly execRunJson: typeof runJsonProcess,
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
    return this.observe(this.execRun('gh', args, this.opts(opts)));
  }

  json<T extends z.ZodType>(
    schema: T,
    args: string[],
    opts: GhCallOptions = {},
  ): Promise<z.output<T>> {
    return this.observe(this.execRunJson(schema, 'gh', args, this.opts(opts)));
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
