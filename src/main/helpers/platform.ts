export function platformTarget(): string {
  return `${process.platform}-${process.arch}`;
}
