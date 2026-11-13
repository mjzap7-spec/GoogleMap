import { PermissionsAndroid, Platform } from 'react-native';

let pendingRequests = 0;
export const isRequestingInterviewPermissions = () => pendingRequests > 0;

export async function requestInterviewPermissions(video: boolean) {
  if (Platform.OS !== 'android') return;
  const { RECORD_AUDIO, CAMERA } = PermissionsAndroid.PERMISSIONS;
  const permissions = video ? [RECORD_AUDIO, CAMERA] : [RECORD_AUDIO];
  pendingRequests++;
  try {
    const grants = await PermissionsAndroid.requestMultiple(permissions);
    if (
      permissions.some((permission) => grants[permission] !== PermissionsAndroid.RESULTS.GRANTED)
    ) {
      const error = Error('Interview permission denied');
      error.name = 'NotAllowedError';
      throw error;
    }
  } finally {
    pendingRequests--;
  }
}
