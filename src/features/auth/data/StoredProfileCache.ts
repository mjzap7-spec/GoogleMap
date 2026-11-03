import type { CachedProfile, ProfileCache } from '../models/profileCache';
import { validateProfile } from '../models/validation';
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const maxAge = 7 * 24 * 60 * 60 * 1000;
/** A display-data cache only; Firebase remains the authentication authority. */
export class StoredProfileCache implements ProfileCache {
  constructor(
    private storage: Storage,
    private now = Date.now,
  ) {}
  private key(userId: string) {
    return `google-map:profile:v1:${userId}`;
  }
  async read(userId: string): Promise<CachedProfile | null> {
    try {
      const raw = await this.storage.getItem(this.key(userId));
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (
        typeof value.savedAt !== 'number' ||
        this.now() - value.savedAt > maxAge ||
        value.savedAt > this.now()
      )
        return null;
      const profile = value.profile;
      if (
        !profile ||
        typeof profile.fullName !== 'string' ||
        typeof profile.birthday !== 'string' ||
        typeof profile.location !== 'string' ||
        (profile.avatarUrl !== null && typeof profile.avatarUrl !== 'string')
      )
        return null;
      if (validateProfile({ ...profile, avatar: null })) return null;
      return {
        fullName: profile.fullName,
        birthday: profile.birthday,
        location: profile.location,
        avatarUrl: profile.avatarUrl,
      };
    } catch {
      return null;
    }
  }
  async write(userId: string, profile: CachedProfile) {
    if (validateProfile({ ...profile, avatar: null })) {
      await this.remove(userId);
      return;
    }
    await this.storage.setItem(this.key(userId), JSON.stringify({ savedAt: this.now(), profile }));
  }
  async remove(userId: string) {
    await this.storage.removeItem(this.key(userId));
  }
}
