export function dedupeInFlight<T>(work: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const inFlight = new Map<string, Promise<T>>();
  return (key) => {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = work(key).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return pending;
  };
}
