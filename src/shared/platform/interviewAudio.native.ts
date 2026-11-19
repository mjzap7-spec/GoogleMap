import { NativeModules, Platform } from 'react-native';

type AudioRoute = { start(): Promise<void>; stop(): void };
let activeSessions = 0;

/** Android can drop MODE_IN_COMMUNICATION while ringing without an active recorder. */
export async function refreshInterviewAudio() {
  if (!activeSessions || Platform.OS !== 'android') return;
  const route = NativeModules.InterviewAudio as AudioRoute | undefined;
  try {
    await route?.start();
    // Do not leave a refreshed route active if the call ended during the native request.
    if (!activeSessions) route?.stop();
  } catch {
    console.warn('[Interview] Could not refresh the Android call audio route.');
  }
}

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
