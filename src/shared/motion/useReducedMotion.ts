import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// All animated components share one native listener and one in-flight preference read.
let reduced: boolean | null = null;
let generation = 0;
const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
const snapshot = () => reduced;
const serverSnapshot = () => null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const version = ++generation;
    let eventReceived = false;
    const update = (value: boolean) => {
      if (version !== generation || reduced === value) return;
      reduced = value;
      listeners.forEach((notify) => notify());
    };
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      eventReceived = true;
      update(value);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!eventReceived) update(value);
      })
      .catch(() => {
        if (!eventReceived) update(true);
      });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      generation++;
      subscription?.remove();
      subscription = undefined;
    }
  };
}
/** Default to still UI until the device preference is known; respect live changes. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
