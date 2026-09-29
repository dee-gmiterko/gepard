export class Store {
  items: string[] = [];

  add(item: string): void {
    this.items.push(item);
  }
}

export enum Color {
  Red,
  Green,
}

export type Id = string;

export const VERSION = 1;

export function makeStore(): Store {
  return new Store();
}

export namespace Util {
  export const noop = (): void => {};
}
