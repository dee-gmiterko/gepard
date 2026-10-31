import { describe, expect, it } from 'vitest';
import {
  applyDeadZone,
  gamepadButtonIndex,
  gamepadInput,
  gamepadLabel,
  INITIAL_REPEAT_STATE,
  isGamepadInput,
  newlyPressed,
  pickFocusIndex,
  scrollStep,
  stepRepeat,
  stickDirection,
  type Rect,
} from '../../src/helpers/gamepad';

const rect = (left: number, top: number, size = 10): Rect => ({
  left,
  top,
  right: left + size,
  bottom: top + size,
});

describe('gamepad inputs', () => {
  it('round-trips button indexes', () => {
    expect(gamepadInput(3)).toBe('Gamepad:3');
    expect(gamepadButtonIndex('Gamepad:12')).toBe(12);
    expect(isGamepadInput('Gamepad:0')).toBe(true);
  });

  it('rejects keyboard chords and malformed inputs', () => {
    expect(isGamepadInput('Ctrl+G')).toBe(false);
    expect(isGamepadInput('Gamepad:')).toBe(false);
    expect(isGamepadInput('Gamepad:x')).toBe(false);
    expect(gamepadButtonIndex('Gamepad:-1')).toBeNull();
  });

  it('labels standard buttons by name and others by index', () => {
    expect(gamepadLabel('Gamepad:0')).toBe('Gamepad A');
    expect(gamepadLabel('Gamepad:9')).toBe('Gamepad Start');
    expect(gamepadLabel('Gamepad:40')).toBe('Gamepad button 40');
  });
});

describe('newlyPressed', () => {
  it('returns only buttons that went from released to pressed', () => {
    expect(newlyPressed([false, true, false], [true, true, false])).toEqual([0]);
    expect(newlyPressed([], [false, true])).toEqual([1]);
    expect(newlyPressed([true], [false])).toEqual([]);
  });
});

describe('applyDeadZone', () => {
  it('zeroes small values and rescales the rest', () => {
    expect(applyDeadZone(0.1)).toBe(0);
    expect(applyDeadZone(-0.2)).toBe(0);
    expect(applyDeadZone(1)).toBe(1);
    expect(applyDeadZone(-1)).toBe(-1);
    expect(applyDeadZone(0.6)).toBeCloseTo(0.5);
  });

  it('clamps values beyond full deflection', () => {
    expect(applyDeadZone(1.5)).toBe(1);
  });
});

describe('scrollStep', () => {
  it('scales with elapsed time and keeps the sign', () => {
    const a = scrollStep(0, 1, 1000, 1000);
    expect(a).toEqual({ dx: 0, dy: 1000 });
    expect(scrollStep(0, -1, 500, 1000).dy).toBe(-500);
  });

  it('does not move inside the dead zone', () => {
    expect(scrollStep(0.1, -0.15, 16, 1000)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('stickDirection', () => {
  it('picks the dominant axis past the threshold', () => {
    expect(stickDirection(1, 0.2)).toBe('right');
    expect(stickDirection(-1, 0.2)).toBe('left');
    expect(stickDirection(0.1, 0.9)).toBe('down');
    expect(stickDirection(0.1, -0.9)).toBe('up');
  });

  it('is null below the threshold', () => {
    expect(stickDirection(0.3, 0.3)).toBeNull();
  });
});

describe('stepRepeat', () => {
  it('fires immediately, waits the delay, then repeats at the interval', () => {
    let step = stepRepeat(INITIAL_REPEAT_STATE, 'down', 0, 300, 100);
    expect(step.fire).toBe(true);
    step = stepRepeat(step.state, 'down', 200, 300, 100);
    expect(step.fire).toBe(false);
    step = stepRepeat(step.state, 'down', 300, 300, 100);
    expect(step.fire).toBe(true);
    step = stepRepeat(step.state, 'down', 350, 300, 100);
    expect(step.fire).toBe(false);
    step = stepRepeat(step.state, 'down', 400, 300, 100);
    expect(step.fire).toBe(true);
  });

  it('fires again on a direction change and resets on release', () => {
    const first = stepRepeat(INITIAL_REPEAT_STATE, 'down', 0);
    expect(stepRepeat(first.state, 'up', 10).fire).toBe(true);
    const released = stepRepeat(first.state, null, 10);
    expect(released.fire).toBe(false);
    expect(released.state).toEqual(INITIAL_REPEAT_STATE);
  });
});

describe('pickFocusIndex', () => {
  const current = rect(100, 100);

  it('picks the nearest candidate in the pushed direction', () => {
    const candidates = [rect(100, 200), rect(100, 140), rect(100, 20), rect(200, 100)];
    expect(pickFocusIndex(current, candidates, 'down')).toBe(1);
    expect(pickFocusIndex(current, candidates, 'up')).toBe(2);
    expect(pickFocusIndex(current, candidates, 'right')).toBe(3);
    expect(pickFocusIndex(current, candidates, 'left')).toBeNull();
  });

  it('prefers candidates aligned with the current one', () => {
    const candidates = [rect(300, 130), rect(110, 180)];
    expect(pickFocusIndex(current, candidates, 'down')).toBe(1);
  });

  it('starts at the first candidate without a current one', () => {
    expect(pickFocusIndex(null, [rect(0, 0), rect(5, 5)], 'down')).toBe(0);
    expect(pickFocusIndex(null, [], 'down')).toBeNull();
  });
});
