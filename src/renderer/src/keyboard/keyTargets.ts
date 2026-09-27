export interface TargetDescriptor {
  tagName: string
  type?: string
  isContentEditable?: boolean
  role?: string | null
  hasHref?: boolean
}

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset'])
const INTERACTIVE_ROLES = new Set(['button', 'link'])

export function isTextEntryTarget(target: TargetDescriptor): boolean {
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true
  if (target.tagName === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(target.type ?? 'text')
  return Boolean(target.isContentEditable)
}

export function isInteractiveControlTarget(target: TargetDescriptor): boolean {
  if (target.tagName === 'BUTTON') return true
  if (target.tagName === 'A' && target.hasHref) return true
  return target.role != null && INTERACTIVE_ROLES.has(target.role)
}

export function describeTarget(target: EventTarget | null): TargetDescriptor | null {
  if (!(target instanceof HTMLElement)) return null
  return {
    tagName: target.tagName,
    type: target instanceof HTMLInputElement ? target.type : undefined,
    isContentEditable: target.isContentEditable,
    role: target.getAttribute('role'),
    hasHref: target instanceof HTMLAnchorElement && target.hasAttribute('href')
  }
}
