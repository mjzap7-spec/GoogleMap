import * as ImagePicker from 'expo-image-picker';
import type { AvatarPicker, AvatarSelection } from '../models/auth';
import { AuthFailure } from '../models/AuthFailure';
export class ExpoAvatarPicker implements AvatarPicker {
  async pick(): Promise<AvatarSelection | null> {
    try {
      // Modern system photo pickers need no broad library permission. Call directly for web user activation.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      const base64 = asset?.base64;
      if (!base64 || base64.length * 0.75 > 5 * 1024 * 1024)
        throw new AuthFailure('avatar-invalid');
      const contentType = base64.startsWith('/9j/')
        ? 'image/jpeg'
        : base64.startsWith('iVBORw0KGgo')
          ? 'image/png'
          : base64.startsWith('UklGR')
            ? 'image/webp'
            : null;
      if (!contentType) throw new AuthFailure('avatar-invalid');
      return { uri: asset.uri, base64, contentType };
    } catch (error) {
      throw error instanceof AuthFailure ? error : new AuthFailure('avatar-picker');
    }
  }
}
