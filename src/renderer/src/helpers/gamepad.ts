const GAMEPAD_PREFIX = 'Gamepad:';

export function gamepadInput(buttonIndex: number): string {
  return `${GAMEPAD_PREFIX}${buttonIndex}`;
}

export function isGamepadInput(input: string): boolean {
  return gamepadButtonIndex(input) !== null;
}

export function gamepadButtonIndex(input: string): number | null {
  if (!input.startsWith(GAMEPAD_PREFIX)) return null;
  const rest = input.slice(GAMEPAD_PREFIX.length);
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

// Names follow the W3C "standard" gamepad mapping.
const STANDARD_BUTTON_NAMES: readonly string[] = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Back',
  'Start',
  'L3',
  'R3',
  'D-pad ↑',
  'D-pad ↓',
  'D-pad ←',
  'D-pad →',
  'Home',
];

export function gamepadLabel(input: string): string {
  const index = gamepadButtonIndex(input);
  if (index === null) return input;
  return `Gamepad ${STANDARD_BUTTON_NAMES[index] ?? `button ${index}`}`;
}

export function newlyPressed(previous: readonly boolean[], current: readonly boolean[]): number[] {
  const pressed: number[] = [];
  current.forEach((down, index) => {
    if (down && !previous[index]) pressed.push(index);
  });
  return pressed;
}

export const STICK_DEAD_ZONE = 0.2;
export const FOCUS_THRESHOLD = 0.6;
export const SCROLL_SPEED_PX_PER_SECOND = 1400;
export const FOCUS_REPEAT_DELAY_MS = 350;
export const FOCUS_REPEAT_INTERVAL_MS = 160;

// Rescales so the output starts at 0 right outside the dead zone instead of jumping to the zone's edge.
export function applyDeadZone(value: number, deadZone = STICK_DEAD_ZONE): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  const scaled = (Math.min(magnitude, 1) - deadZone) / (1 - deadZone);
  return Math.sign(value) * scaled;
}

export function scrollStep(
  x: number,
  y: number,
  elapsedMs: number,
  speed = SCROLL_SPEED_PX_PER_SECOND,
): { dx: number; dy: number } {
  const curve = (value: number): number => {
    const v = applyDeadZone(value);
    return Math.sign(v) * v * v;
  };
  const seconds = elapsedMs / 1000;
  return { dx: curve(x) * speed * seconds, dy: curve(y) * speed * seconds };
}

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export function stickDirection(
  x: number,
  y: number,
  threshold = FOCUS_THRESHOLD,
): FocusDirection | null {
  if (Math.hypot(x, y) < threshold) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export interface RepeatState {
  direction: FocusDirection | null;
  nextAt: number;
}

export const INITIAL_REPEAT_STATE: RepeatState = { direction: null, nextAt: 0 };

export function stepRepeat(
  state: RepeatState,
  direction: FocusDirection | null,
  now: number,
  delayMs = FOCUS_REPEAT_DELAY_MS,
  intervalMs = FOCUS_REPEAT_INTERVAL_MS,
): { state: RepeatState; fire: boolean } {
  if (direction === null) return { state: INITIAL_REPEAT_STATE, fire: false };
  if (direction !== state.direction) {
    return { state: { direction, nextAt: now + delayMs }, fire: true };
  }
  if (now >= state.nextAt) {
    return { state: { direction, nextAt: now + intervalMs }, fire: true };
  }
  return { state, fire: false };
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function center(rect: Rect): { x: number; y: number } {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

const CROSS_AXIS_WEIGHT = 2;

export function pickFocusIndex(
  current: Rect | null,
  candidates: readonly Rect[],
  direction: FocusDirection,
): number | null {
  if (candidates.length === 0) return null;
  if (current === null) return 0;
  const from = center(current);
  let best: number | null = null;
  let bestScore = Infinity;
  candidates.forEach((candidate, index) => {
    const to = center(candidate);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const forward =
      direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    if (forward <= 0.5) return;
    const cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = forward + cross * CROSS_AXIS_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
