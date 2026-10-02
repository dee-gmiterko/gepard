export class Cache {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    return this.entries.get(key);
  }
}

export const LIMIT = 10;

export function makeCache() {
  return new Cache();
}
