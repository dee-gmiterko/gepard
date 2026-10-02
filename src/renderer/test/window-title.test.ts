import { describe, expect, it } from 'vitest';
import { windowTitle } from '../src/helpers/windowTitle';

describe('windowTitle', () => {
  it('is the bare app name without a project', () => {
    expect(windowTitle(null)).toBe('Gepard');
    expect(windowTitle(undefined)).toBe('Gepard');
    expect(windowTitle('')).toBe('Gepard');
  });

  it('appends the project name when one is open', () => {
    expect(windowTitle('gepard')).toBe('Gepard - gepard');
  });
});
