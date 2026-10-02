const PY_EXTENSIONS = /\.pyi?$/;

export function matches(filePath: string): boolean {
  return PY_EXTENSIONS.test(filePath);
}

export function languageId(): string {
  return 'python';
}

export function warmupFile(files: string[]): string | undefined {
  return files.find((f) => PY_EXTENSIONS.test(f) && !f.endsWith('.pyi'));
}
