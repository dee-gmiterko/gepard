import type { TargetDescriptor } from '../helpers/eventTarget';

export function describeTarget(target: EventTarget | null): TargetDescriptor | null {
  if (!(target instanceof HTMLElement)) return null;
  return {
    tagName: target.tagName,
    type: target instanceof HTMLInputElement ? target.type : undefined,
    isContentEditable: target.isContentEditable,
    role: target.getAttribute('role'),
    hasHref: target instanceof HTMLAnchorElement && target.hasAttribute('href'),
  };
}
