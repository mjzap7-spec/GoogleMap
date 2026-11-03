import { onIdTokenChanged, type Auth, type User } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getFirebaseApp } from '../../../../config/firebase/client';
import type { AuthUser } from '../../models/auth';
import { AuthFailure } from '../../models/AuthFailure';
import { translateFirebaseError } from './errorMapping';
import type { ProfileCache } from '../../models/profileCache';
function mapUser(user: User): AuthUser {
  return {
    id: user.uid,
    email: user.email,
    hasPassword: user.providerData?.some((provider) => provider.providerId === 'password') ?? false,
    fullName: user.displayName ?? '',
    avatarUrl: user.photoURL,
    profileStatus: 'loading',
  };
}

export function observeFirebaseSession(
  auth: Auth,
  onChange: (user: AuthUser | null) => void,
  onError: (error: unknown) => void,
  cache?: ProfileCache,
) {
  let active = true;
  let stopProfile: (() => void) | undefined;
  let version = 0;
  let observed = false;
  let userId: string | undefined;
  try {
    const stopAuth = onIdTokenChanged(
      auth,
      (user) => {
        if (!active) return;
        // Token refresh does not need to restart an unchanged user's profile listener.
        if (observed && userId === user?.uid) return;
        observed = true;
        userId = user?.uid;
        const current = ++version;
        stopProfile?.();
        stopProfile = undefined;
        if (!active) return;
        if (!user) {
          onChange(null);
          return;
        }
        const base = mapUser(user);
        let latest = base;
        let serverResolved = false;
        let networkConfirmed = false;
        onChange(base);
        void cache
          ?.read(user.uid)
          .then((profile) => {
            if (!profile || !active || current !== version || serverResolved) return;
            latest = { ...base, ...profile, profileStatus: 'ready' };
            onChange(latest);
          })
          .catch(() => {});
        const timeout = setTimeout(() => {
          if (active && current === version && latest.profileStatus === 'loading') {
            latest = { ...latest, profileStatus: 'error' };
            onChange(latest);
            onError(new AuthFailure('profile-unavailable'));
          }
        }, 10000);
        const unsubscribeProfile = onSnapshot(
          doc(getFirestore(getFirebaseApp()), 'users', user.uid),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (!active || current !== version) return;
            if (!snapshot.metadata?.fromCache && !networkConfirmed) {
              networkConfirmed = true;
              if (process.env.NODE_ENV === 'development')
                console.info('[Firebase] Profile server connection ready');
            }
            const profile = snapshot.data();
            if (!profile && snapshot.metadata?.fromCache) return;
            serverResolved = true;
            clearTimeout(timeout);
            latest = {
              ...base,
              profileStatus: 'ready',
              fullName: typeof profile?.fullName === 'string' ? profile.fullName : base.fullName,
              birthday: typeof profile?.birthday === 'string' ? profile.birthday : undefined,
              location: typeof profile?.location === 'string' ? profile.location : undefined,
              avatarUrl:
                profile?.avatarUrl === null
                  ? null
                  : typeof profile?.avatarUrl === 'string'
                    ? profile.avatarUrl
                    : base.avatarUrl,
            };
            onChange(latest);
            if (!snapshot.metadata?.hasPendingWrites)
              void cache
                ?.write(user.uid, {
                  fullName: latest.fullName ?? '',
                  birthday: latest.birthday ?? '',
                  location: latest.location ?? '',
                  avatarUrl: latest.avatarUrl ?? null,
                })
                .catch(() => {});
          },
          () => {
            clearTimeout(timeout);
            if (active && current === version) {
              serverResolved = true;
              latest = {
                ...latest,
                profileStatus: latest.profileStatus === 'ready' ? 'ready' : 'error',
              };
              onChange(latest);
              onError(new AuthFailure('profile-unavailable'));
            }
          },
        );
        stopProfile = () => {
          clearTimeout(timeout);
          unsubscribeProfile();
        };
      },
      (error) => {
        if (active) onError(translateFirebaseError(error));
      },
    );
    return () => {
      active = false;
      version++;
      stopProfile?.();
      stopAuth();
    };
  } catch (error) {
    onError(translateFirebaseError(error));
    return () => {
      active = false;
      stopProfile?.();
    };
  }
}
