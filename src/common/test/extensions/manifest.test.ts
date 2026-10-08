import { describe, expect, it } from 'vitest';
import { packageManifestSchema } from '../../extensions/manifest';

describe('packageManifestSchema', () => {
  it('rejects non-objects', () => {
    expect(packageManifestSchema.safeParse(null).success).toBe(false);
    expect(packageManifestSchema.safeParse('x').success).toBe(false);
  });
});
