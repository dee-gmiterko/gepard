const CS_EXTENSIONS = /\.csx?$/;

export function matches(filePath: string): boolean {
  return CS_EXTENSIONS.test(filePath);
}

export function languageId(): string {
  return 'csharp';
}

export function warmupFile(files: string[]): string | undefined {
  return files.find((f) => CS_EXTENSIONS.test(f));
}
