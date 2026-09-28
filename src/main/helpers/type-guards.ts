export function isFn(v: unknown): v is (...args: never[]) => unknown {
  return typeof v === 'function';
}
