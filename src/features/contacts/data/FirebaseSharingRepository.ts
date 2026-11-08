import {
  collection,
  getDocs,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  where,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth } from '../../../config/firebase/client';
import type { AuthUser } from '../../auth/models/auth';
import type { TravelPoint } from '../../map/models/travel';
import type {
  SharingRepository,
  SharingPreferences,
  PrivateGroup,
  GroupSummary,
  DirectoryGroup,
  GroupLocation,
} from '../models/sharing';
import { ServerClock } from './ServerClock';
import { sharingAudience } from '../models/sharing';
export class FirebaseSharingRepository implements SharingRepository {
  private clock = new ServerClock(async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error('Please sign in again.');
    return user.getIdTokenResult(true);
  });
  private database(userId: string) {
    if (getFirebaseAuth().currentUser?.uid !== userId) throw new Error('Please sign in again.');
    return getFirestore(getFirebaseApp());
  }
  observePreferences(
    userId: string,
    next: (value: SharingPreferences) => void,
    error: (error: unknown) => void,
  ) {
    const db = this.database(userId);
    const ref = doc(db, 'users', userId, 'preferences', 'sharing');
    let repairing = false;
    let active = true;
    const stop = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
        const data = snapshot.data();
        const audience = sharingAudience(data);
        // A cache miss or an old public preference cannot authorize public GPS on startup.
        if (audience.nearby && snapshot.metadata.fromCache) return;
        next(audience);
        if (repairing || snapshot.metadata.fromCache || !data?.nearby || !data.groups) return;
        repairing = true;
        void runTransaction(db, async (tx) => {
          const current = (await tx.get(ref)).data();
          if (current?.nearby === true && current.groups === true) {
            tx.update(ref, { nearby: false });
            tx.delete(doc(db, 'sharedLocations', userId));
          }
        })
          .catch((reason) => {
            if (active) error(reason);
          })
          .finally(() => {
            repairing = false;
          });
      },
      error,
    );
    return () => {
      active = false;
      stop();
    };
  }
  async savePreferences(userId: string, preferences: SharingPreferences, stopTrips = false) {
    const value = sharingAudience(preferences);
    const db = this.database(userId);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', userId, 'preferences', 'sharing'), value);
    if (!value.nearby) batch.delete(doc(db, 'sharedLocations', userId));
    await batch.commit();
    if (!value.groups) {
      const groups = await getDocs(
        query(collection(db, 'privateGroups'), where('memberIds', 'array-contains', userId)),
      );
      for (const group of groups.docs.filter((group) => group.data().joinedIds.includes(userId))) {
        const ref = doc(db, 'privateGroups', group.id, 'live', userId);
        await runTransaction(db, async (transaction) => {
          const preferences = await transaction.get(
            doc(db, 'users', userId, 'preferences', 'sharing'),
          );
          if (preferences.data()?.groups === true) return;
          const location = await transaction.get(ref);
          if (location.exists() && (stopTrips || location.data().trip !== true))
            transaction.delete(ref);
        });
      }
    }
  }
  observeGroups(
    userId: string,
    next: (groups: PrivateGroup[]) => void,
    error: (error: unknown) => void,
  ) {
    return onSnapshot(
      query(
        collection(this.database(userId), 'privateGroups'),
        where('memberIds', 'array-contains', userId),
      ),
      (snapshot) => {
        if (getFirebaseAuth().currentUser?.uid !== userId) return;
        next(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as PrivateGroup)
            .sort(
              (first, second) =>
                first.name.localeCompare(second.name) || first.id.localeCompare(second.id),
            ),
        );
      },
      error,
    );
  }
  async createGroup(userId: string, name: string) {
    const db = this.database(userId);
    const ref = doc(collection(db, 'privateGroups'));
    await runTransaction(db, async (tx) => {
      const creator = await tx.get(doc(db, 'users', userId));
      tx.set(doc(ref, 'members', userId), {
        name: creator.data()?.fullName,
        avatarUrl: creator.data()?.avatarUrl ?? null,
      });
      tx.set(doc(db, 'groupDirectory', ref.id), {
        name: name.trim(),
        active: true,
        creatorName: creator.data()?.fullName,
        createdAt: serverTimestamp(),
        memberCount: 1,
      });
      tx.set(ref, {
        name: name.trim(),
        ownerId: userId,
        memberIds: [userId],
        joinedIds: [userId],
      });
    });
    return ref.id;
  }
  observeDirectory(
    userId: string,
    next: (groups: DirectoryGroup[]) => void,
    error: (error: unknown) => void,
  ) {
    return onSnapshot(
      query(collection(this.database(userId), 'groupDirectory'), where('active', '==', true)),
      (snap) => {
        if (getFirebaseAuth().currentUser?.uid === userId)
          next(
            snap.docs
              .map((d): DirectoryGroup => {
                const data = d.data({ serverTimestamps: 'estimate' });
                return {
                  id: d.id,
                  name: data.name,
                  discoverable: true,
                  creatorName: data.creatorName ?? undefined,
                  createdAt: data.createdAt?.toMillis(),
                  memberCount: data.memberCount,
                };
              })
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
      },
      error,
    );
  }
  async invite(userId: string, group: PrivateGroup, peerId: string) {
    await updateDoc(doc(this.database(userId), 'privateGroups', group.id), {
      memberIds: arrayUnion(peerId),
    });
  }
  async join(user: AuthUser, group: GroupSummary) {
    const userId = user.id;
    const db = this.database(userId);
    const batch = writeBatch(db);
    batch.update(doc(db, 'privateGroups', group.id), {
      memberIds: arrayUnion(userId),
      joinedIds: arrayUnion(userId),
    });
    batch.update(doc(db, 'groupDirectory', group.id), { memberCount: increment(1) });
    batch.set(doc(db, 'privateGroups', group.id, 'members', userId), {
      name: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
    });
    batch.delete(doc(db, 'users', userId, 'formerGroups', group.id));
    await batch.commit();
  }
  async leave(userId: string, group: PrivateGroup) {
    const db = this.database(userId);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'privateGroups', group.id, 'live', userId));
    batch.delete(doc(db, 'privateGroups', group.id, 'members', userId));
    if (group.ownerId === userId) {
      batch.delete(doc(db, 'privateGroups', group.id));
      batch.set(doc(db, 'groupDirectory', group.id), { active: false });
    } else {
      if (group.joinedIds.includes(userId)) {
        batch.update(doc(db, 'groupDirectory', group.id), { memberCount: increment(-1) });
        batch.set(doc(db, 'users', userId, 'formerGroups', group.id), { name: group.name });
      }
      batch.update(doc(db, 'privateGroups', group.id), {
        memberIds: arrayRemove(userId),
        joinedIds: arrayRemove(userId),
      });
    }
    await batch.commit();
  }
  observeLocations(
    userId: string,
    groupId: string,
    next: (locations: GroupLocation[]) => void,
    error: (error: unknown) => void,
  ) {
    let active = true;
    let emitCurrent = () => {};
    void this.clock
      .synchronize()
      .then(() => {
        if (active) emitCurrent();
      })
      .catch(error);
    const stop = onSnapshot(
      query(collection(this.database(userId), 'privateGroups', groupId, 'live'), limit(10)),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
        if (snapshot.metadata.fromCache) {
          emitCurrent = () => next([]);
          emitCurrent();
          return;
        }
        emitCurrent = () => {
          if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
          next(
            snapshot.docs
              .filter(
                (item) =>
                  !item.metadata.hasPendingWrites &&
                  typeof item.data().nickname === 'string' &&
                  item.data().updatedAt?.toMillis &&
                  Number.isFinite(item.data().latitude) &&
                  Number.isFinite(item.data().longitude),
              )
              .map((item) => {
                const data = item.data();
                return {
                  id: item.id,
                  groupId,
                  nickname: data.nickname,
                  avatarUrl:
                    typeof data.avatarUrl === 'string' && data.avatarUrl.startsWith('https://')
                      ? data.avatarUrl
                      : null,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  trip: data.trip === true,
                  trail: parseSharedTrail(data.trail),
                  expiresAt: this.clock.localDeadline((data.updatedAt?.toMillis() ?? 0) + 120000),
                  updatedAt: this.clock.localDeadline(data.updatedAt.toMillis()),
                } as GroupLocation;
              }),
          );
        };
        emitCurrent();
      },
      (reason) => {
        emitCurrent = () => {};
        error(reason);
      },
    );
    return () => {
      active = false;
      stop();
    };
  }
  async publish(
    user: AuthUser,
    groupId: string,
    point: TravelPoint | null,
    trail: readonly (readonly TravelPoint[])[],
    trip: boolean,
  ) {
    const ref = doc(this.database(user.id), 'privateGroups', groupId, 'live', user.id);
    if (!point) {
      await deleteDoc(ref);
      return;
    }
    await setDoc(ref, {
      nickname: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      latitude: point.latitude,
      longitude: point.longitude,
      trip,
      trail: JSON.stringify(trip ? trail : []),
      updatedAt: serverTimestamp(),
    });
  }
}

function parseSharedTrail(value: unknown): TravelPoint[][] {
  if (typeof value !== 'string') return [];
  try {
    const trail = JSON.parse(value);
    let count = 0;
    if (
      !Array.isArray(trail) ||
      !trail.every((segment) => {
        if (!Array.isArray(segment)) return false;
        count += segment.length;
        return (
          count <= 500 &&
          segment.every(
            (point) =>
              point &&
              Number.isFinite(point.latitude) &&
              Math.abs(point.latitude) <= 90 &&
              Number.isFinite(point.longitude) &&
              Math.abs(point.longitude) <= 180 &&
              Number.isFinite(point.timestamp),
          )
        );
      })
    )
      return [];
    return trail;
  } catch {
    return [];
  }
}
