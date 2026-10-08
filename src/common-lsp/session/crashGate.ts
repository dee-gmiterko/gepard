import { AbortError } from '@gepard/common';

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
      this.rejectPending = () => reject(new AbortError('LSP session crashed; request abandoned'));
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
