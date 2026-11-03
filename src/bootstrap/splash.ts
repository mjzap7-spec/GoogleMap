import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

if (Platform.OS !== 'web') {
  SplashScreen.setOptions({ duration: 150, fade: true });
  void SplashScreen.preventAutoHideAsync().catch(() => {});
}
export function hideLaunchScreen() {
  if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => {});
}
