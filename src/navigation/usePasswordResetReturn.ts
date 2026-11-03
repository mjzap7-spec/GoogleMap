import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';

/** Returning from email is a navigation event, not proof of a completed reset. */
export function usePasswordResetReturn(enabled: boolean, onReturn: () => void) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!enabled || !focused) return;
    let leftApp =
      Platform.OS === 'web'
        ? document.visibilityState === 'hidden'
        : AppState.currentState === 'background';
    let handled = false;
    const update = (away: boolean) => {
      if (away) leftApp = true;
      else if (leftApp && !handled) {
        handled = true;
        onReturn();
      }
    };
    if (Platform.OS === 'web') {
      const onVisibility = () => update(document.visibilityState === 'hidden');
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') update(true);
      else if (state === 'active') update(false);
    });
    return () => subscription.remove();
  }, [enabled, focused, onReturn]);
}
