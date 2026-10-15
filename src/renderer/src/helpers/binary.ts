const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
export type ByteUnit = (typeof BYTE_UNITS)[number];

export function byteUnit(bytes: number): { value: number; unit: ByteUnit } {
  let value = bytes;
  let index = 0;
  while (Math.abs(value) >= 1000 && index < BYTE_UNITS.length - 1) {
    value /= 1000;
    index += 1;
  }
  return { value, unit: BYTE_UNITS[index] ?? 'byte' };
}
