import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  type DocumentData,
} from 'firebase/firestore';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { getFirebaseApp, getFirebaseAuth } from '../../../config/firebase/client';
import type { AuthUser } from '../../auth/models/auth';
import type { TravelPoint } from '../../map/models/travel';
import { ServerClock } from './ServerClock';
import {
  ContactFailure,
  normalizeContactEmail,
  type Contact,
  type ContactEvent,
  type ContactRequest,
  type ContactRepository,
  type SharedMapUser,
} from '../models/contact';
function failure(error: unknown, nearby = false) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';
  return error instanceof ContactFailure
    ? error
    : new ContactFailure(
        code === 'permission-denied'
          ? nearby
            ? 'Nearby access was denied. Tap Retry.'
            : 'Publish the updated Firestore rules, or ask this user to accept your request and share their location.'
          : code === 'failed-precondition'
            ? /initializeFirestore|settings can no longer be changed/i.test(message)
              ? 'Reload the app to apply the updated Firebase connection settings.'
              : /index/i.test(message)
                ? 'Publish the Firestore indexes from firestore.indexes.json and retry.'
                : 'Cloud Firestore is not ready. Reload the app and try again.'
            : 'Could not access contacts. Check your connection and try again.',
      );
}
function shared(
  id: string,
  data: DocumentData | undefined,
  clock: ServerClock,
): SharedMapUser | null {
  if (
    !data ||
    typeof data.nickname !== 'string' ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number' ||
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude) ||
    Math.abs(data.latitude) > 90 ||
    Math.abs(data.longitude) > 180 ||
    typeof data.bucket !== 'number' ||
    data.bucket < Math.floor(clock.now() / 120000) - 1 ||
    data.bucket > Math.floor(clock.now() / 120000)
  )
    return null;
  return {
    id,
    nickname: data.nickname,
    avatarUrl:
      typeof data.avatarUrl === 'string' && data.avatarUrl.startsWith('https://')
        ? data.avatarUrl
        : null,
    latitude: data.latitude,
    longitude: data.longitude,
    expiresAt: clock.localDeadline((data.bucket + 2) * 120000),
    updatedAt:
      typeof data.updatedAt?.toMillis === 'function'
        ? clock.localDeadline(data.updatedAt.toMillis())
        : undefined,
  };
}
export class FirebaseContactRepository implements ContactRepository {
  constructor(
    private clock = new ServerClock(async () => {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new ContactFailure('Your session changed. Reopen Contacts and try again.');
      return user.getIdTokenResult(true);
    }),
  ) {}
  private database() {
    return getFirestore(getFirebaseApp());
  }
  private check(userId: string) {
    if (getFirebaseAuth().currentUser?.uid !== userId)
      throw new ContactFailure('Your session changed. Reopen Contacts and try again.');
  }
  private collection(userId: string) {
    this.check(userId);
    return collection(this.database(), 'users', userId, 'contacts');
  }
  observe(userId: string, next: (contacts: Contact[]) => void, error: (error: unknown) => void) {
    let active = true;
    let previousContacts: string | undefined;
    type ProfileSummary = Pick<Contact, 'avatarUrl' | 'fullName' | 'birthday' | 'profileLocation'>;
    const profiles = new Map<string, ProfileSummary>();
    const fetching = new Map<string, Promise<void>>();
    let currentRows: Contact[] = [];
    let confirmed = new Map<string, Contact>();
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const emit = () => {
      if (active && getFirebaseAuth().currentUser?.uid === userId)
        next(
          currentRows.map((row) => (row.peerId ? { ...row, ...profiles.get(row.peerId) } : row)),
        );
    };
    try {
      const stop = onSnapshot(
        this.collection(userId),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
          const contacts = snapshot.docs
            .flatMap((item) => {
              if (item.metadata.hasPendingWrites) {
                const previous = confirmed.get(item.id);
                return previous ? [previous] : [];
              }
              const data = item.data();
              return typeof data.name === 'string'
                ? [
                    {
                      id: item.id,
                      name: data.name,
                      ...(typeof data.peerId === 'string'
                        ? {
                            peerId: data.peerId,
                            ...(typeof data.requestId === 'string'
                              ? { requestId: data.requestId }
                              : {}),
                          }
                        : {}),
                    },
                  ]
                : [];
            })
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
          // Cache/server metadata changes do not change a contact's identity or nickname.
          // Keep enriched avatars/details visible and avoid fetching every profile again.
          const signature = JSON.stringify(contacts);
          if (signature === previousContacts) return;
          previousContacts = signature;
          currentRows = contacts;
          confirmed = new Map(contacts.map((contact) => [contact.id, contact]));
          const ids = new Set(contacts.flatMap((c) => (c.peerId ? [c.peerId] : [])));
          for (const id of profiles.keys()) if (!ids.has(id)) profiles.delete(id);
          for (const id of fetching.keys()) if (!ids.has(id)) fetching.delete(id);
          emit();
          for (const id of ids) {
            if (profiles.has(id) || fetching.has(id)) continue;
            const request: Promise<void> = getDoc(doc(this.database(), 'users', id))
              .then((snapshot) => {
                if (!active || fetching.get(id) !== request || !snapshot.exists()) return;
                const p = snapshot.data();
                profiles.set(id, {
                  fullName: p.fullName,
                  avatarUrl: p.avatarUrl ?? null,
                  birthday: p.birthday,
                  profileLocation: p.location,
                });
                if (!scheduled)
                  scheduled = setTimeout(() => {
                    scheduled = undefined;
                    emit();
                  }, 16);
              })
              .catch(() => {})
              .finally(() => {
                if (fetching.get(id) === request) fetching.delete(id);
              });
            fetching.set(id, request);
          }
        },
        (reason) => error(failure(reason)),
      );
      return () => {
        active = false;
        clearTimeout(scheduled);
        stop();
      };
    } catch (reason) {
      error(failure(reason));
      return () => {
        active = false;
      };
    }
  }
  async add(userId: string, name: string): Promise<Contact> {
    const normalized = name.trim();
    if (!normalized || normalized.length > 100)
      throw new ContactFailure('Enter a contact name (up to 100 characters).');
    try {
      const reference = doc(this.collection(userId));
      await setDoc(reference, { name: normalized, createdAt: serverTimestamp() });
      return { id: reference.id, name: normalized };
    } catch (error) {
      throw failure(error);
    }
  }
  async registerSelf(user: AuthUser) {
    this.check(user.id);
    if (!user.email || !user.fullName) return;
    try {
      await setDoc(doc(this.database(), 'contactDirectory', normalizeContactEmail(user.email)), {
        uid: user.id,
        email: normalizeContactEmail(user.email),
        fullName: user.fullName,
        avatarUrl: user.avatarUrl ?? null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw failure(error);
    }
  }
  observeRequests(
    userId: string,
    next: (requests: ContactRequest[]) => void,
    error: (error: unknown) => void,
  ) {
    this.check(userId);
    return onSnapshot(
      query(
        collection(this.database(), 'contactRequests'),
        where('toId', '==', userId),
        where('status', '==', 'pending'),
        limit(100),
      ),
      (snapshot) => {
        if (getFirebaseAuth().currentUser?.uid !== userId) return;
        next(
          snapshot.docs
            .filter((item) => !item.metadata.hasPendingWrites)
            .map((item) => {
              const d = item.data();
              return {
                id: item.id,
                fromId: d.fromId,
                version: Math.floor(d.updatedAt.toMillis()),
                acknowledged: d.ackFor === Math.floor(d.updatedAt.toMillis()),
                fromName: d.fromName,
                fromEmail: d.fromEmail,
              };
            }),
        );
      },
      (reason) => error(failure(reason)),
    );
  }
  async sendRequest(userId: string, email: string) {
    this.check(userId);
    const normalized = normalizeContactEmail(email);
    const auth = getFirebaseAuth().currentUser!;
    if (normalized === auth.email?.toLowerCase())
      throw new ContactFailure('You cannot add yourself.');
    try {
      const db = this.database();
      const directory = await getDoc(doc(db, 'contactDirectory', normalized));
      this.check(userId);
      if (!directory.exists())
        throw new ContactFailure(
          'No matching user was found. Ask them to open the updated app once.',
        );
      const peerId = directory.data().uid;
      if (typeof peerId !== 'string' || peerId === userId)
        throw new ContactFailure('Choose another user.');
      await this.createRequest(userId, peerId, normalized);
    } catch (error) {
      throw failure(error);
    }
  }
  async sendRequestToUser(userId: string, peerId: string, groupId?: string) {
    this.check(userId);
    if (!peerId || peerId === userId || peerId.includes('/'))
      throw new ContactFailure('Choose another user.');
    try {
      if (groupId) {
        if (groupId.includes('/')) throw new ContactFailure('Choose another user.');
        const group = await getDoc(doc(this.database(), 'privateGroups', groupId));
        if (!group.data()?.joinedIds.includes(userId) || !group.data()?.joinedIds.includes(peerId))
          throw new ContactFailure('Choose another user.');
      } else {
        const location = await this.sharedLocation(userId, peerId);
        if (!location) throw new ContactFailure('This user is not sharing a recent location.');
      }
      await this.createRequest(userId, peerId, '', groupId);
    } catch (error) {
      throw failure(error);
    }
  }
  private async createRequest(userId: string, peerId: string, toEmail: string, groupId?: string) {
    this.check(userId);
    const db = this.database();
    const auth = getFirebaseAuth().currentUser!;
    const ownProfile = await getDoc(doc(db, 'users', userId));
    this.check(userId);
    const reference = doc(db, 'contactRequests', userId + '_' + peerId);
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(reference);
      const reverse = await transaction.get(doc(db, 'contactRequests', peerId + '_' + userId));
      const contact = await transaction.get(doc(db, 'users', userId, 'contacts', peerId));
      this.check(userId);
      if (contact.exists()) throw new ContactFailure('This user is already in your contacts.');
      if (current.exists() && current.data().status === 'pending')
        throw new ContactFailure('A request is already waiting for their reply.');
      if (reverse.exists() && reverse.data().status === 'pending')
        throw new ContactFailure(
          'This user has already requested you. Open Notifications to reply.',
        );
      if (current.exists() && Date.now() - (current.data().updatedAt?.toMillis?.() ?? 0) < 60000)
        throw new ContactFailure('Wait a minute before sending another request.');
      transaction.set(reference, {
        ...(groupId ? { groupId } : {}),
        fromId: userId,
        toId: peerId,
        fromName: ownProfile.data()?.fullName ?? auth.displayName ?? 'User',
        fromEmail: auth.email!.toLowerCase(),
        toEmail,
        status: 'pending',
        createdAt: current.exists() ? current.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }
  observeEvents(
    userId: string,
    next: (events: ContactEvent[]) => void,
    error: (error: unknown) => void,
  ) {
    this.check(userId);
    return onSnapshot(
      query(
        collection(this.database(), 'users', userId, 'contactEvents'),
        orderBy('createdAt', 'asc'),
        limit(100),
      ),
      (snapshot) => {
        if (getFirebaseAuth().currentUser?.uid !== userId) return;
        next(
          snapshot.docs
            .filter((item) => !item.metadata.hasPendingWrites)
            .flatMap((item) => {
              const data = item.data();
              return typeof data.name === 'string' &&
                (data.kind === 'accepted' || data.kind === 'declined' || data.kind === 'removed')
                ? [
                    {
                      id: item.id,
                      name: data.name,
                      actorId: data.actorId,
                      version: Math.floor(data.createdAt.toMillis()),
                      acknowledged: data.ackFor === Math.floor(data.createdAt.toMillis()),
                      kind: data.kind,
                    } as ContactEvent,
                  ]
                : [];
            }),
        );
      },
      (reason) => error(failure(reason)),
    );
  }
  async dismissEvent(userId: string, id: string) {
    this.check(userId);
    try {
      await deleteDoc(doc(this.database(), 'users', userId, 'contactEvents', id));
    } catch (error) {
      throw failure(error);
    }
  }
  async acknowledge(
    uid: string,
    requests: readonly ContactRequest[],
    events: readonly ContactEvent[],
  ) {
    this.check(uid);
    const db = this.database();
    await Promise.all([
      ...requests
        .filter((item) => !item.acknowledged && item.version !== undefined)
        .map((item) => updateDoc(doc(db, 'contactRequests', item.id), { ackFor: item.version })),
      ...events
        .filter((item) => !item.acknowledged && item.version !== undefined)
        .map((item) =>
          updateDoc(doc(db, 'users', uid, 'contactEvents', item.id), { ackFor: item.version }),
        ),
    ]);
  }
  async respond(userId: string, request: ContactRequest, accept: boolean) {
    this.check(userId);
    try {
      const db = this.database();
      const profile = await getDoc(doc(db, 'users', userId));
      this.check(userId);
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'contactRequests', request.id);
        const snapshot = await transaction.get(reference);
        this.check(userId);
        if (
          !snapshot.exists() ||
          snapshot.data().toId !== userId ||
          snapshot.data().status !== 'pending'
        )
          throw new ContactFailure('This request has already been handled.');
        const fromId = snapshot.data().fromId;
        transaction.update(reference, {
          status: accept ? 'accepted' : 'declined',
          ...(accept && snapshot.data().toEmail === ''
            ? { toEmail: getFirebaseAuth().currentUser!.email!.toLowerCase() }
            : {}),
          updatedAt: serverTimestamp(),
        });
        transaction.set(doc(collection(db, 'users', fromId, 'contactEvents')), {
          kind: accept ? 'accepted' : 'declined',
          actorId: userId,
          name: profile.data()?.fullName ?? 'User',
          requestId: request.id,
          createdAt: serverTimestamp(),
        });
        if (accept) {
          transaction.set(doc(db, 'users', userId, 'contacts', fromId), {
            peerId: fromId,
            name: snapshot.data().fromName,
            requestId: request.id,
            createdAt: serverTimestamp(),
          });
          transaction.set(doc(db, 'users', fromId, 'contacts', userId), {
            peerId: userId,
            name: profile.data()?.fullName ?? 'User',
            requestId: request.id,
            createdAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      throw failure(error);
    }
  }
  observeDetails(
    userId: string,
    contact: Contact,
    next: (value: Contact) => void,
    error: (reason: unknown) => void,
  ) {
    this.check(userId);
    if (!contact.peerId) return () => {};
    const db = this.database();
    let active = true,
      details = contact;
    const publish = (fields: Partial<Contact>) => {
      if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
      details = { ...details, ...fields };
      next(details);
    };
    const fail = (reason: unknown) => {
      if (active && getFirebaseAuth().currentUser?.uid === userId) error(failure(reason));
    };
    const stopProfile = onSnapshot(
      doc(db, 'users', contact.peerId),
      (snapshot) => {
        if (!snapshot.exists() && snapshot.metadata.fromCache) return;
        const p = snapshot.data();
        publish({
          fullName: p?.fullName,
          avatarUrl: p?.avatarUrl ?? null,
          birthday: p?.birthday,
          profileLocation: p?.location,
        });
      },
      fail,
    );
    const stopEmail = contact.requestId
      ? onSnapshot(
          doc(db, 'contactRequests', contact.requestId),
          (snapshot) => {
            if (!snapshot.exists() && snapshot.metadata.fromCache) return;
            const data = snapshot.data();
            const email = data?.fromId === contact.peerId ? data?.fromEmail : data?.toEmail;
            publish({ email: typeof email === 'string' ? email : '' });
          },
          fail,
        )
      : undefined;
    return () => {
      active = false;
      stopProfile();
      stopEmail?.();
    };
  }
  async rename(userId: string, contact: Contact, nickname: string) {
    this.check(userId);
    const name = nickname.trim();
    if (!name || name.length > 100)
      throw new ContactFailure('Enter a nickname (up to 100 characters).');
    try {
      await updateDoc(doc(this.database(), 'users', userId, 'contacts', contact.id), { name });
    } catch (error) {
      throw failure(error);
    }
  }
  async remove(userId: string, contact: Contact) {
    this.check(userId);
    try {
      const db = this.database();
      if (!contact.peerId) {
        await deleteDoc(doc(db, 'users', userId, 'contacts', contact.id));
        return;
      }
      const peerId = contact.peerId;
      const profile = await getDoc(doc(db, 'users', userId));
      this.check(userId);
      await runTransaction(db, async (transaction) => {
        const own = doc(db, 'users', userId, 'contacts', contact.id);
        const existing = await transaction.get(own);
        this.check(userId);
        if (!existing.exists()) return;
        transaction.set(doc(collection(db, 'users', peerId, 'contactEvents')), {
          kind: 'removed',
          actorId: userId,
          name: profile.data()?.fullName ?? 'User',
          requestId: existing.data().requestId,
          createdAt: serverTimestamp(),
        });
        transaction.delete(own);
        transaction.delete(doc(db, 'users', peerId, 'contacts', userId));
      });
    } catch (error) {
      throw failure(error);
    }
  }
  async publishPresence(userId: string, point: TravelPoint | null) {
    this.check(userId);
    const db = this.database();
    const ref = doc(db, 'sharedLocations', userId);
    try {
      if (!point) {
        await deleteDoc(ref);
        return;
      }
      await this.clock.synchronize(true);
      this.check(userId);
      const profile = await getDoc(doc(db, 'users', userId));
      this.check(userId);
      const p = profile.data();
      if (!p?.fullName) throw new ContactFailure('Complete your profile before sharing.');
      await setDoc(ref, {
        nickname: p.fullName,
        avatarUrl: p.avatarUrl ?? null,
        latitude: point.latitude,
        longitude: point.longitude,
        geohash: geohashForLocation([point.latitude, point.longitude]),
        bucket: Math.floor(this.clock.now() / 120000),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw failure(error, true);
    }
  }
  observeNearby(
    userId: string,
    point: TravelPoint,
    next: (users: SharedMapUser[]) => void,
    error: (error: unknown) => void,
  ) {
    this.check(userId);
    let active = true;
    let stops: (() => void)[] = [];
    let currentBucket = -1;
    let revision = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 2000;
    const bounds = geohashQueryBounds([point.latitude, point.longitude], 1000);
    const rows = new Map<number, { id: string; data: DocumentData }[]>();
    const emit = () => {
      if (
        !active ||
        retry ||
        rows.size !== bounds.length ||
        getFirebaseAuth().currentUser?.uid !== userId
      )
        return;
      const users = new Map<string, { user: SharedMapUser; distance: number }>();
      for (const list of rows.values())
        for (const row of list) {
          const user = shared(row.id, row.data, this.clock);
          if (!user || user.id === userId || user.expiresAt <= Date.now()) continue;
          const distance = distanceBetween(
            [point.latitude, point.longitude],
            [user.latitude, user.longitude],
          );
          if (distance <= 1) users.set(user.id, { user, distance });
        }
      next(
        [...users.values()]
          .sort((a, b) => a.distance - b.distance || a.user.id.localeCompare(b.user.id))
          .slice(0, 400)
          .map((entry) => entry.user),
      );
    };
    const subscribe = () => {
      const bucket = Math.floor(this.clock.now() / 120000);
      if (currentBucket === bucket) return;
      currentBucket = bucket;
      const subscription = ++revision;
      clearTimeout(retry);
      retry = undefined;
      stops.forEach((stop) => stop());
      rows.clear();
      stops = bounds.map(([start, end], index) =>
        onSnapshot(
          query(
            collection(this.database(), 'sharedLocations'),
            where('bucket', 'in', [bucket - 1, bucket]),
            orderBy('geohash'),
            startAt(start),
            endAt(end),
            limit(200),
          ),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (!active || subscription !== revision) return;
            rows.set(
              index,
              snapshot.metadata.fromCache
                ? []
                : snapshot.docs.map((item) => ({ id: item.id, data: item.data() })),
            );
            if (rows.size === bounds.length) retryDelay = 2000;
            emit();
          },
          (reason) => {
            if (!active || subscription !== revision || retry) return;
            // Firestore does not restart a listener after a terminal error.
            // Reconnect even when the user and the lease bucket have not changed.
            failed(reason);
          },
        ),
      );
    };
    const failed = (reason: unknown) => {
      if (!active || retry) return;
      rows.clear();
      next([]);
      retry = setTimeout(() => {
        retry = undefined;
        if (!active) return;
        currentBucket = -1;
        void refresh(true);
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
      error(failure(reason, true));
    };
    const refresh = async (force = false) => {
      try {
        await this.clock.synchronize(force);
        if (!active || getFirebaseAuth().currentUser?.uid !== userId) return;
        subscribe();
        emit();
      } catch (reason) {
        failed(reason);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh(true);
    }, 30000);
    return () => {
      active = false;
      revision++;
      clearTimeout(retry);
      clearInterval(timer);
      stops.forEach((stop) => stop());
    };
  }
  async sharedLocation(userId: string, peerId: string) {
    this.check(userId);
    try {
      await this.clock.synchronize();
      this.check(userId);
      const snapshot = await getDocFromServer(doc(this.database(), 'sharedLocations', peerId));
      this.check(userId);
      return shared(peerId, snapshot.data(), this.clock);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'permission-denied'
      )
        return null;
      throw failure(error);
    }
  }
  observeSharedLocation(
    userId: string,
    peerId: string,
    next: (location: SharedMapUser | null) => void,
  ) {
    this.check(userId);
    let confirmed = false;
    return onSnapshot(
      doc(this.database(), 'sharedLocations', peerId),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (getFirebaseAuth().currentUser?.uid !== userId) return;
        if (snapshot.metadata.fromCache) {
          if (confirmed) next(null);
          return;
        }
        confirmed = true;
        next(shared(peerId, snapshot.data(), this.clock));
      },
      () => next(null),
    );
  }
}
