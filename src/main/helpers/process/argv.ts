// With `electron .` (process.defaultApp) argv[1] is the app path, so the
// positional arguments start one slot later than in a packaged binary.
export function positionalFromArgv(argv: string[], defaultApp: boolean): string | null {
  const args = argv.slice(defaultApp ? 2 : 1);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return args[i + 1] ?? null;
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

export interface AppCommandEnv {
  execPath: string;
  appPath: string;
  defaultApp: boolean;
  appImage: string | undefined;
}

// An AppImage's execPath lives in a mount that disappears with the parent, so
// a new instance must be started from the AppImage file itself.
export function appCommand(
  args: string[],
  env: AppCommandEnv,
): { command: string; args: string[] } {
  if (env.appImage) return { command: env.appImage, args };
  if (env.defaultApp) return { command: env.execPath, args: [env.appPath, ...args] };
  return { command: env.execPath, args };
}
