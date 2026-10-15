import { z } from 'zod';

export const ByteUnit = z.enum(['byte', 'kilobyte', 'megabyte', 'gigabyte']);
export type ByteUnit = z.infer<typeof ByteUnit>;

export function byteUnit(bytes: number): { value: number; unit: ByteUnit } {
  let value = bytes;
  let index = 0;
  while (Math.abs(value) >= 1000 && index < ByteUnit.options.length - 1) {
    value /= 1000;
    index += 1;
  }
  return { value, unit: ByteUnit.options[index] ?? 'byte' };
}
