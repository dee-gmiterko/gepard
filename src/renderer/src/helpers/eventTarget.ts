export interface TargetDescriptor {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
  role?: string | null;
  hasHref?: boolean;
}

const CONTROL_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'tab',
  'option',
  'treeitem',
  'checkbox',
  'radio',
  'menuitem',
  'switch',
]);

export function isTextEntryTarget(target: TargetDescriptor): boolean {
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  if (target.tagName === 'INPUT') return !CONTROL_INPUT_TYPES.has(target.type ?? 'text');
  return Boolean(target.isContentEditable);
}

export function isInteractiveControlTarget(target: TargetDescriptor): boolean {
  if (target.tagName === 'BUTTON') return true;
  if (target.tagName === 'A' && target.hasHref) return true;
  if (target.tagName === 'INPUT' && CONTROL_INPUT_TYPES.has(target.type ?? '')) return true;
  return target.role != null && INTERACTIVE_ROLES.has(target.role);
}
