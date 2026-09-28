export function comparePaths(a: string, b: string): number {
  const left = a.split('/');
  const right = b.split('/');
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}
