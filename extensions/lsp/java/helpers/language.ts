const JAVA_EXTENSIONS = /\.java$/;

export function matches(filePath: string): boolean {
  return JAVA_EXTENSIONS.test(filePath);
}

export function languageId(): string {
  return 'java';
}

export function warmupFile(files: string[]): string | undefined {
  return files.find((f) => JAVA_EXTENSIONS.test(f));
}
