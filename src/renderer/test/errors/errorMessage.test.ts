import { MissingDependencyError, fromIpcErrorShape, toIpcErrorShape } from '@gepard/common';
import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { describeError, errorText, formatDescribedError } from '../../src/errors/errorMessage';

const intl = createIntl({ locale: 'en' });
const transported = (): ReturnType<typeof fromIpcErrorShape> =>
  fromIpcErrorShape(toIpcErrorShape(new MissingDependencyError('rg')), 'search.run');

describe('error message values', () => {
  it('carries the typed error values across the IPC boundary', () => {
    expect(describeError(transported()).values).toEqual({ dependency: 'rg' });
  });

  it('formats the localized message with the carried values', () => {
    expect(formatDescribedError(intl, transported())).toBe(
      'rg was not found. Install it and make sure it is on your PATH.',
    );
  });

  it('formats the log headline with the carried values', () => {
    const { message, values } = describeError(transported());
    expect(errorText(message, values)).toContain('rg was not found');
  });
});
