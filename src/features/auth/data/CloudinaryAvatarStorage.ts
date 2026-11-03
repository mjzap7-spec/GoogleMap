import { getCloudinaryConfig } from '../../../config/cloudinary';
import type { AvatarSelection } from '../models/auth';
import type { AvatarStorage, UploadedAvatar } from '../models/avatarStorage';
import { AuthFailure } from '../models/AuthFailure';

type Config = { cloudName: string; uploadPreset: string };

/** Direct unsigned image uploads. Restrictions must also be configured in the preset. */
export class CloudinaryAvatarStorage implements AvatarStorage {
  constructor(
    private config: Config = getCloudinaryConfig(),
    private request: typeof fetch = fetch,
  ) {}

  async upload(avatar: AvatarSelection): Promise<UploadedAvatar> {
    const { cloudName, uploadPreset } = this.config;
    if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !uploadPreset)
      throw new AuthFailure('cloudinary-not-configured');
    const padding = avatar.base64.endsWith('==') ? 2 : avatar.base64.endsWith('=') ? 1 : 0;
    const bytes = Math.floor(avatar.base64.length * 0.75) - padding;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(avatar.contentType) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(avatar.base64) ||
      bytes <= 0 ||
      bytes > 5 * 1024 * 1024
    )
      throw new AuthFailure('avatar-invalid');
    const body = new FormData();
    body.append('file', `data:${avatar.contentType};base64,${avatar.base64}`);
    body.append('upload_preset', uploadPreset);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await this.request(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body, signal: controller.signal },
      );
      if (response.status === 413) throw new AuthFailure('avatar-invalid');
      if (response.status === 420 || response.status === 429) throw new AuthFailure('rate-limited');
      if ([400, 401, 403, 404].includes(response.status))
        throw new AuthFailure('cloudinary-not-configured');
      if (!response.ok) throw new AuthFailure('avatar-upload');
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== 'object' ||
        !('secure_url' in data) ||
        typeof data.secure_url !== 'string'
      )
        throw new AuthFailure('avatar-upload');
      const url = new URL(data.secure_url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        !url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
        url.username ||
        url.password
      )
        throw new AuthFailure('avatar-upload');
      return {
        url: url.toString(),
        cleanupToken:
          'delete_token' in data && typeof data.delete_token === 'string'
            ? data.delete_token
            : undefined,
      };
    } catch (error) {
      if (error instanceof AuthFailure) throw error;
      throw new AuthFailure(controller.signal.aborted ? 'avatar-upload-timeout' : 'avatar-upload');
    } finally {
      clearTimeout(timeout);
    }
  }

  async discard(upload: UploadedAvatar): Promise<void> {
    // Unsigned clients can delete only a newly uploaded asset with its short-lived token.
    if (!upload.cleanupToken) return;
    const body = new FormData();
    body.append('token', upload.cleanupToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await this.request(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/delete_by_token`,
        { method: 'POST', body, signal: controller.signal },
      );
      if (!response.ok) throw new AuthFailure('avatar-upload');
    } finally {
      clearTimeout(timeout);
    }
  }
}
