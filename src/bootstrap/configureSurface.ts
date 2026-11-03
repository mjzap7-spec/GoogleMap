import * as SystemUI from 'expo-system-ui';
import { colors } from '../shared/theme/colors';

// A stable window surface prevents flashes while routes fade or unmount.
void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
  // app.json and the persistent React surface provide the same background as fallbacks.
});
