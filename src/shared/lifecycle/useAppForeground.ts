import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

const listeners = new Set<() => void>();
let detach: (() => void) | undefined;
export function isAppForeground() {
  if (Platform.OS === 'web')
    return typeof document !== 'undefined' && document.visibilityState === 'visible';
  return AppState.currentState === 'active';
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const notify = () => listeners.forEach((current) => current());
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', notify);
      detach = () => document.removeEventListener('visibilitychange', notify);
    } else {
      const subscription = AppState.addEventListener('change', notify);
      detach = () => subscription.remove();
    }
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      detach?.();
      detach = undefined;
    }
  };
}
const serverSnapshot = () => false;
/** All consumers share one OS/browser listener. */
export function useAppForeground() {
  return useSyncExternalStore(subscribe, isAppForeground, serverSnapshot);
}
