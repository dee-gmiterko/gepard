import { useEffect, useLayoutEffect, useRef } from 'react';
import { newlyPressed } from '../helpers/gamepad';
import { useGamepadFrames } from './useGamepadFrames';

export function useGamepadButtonPresses(onPress: (button: number) => void, enabled = true): void {
  const onPressRef = useRef(onPress);
  useLayoutEffect(() => {
    onPressRef.current = onPress;
  });
  const previousRef = useRef(new Map<number, boolean[]>());

  useEffect(() => {
    const states = previousRef.current;
    states.clear();
    return () => states.clear();
  }, [enabled]);

  useGamepadFrames((pads) => {
    for (const pad of pads) {
      const current = pad.buttons.map((button) => button.pressed);
      const before = previousRef.current.get(pad.index);
      previousRef.current.set(pad.index, current);
      // A button already held when polling starts must not count as a press.
      if (!before) continue;
      for (const button of newlyPressed(before, current)) onPressRef.current(button);
    }
  }, enabled);
}
