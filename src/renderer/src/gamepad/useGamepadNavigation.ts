import { useRef } from 'react';
import {
  INITIAL_REPEAT_STATE,
  scrollStep,
  stepRepeat,
  stickDirection,
  type RepeatState,
} from '../helpers/gamepad';
import { activateFocused, findScrollTarget, moveFocus } from './domTargets';
import { useGamepadButtonPresses } from './useGamepadButtonPresses';
import { useGamepadFrames } from './useGamepadFrames';

const LEFT_STICK = [0, 1] as const;
const RIGHT_STICK = [2, 3] as const;
const LEFT_STICK_CLICK = 10;

export function useGamepadNavigation(): void {
  const repeatRef = useRef<RepeatState>(INITIAL_REPEAT_STATE);

  useGamepadButtonPresses((button) => {
    if (button === LEFT_STICK_CLICK) activateFocused();
  });

  useGamepadFrames((pads, elapsedMs) => {
    const pad = pads.find((p) => p.axes.length >= 4);
    if (!pad) return;

    const [leftX, leftY] = LEFT_STICK.map((axis) => pad.axes[axis]);
    const step = stepRepeat(repeatRef.current, stickDirection(leftX, leftY), performance.now());
    repeatRef.current = step.state;
    if (step.state.direction && step.fire) moveFocus(step.state.direction);

    const [rightX, rightY] = RIGHT_STICK.map((axis) => pad.axes[axis]);
    const { dx, dy } = scrollStep(rightX, rightY, elapsedMs);
    if (dx !== 0 || dy !== 0) findScrollTarget()?.scrollBy(dx, dy);
  });
}
