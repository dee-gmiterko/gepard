export function importDefaultExport(source: string): Promise<unknown> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  return import(/* @vite-ignore */ url)
    .then((mod: { default?: unknown }) => mod.default)
    .finally(() => URL.revokeObjectURL(url));
}
