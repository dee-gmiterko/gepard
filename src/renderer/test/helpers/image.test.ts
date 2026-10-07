import { describe, expect, it } from 'vitest';
import { imageSrc } from '../../src/helpers/image';

describe('imageSrc', () => {
  it('builds a base64 data URL', () => {
    expect(imageSrc({ mime: 'image/png', base64: 'QUJD' })).toBe('data:image/png;base64,QUJD');
  });
});
