import type { Project } from '@gepard/common';

// With `electron .` (process.defaultApp) argv[1] is the app path, so the
// positional target starts one slot later than in a packaged binary.
export function launchTargetFromArgv(argv: string[], defaultApp: boolean): string | null {
  const args = argv.slice(defaultApp ? 2 : 1);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return args[i + 1] ?? null;
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

export function isGitHubUrl(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

export function findProjectByName(projects: Project[], name: string): Project | null {
  const wanted = name.trim().toLowerCase();
  const exact = projects.find(
    (p) => `${p.owner}/${p.repo}`.toLowerCase() === wanted || p.id.toLowerCase() === wanted,
  );
  if (exact) return exact;
  const byRepo = projects.filter((p) => p.repo.toLowerCase() === wanted);
  return byRepo.length === 1 ? byRepo[0] : null;
}

export interface DetachedLaunchEnv {
  execPath: string;
  appPath: string;
  defaultApp: boolean;
  appImage: string | undefined;
}

// An AppImage's execPath lives in a mount that disappears with the parent, so
// the new instance must be started from the AppImage file itself.
export function detachedLaunchCommand(
  target: string,
  env: DetachedLaunchEnv,
): { command: string; args: string[] } {
  if (env.appImage) return { command: env.appImage, args: [target] };
  if (env.defaultApp) return { command: env.execPath, args: [env.appPath, target] };
  return { command: env.execPath, args: [target] };
}
