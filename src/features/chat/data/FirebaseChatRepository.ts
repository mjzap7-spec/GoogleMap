import {
  collection,
  doc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth } from '../../../config/firebase/client';
import {
  compareTime,
  threadKey,
  type ReadTime,
  type ChatRepository,
  type ChatPeer,
  type ChatPreview,
  type ChatMessage,
  type MemberCard,
} from '../models/chat';

function sessionDatabase(uid: string) {
  if (getFirebaseAuth().currentUser?.uid !== uid) throw Error('Please sign in again.');
  return getFirestore(getFirebaseApp());
}
export class FirebaseChatRepository implements ChatRepository {
  constructor(private database: (uid: string) => Firestore = sessionDatabase) {}
  members(uid: string, groupId: string, next: (rows: MemberCard[]) => void, fail: () => void) {
    return onSnapshot(
      collection(this.database(uid), 'privateGroups', groupId, 'members'),
      (snap) =>
        next(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name,
            avatarUrl: d.data().avatarUrl ?? null,
          })),
        ),
      fail,
    );
  }
  private transcript(db: Firestore, uid: string, peer: ChatPeer) {
    if ('memberId' in peer) {
      const [first, second] = [uid, peer.memberId].sort();
      return collection(
        db,
        'privateGroups',
        peer.groupId,
        'memberChats',
        first,
        'with',
        second,
        'messages',
      );
    }
    return 'groupId' in peer
      ? collection(db, 'privateGroups', peer.groupId, 'messages')
      : collection(db, 'contactRequests', peer.requestId, 'messages');
  }
  inbox(uid: string, next: (rows: ChatPreview[]) => void, fail: () => void) {
    return onSnapshot(
      collection(this.database(uid), 'users', uid, 'chatInbox'),
      (snap) => {
        next(
          snap.docs.map((item) => {
            const data = item.data({ serverTimestamps: 'estimate' });
            return {
              peerId: item.id,
              requestId: data.requestId,
              text: data.text,
              time: data.updatedAt?.toMillis() ?? 0,
            };
          }),
        );
      },
      fail,
    );
  }
  receipts(uid: string, next: (rows: Map<string, ReadTime>) => void, fail: () => void) {
    return onSnapshot(
      collection(this.database(uid), 'users', uid, 'chatReads'),
      (snapshot) => {
        const rows = new Map<string, ReadTime>();
        for (const item of snapshot.docs) {
          const time = item.data().through;
          if (time instanceof Timestamp) rows.set(item.id, time);
        }
        next(rows);
      },
      fail,
    );
  }
  unread(
    uid: string,
    peer: ChatPeer,
    after: ReadTime | undefined,
    next: (count: number) => void,
    fail: () => void,
  ) {
    const messages = this.transcript(this.database(uid), uid, peer);
    // The badge caps at 99+. This bounds the first read even for a long-lived group.
    const unseen = query(
      messages,
      where('createdAt', '>', new Timestamp(after?.seconds ?? 0, after?.nanoseconds ?? 0)),
      where('fromId', '!=', uid),
      orderBy('createdAt'),
      orderBy('fromId'),
      limit(100),
    );
    return onSnapshot(unseen, (snap) => next(snap.size), fail);
  }
  async markRead(uid: string, peer: ChatPeer, through: ReadTime) {
    const ref = doc(this.database(uid), 'users', uid, 'chatReads', threadKey(peer));
    const time = new Timestamp(through.seconds, through.nanoseconds);
    try {
      await setDoc(ref, { through: time });
    } catch (error) {
      // An offline device may reconnect after another device has read further.
      if ((error as { code?: string })?.code === 'permission-denied') {
        const saved = (await getDocFromServer(ref)).data()?.through;
        if (saved instanceof Timestamp && compareTime(saved, through) >= 0) return;
      }
      throw error;
    }
  }
  messages(
    uid: string,
    peer: ChatPeer,
    count: number,
    next: (rows: ChatMessage[]) => void,
    fail: () => void,
  ) {
    const db = this.database(uid);
    const ref = this.transcript(db, uid, peer);
    return onSnapshot(
      query(ref, orderBy('createdAt', 'desc'), limit(count)),
      { includeMetadataChanges: true },
      (snap) => {
        next(
          snap.docs.map((item) => {
            const data = item.data({ serverTimestamps: 'estimate' });
            return {
              id: item.id,
              fromId: data.fromId,
              senderName: typeof data.senderName === 'string' ? data.senderName : undefined,
              text: data.text,
              time: data.createdAt?.toMillis() ?? 0,
              createdAt: !item.metadata.hasPendingWrites ? data.createdAt : undefined,
              pending: item.metadata.hasPendingWrites,
            };
          }),
        );
      },
      fail,
    );
  }
  async send(uid: string, peer: ChatPeer, text: string) {
    const db = this.database(uid);
    const batch = writeBatch(db);
    const ref = doc(this.transcript(db, uid, peer));
    if ('groupId' in peer) {
      batch.set(ref, {
        fromId: uid,
        ...('senderName' in peer ? { senderName: peer.senderName } : {}),
        text,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      return;
    }
    batch.set(ref, { fromId: uid, text, createdAt: serverTimestamp() });
    const preview = {
      messageId: ref.id,
      requestId: peer.requestId,
      text,
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, 'users', uid, 'chatInbox', peer.peerId), preview);
    batch.set(doc(db, 'users', peer.peerId, 'chatInbox', uid), preview);
    await batch.commit();
  }
}
