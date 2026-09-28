import { describe, expect, it } from 'vitest';
import {
  isInteractiveControlTarget,
  isTextEntryTarget,
  type TargetDescriptor,
} from '../src/keyboard/keyTargets';

function target(overrides: Partial<TargetDescriptor> & { tagName: string }): TargetDescriptor {
  return { role: null, ...overrides };
}

describe('isTextEntryTarget', () => {
  it('treats textareas and selects as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'TEXTAREA' }))).toBe(true);
    expect(isTextEntryTarget(target({ tagName: 'SELECT' }))).toBe(true);
  });

  it('treats a plain text input as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'INPUT', type: 'text' }))).toBe(true);
    expect(isTextEntryTarget(target({ tagName: 'INPUT' }))).toBe(true);
  });

  it('does not treat a checkbox, radio or button input as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'INPUT', type: 'checkbox' }))).toBe(false);
    expect(isTextEntryTarget(target({ tagName: 'INPUT', type: 'radio' }))).toBe(false);
    expect(isTextEntryTarget(target({ tagName: 'INPUT', type: 'submit' }))).toBe(false);
  });

  it('does not treat role="tab"/"option"/"treeitem" as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'DIV', role: 'tab' }))).toBe(false);
    expect(isTextEntryTarget(target({ tagName: 'DIV', role: 'option' }))).toBe(false);
    expect(isTextEntryTarget(target({ tagName: 'DIV', role: 'treeitem' }))).toBe(false);
  });

  it('treats a contentEditable element as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
    expect(isTextEntryTarget(target({ tagName: 'DIV', isContentEditable: false }))).toBe(false);
  });

  it('does not treat a plain button as text entry', () => {
    expect(isTextEntryTarget(target({ tagName: 'BUTTON' }))).toBe(false);
  });
});

describe('isInteractiveControlTarget', () => {
  it('treats a button as an interactive control (Sync, tabs, icon buttons)', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'BUTTON' }))).toBe(true);
  });

  it('treats an anchor with an href as an interactive control, but not a bare anchor', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'A', hasHref: true }))).toBe(true);
    expect(isInteractiveControlTarget(target({ tagName: 'A', hasHref: false }))).toBe(false);
  });

  it('treats role="button" and role="link" as interactive controls', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'DIV', role: 'button' }))).toBe(true);
    expect(isInteractiveControlTarget(target({ tagName: 'DIV', role: 'link' }))).toBe(true);
  });

  it('treats a checkbox or radio input as an interactive control (sidebar viewed checkbox)', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'INPUT', type: 'checkbox' }))).toBe(true);
    expect(isInteractiveControlTarget(target({ tagName: 'INPUT', type: 'radio' }))).toBe(true);
  });

  it('treats role="tab", "option" and "treeitem" as interactive controls', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'DIV', role: 'tab' }))).toBe(true);
    expect(isInteractiveControlTarget(target({ tagName: 'LI', role: 'option' }))).toBe(true);
    expect(isInteractiveControlTarget(target({ tagName: 'DIV', role: 'treeitem' }))).toBe(true);
  });

  it('does not treat a plain div or text input as an interactive control', () => {
    expect(isInteractiveControlTarget(target({ tagName: 'DIV' }))).toBe(false);
    expect(isInteractiveControlTarget(target({ tagName: 'INPUT', type: 'text' }))).toBe(false);
  });
});
