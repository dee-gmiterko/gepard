export const GD_EXTENSIONS = /\.gd$/;

export function matches(filePath: string): boolean {
  return GD_EXTENSIONS.test(filePath);
}

export function languageId(): string {
  return 'gdscript';
}

export function warmupFile(files: string[]): string | undefined {
  return files.find((f) => GD_EXTENSIONS.test(f));
}
