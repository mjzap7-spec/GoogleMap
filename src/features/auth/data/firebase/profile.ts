import type { Auth } from 'firebase/auth';
import { doc, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebaseApp } from '../../../../config/firebase/client';
import type { UserProfile } from '../../models/auth';
import type { AvatarStorage, UploadedAvatar } from '../../models/avatarStorage';
import { AuthFailure } from '../../models/AuthFailure';

export async function saveFirebaseProfile(
  auth: Auth,
  profile: UserProfile,
  avatarUrl: string | null,
  avatars: AvatarStorage,
) {
  const user = auth.currentUser;
  if (!user) throw new AuthFailure('invalid-credentials');
  const app = getFirebaseApp();
  let uploaded: UploadedAvatar | undefined;
  try {
    if (profile.avatar) {
      uploaded = await avatars.upload(profile.avatar);
      avatarUrl = uploaded.url;
    }
    if (auth.currentUser?.uid !== user.uid) throw new AuthFailure('invalid-credentials');
    const db = getFirestore(app);
    const path = doc(db, 'users', user.uid);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(path);
      transaction.set(path, {
        fullName: profile.fullName.trim(),
        birthday: profile.birthday,
        location: profile.location.trim(),
        avatarUrl,
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      });
    });
    return avatarUrl;
  } catch (error) {
    if (uploaded) await avatars.discard(uploaded).catch(() => {});
    throw error;
  }
}
