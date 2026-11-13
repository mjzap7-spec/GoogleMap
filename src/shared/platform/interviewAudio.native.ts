import { NativeModules, Platform } from 'react-native';

type AudioRoute = { start(): Promise<void>; stop(): void };
let activeSessions = 0;

export async function openInterviewAudio() {
  const route =
    Platform.OS === 'android'
      ? (NativeModules.InterviewAudio as AudioRoute | undefined)
      : undefined;
  if (!route) return () => {};
  activeSessions++;
  try {
    await route.start();
  } catch {
    // WebRTC can still use the system route if Android rejects the override.
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--activeSessions === 0) route.stop();
  };
}
