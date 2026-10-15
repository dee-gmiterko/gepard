export function releaseTagPrefix(packageName: string): string {
  return `${packageName}-v`;
}

const PLATFORM_ARCHIVE_RE = /-[a-z0-9]+-(?:x64|arm64|ia32|arm|ppc64|s390x|riscv64|loong64)\.tgz$/;

export function pickReleaseAsset(assetNames: readonly string[], target: string): string | null {
  const archives = assetNames.filter((name) => name.endsWith('.tgz'));
  return (
    archives.find((name) => name.endsWith(`-${target}.tgz`)) ??
    archives.find((name) => !PLATFORM_ARCHIVE_RE.test(name)) ??
    null
  );
}
