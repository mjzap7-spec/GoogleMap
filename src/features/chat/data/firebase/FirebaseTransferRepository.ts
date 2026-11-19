import {
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth } from '../../../../config/firebase/client';
import { ServerClock } from '../../../contacts/data/firebase/ServerClock';
import { queueChatMessage } from './FirebaseChatRepository';
import {
  DIRECT_FILE_PREFIX,
  type DirectTransfer,
  type TransferRepository,
} from '../../models/directTransfer';

/** Authenticated signaling only. File bytes never enter Firestore or a TURN relay. */
export class FirebaseTransferRepository implements TransferRepository {
  private clock = new ServerClock(async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw Error('Please sign in again.');
    return user.getIdTokenResult(true);
  });
  private db(uid: string) {
    if (getFirebaseAuth().currentUser?.uid !== uid) throw Error('Please sign in again.');
    return getFirestore(getFirebaseApp());
  }
  create: TransferRepository['create'] = async (uid, peer, info, offer) => {
    if ('senderName' in peer) throw Error('Choose a private chat to send a file directly.');
    await this.clock.synchronize();
    const db = this.db(uid),
      ref = doc(collection(db, 'fileTransfers'));
    const value = {
      ...info,
      offer,
      fromId: uid,
      toId: 'peerId' in peer ? peer.peerId : peer.memberId,
      kind: 'requestId' in peer ? 'contact' : 'group',
      contextId: 'requestId' in peer ? peer.requestId : peer.groupId,
      status: 'offered' as const,
      expiresAt: Timestamp.fromMillis(this.clock.now() + 30 * 60_000),
    };
    const batch = writeBatch(db);
    batch.set(ref, { ...value, createdAt: serverTimestamp() });
    queueChatMessage(batch, db, uid, peer, DIRECT_FILE_PREFIX + ref.id);
    await batch.commit();
    return {
      ...value,
      id: ref.id,
      expiresAt: this.clock.localDeadline(value.expiresAt.toMillis()),
    };
  };
  watch: TransferRepository['watch'] = (uid, id, next, fail) => {
    let stopped = false;
    const unsubs: (() => void)[] = [];
    let contextKey = '';
    const denied = () => {
      if (!stopped) {
        stopped = true;
        unsubs.forEach((fn) => fn());
        fail();
      }
    };
    unsubs.push(
      onSnapshot(
        doc(this.db(uid), 'fileTransfers', id),
        (snap) => {
          const data = snap.data();
          if (!data || !(data.expiresAt instanceof Timestamp)) {
            next(undefined);
            return;
          }
          const key = data.kind + ':' + data.contextId;
          if (contextKey !== key) {
            contextKey = key;
            if (data.kind === 'contact') {
              unsubs.push(
                onSnapshot(
                  doc(this.db(uid), 'contactRequests', data.contextId),
                  (context) => {
                    if (context.data()?.status !== 'accepted') denied();
                  },
                  denied,
                ),
              );
              const other = uid === data.fromId ? data.toId : data.fromId;
              unsubs.push(
                onSnapshot(
                  doc(this.db(uid), 'users', uid, 'contacts', other),
                  (contact) => {
                    if (contact.data()?.requestId !== data.contextId) denied();
                  },
                  denied,
                ),
              );
            } else {
              unsubs.push(
                onSnapshot(
                  doc(this.db(uid), 'privateGroups', data.contextId),
                  (context) => {
                    const joined = context.data()?.joinedIds;
                    if (
                      !Array.isArray(joined) ||
                      !joined.includes(data.fromId) ||
                      !joined.includes(data.toId)
                    )
                      denied();
                  },
                  denied,
                ),
              );
            }
          }
          if (!stopped)
            next({
              ...data,
              id,
              expiresAt: this.clock.localDeadline(data.expiresAt.toMillis()),
            } as DirectTransfer);
        },
        denied,
      ),
    );
    return () => {
      stopped = true;
      unsubs.forEach((fn) => fn());
    };
  };
  accept: TransferRepository['accept'] = async (uid, id, answer) => {
    const db = this.db(uid),
      ref = doc(db, 'fileTransfers', id);
    await runTransaction(db, async (tx) => {
      const value = (await tx.get(ref)).data();
      if (value?.toId !== uid || value.status !== 'offered')
        throw Error('File invitation is no longer available.');
      tx.update(ref, { status: 'accepted', answer });
    });
  };
  finish: TransferRepository['finish'] = async (uid, id, status) => {
    const db = this.db(uid),
      ref = doc(db, 'fileTransfers', id);
    await runTransaction(db, async (tx) => {
      const value = (await tx.get(ref)).data();
      if (!value || !['offered', 'accepted'].includes(value.status)) return;
      tx.update(ref, { status, endedAt: serverTimestamp() });
    });
  };
  candidate: TransferRepository['candidate'] = async (uid, id, index, candidate) => {
    if (index >= 64) return;
    await setDoc(doc(this.db(uid), 'fileTransfers', id, 'candidates', uid + '_' + index), {
      ...candidate,
      fromId: uid,
      index,
    });
  };
  candidates: TransferRepository['candidates'] = (uid, id, peerId, next, fail) => {
    return onSnapshot(
      query(
        collection(this.db(uid), 'fileTransfers', id, 'candidates'),
        where('fromId', '==', peerId),
        limit(64),
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') next(change.doc.data() as Parameters<typeof next>[0]);
        });
      },
      fail,
    );
  };
}
