export interface CachedProfile {
  fullName: string;
  birthday: string;
  location: string;
  avatarUrl: string | null;
}
export interface ProfileCache {
  read(userId: string): Promise<CachedProfile | null>;
  write(userId: string, profile: CachedProfile): Promise<void>;
  remove(userId: string): Promise<void>;
}
