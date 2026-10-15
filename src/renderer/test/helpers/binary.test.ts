import { describe, expect, it } from 'vitest';
import { byteUnit } from '../../src/helpers/binary';

describe('byteUnit', () => {
  it('keeps small values in bytes', () => {
    expect(byteUnit(0)).toEqual({ value: 0, unit: 'byte' });
    expect(byteUnit(999)).toEqual({ value: 999, unit: 'byte' });
  });

  it('scales by thousands up to gigabytes', () => {
    expect(byteUnit(1500)).toEqual({ value: 1.5, unit: 'kilobyte' });
    expect(byteUnit(2_000_000)).toEqual({ value: 2, unit: 'megabyte' });
    expect(byteUnit(3_000_000_000_000)).toEqual({ value: 3000, unit: 'gigabyte' });
  });

  it('scales negative deltas by their magnitude', () => {
    expect(byteUnit(-1500)).toEqual({ value: -1.5, unit: 'kilobyte' });
  });
});
