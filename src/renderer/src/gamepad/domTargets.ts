import { pickFocusIndex, type FocusDirection } from '../helpers/gamepad';

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex], [role="treeitem"], [role="row"], [role="option"]';
const ROVING_ROLES = new Set(['treeitem', 'row', 'option']);
const MAIN_SCROLLERS = '[data-gamepad-scroll], .cm-scroller';

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isScrollable(el: Element): boolean {
  const style = getComputedStyle(el);
  const vertical = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
  const horizontal = /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
  return vertical || horizontal;
}

function scrollableAncestor(from: Element | null): Element | null {
  for (let el = from; el; el = el.parentElement) {
    if (isScrollable(el)) return el;
  }
  return null;
}

export function findScrollTarget(): Element | null {
  const active = document.activeElement;
  if (document.querySelector('dialog[open]')) return scrollableAncestor(active);
  const main = Array.from(document.querySelectorAll(MAIN_SCROLLERS)).find(
    (el) => isVisible(el) && isScrollable(el),
  );
  return main ?? scrollableAncestor(active);
}

function isFocusCandidate(el: Element): boolean {
  if (!(el instanceof HTMLElement) || el.hasAttribute('disabled') || !isVisible(el)) return false;
  if (el.tabIndex < 0 && !ROVING_ROLES.has(el.getAttribute('role') ?? '')) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
}

export function moveFocus(direction: FocusDirection): void {
  const root = document.querySelector('dialog[open]') ?? document;
  const active = document.activeElement;
  const candidates = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el): el is HTMLElement => el !== active && isFocusCandidate(el),
  );
  const current =
    active && active !== document.body && root.contains(active)
      ? active.getBoundingClientRect()
      : null;
  const index = pickFocusIndex(
    current,
    candidates.map((el) => el.getBoundingClientRect()),
    direction,
  );
  if (index === null) return;
  candidates[index].focus();
  candidates[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
