import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export function connectedGamepads(): Gamepad[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads()).filter(
    (pad): pad is Gamepad => pad !== null && pad.connected,
  );
}

function subscribeGamepads(onChange: () => void): () => void {
  window.addEventListener('gamepadconnected', onChange);
  window.addEventListener('gamepaddisconnected', onChange);
  return () => {
    window.removeEventListener('gamepadconnected', onChange);
    window.removeEventListener('gamepaddisconnected', onChange);
  };
}

function hasGamepad(): boolean {
  return connectedGamepads().length > 0;
}

function useGamepadConnected(): boolean {
  return useSyncExternalStore(subscribeGamepads, hasGamepad);
}

export function useGamepadFrames(
  onFrame: (pads: readonly Gamepad[], elapsedMs: number) => void,
  enabled = true,
): void {
  const connected = useGamepadConnected();
  const onFrameRef = useRef(onFrame);
  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!enabled || !connected) return;
    let handle = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      onFrameRef.current(connectedGamepads(), now - last);
      last = now;
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [enabled, connected]);
}
