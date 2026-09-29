function abandonedRequestError(): Error {
  const err = new Error('LSP session crashed; request abandoned');
  err.name = 'AbortError';
  return err;
}

export class CrashGate {
  private logged = false;
  private rejectPending: (() => void) | null = null;
  private pending!: Promise<never>;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.logged = false;
    this.pending = new Promise<never>((_, reject) => {
      this.rejectPending = () => reject(abandonedRequestError());
    });
    this.pending.catch(() => {});
  }

  guard<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.pending]);
  }

  crash(): boolean {
    this.rejectPending?.();
    if (this.logged) return false;
    this.logged = true;
    return true;
  }
}
