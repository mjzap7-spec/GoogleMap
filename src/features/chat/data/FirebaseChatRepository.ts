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
  runTransaction,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth } from '../../../config/firebase/client';
import { historyFilter, newerTime, type LocalThreadHistory } from '../models/localChatHistory';
import {
  compareTime,
  threadKey,
  type ReadTime,
  type ChatRepository,
  type ChatPeer,
  type ChatPreview,
  type ChatMessage,
  type MemberCard,
  type MessageReply,
} from '../models/chat';

function sessionDatabase(uid: string) {
  if (getFirebaseAuth().currentUser?.uid !== uid) throw Error('Please sign in again.');
  return getFirestore(getFirebaseApp());
}
function transcript(db: Firestore, uid: string, peer: ChatPeer) {
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

export function queueChatMessage(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  peer: ChatPeer,
  text: string,
  replyTo?: string,
) {
  const ref = doc(transcript(db, uid, peer));
  if ('groupId' in peer) {
    batch.set(ref, {
      fromId: uid,
      ...('senderName' in peer ? { senderName: peer.senderName } : {}),
      text,
      ...(replyTo ? { replyTo } : {}),
      createdAt: serverTimestamp(),
    });
    return;
  }
  batch.set(ref, {
    fromId: uid,
    text,
    createdAt: serverTimestamp(),
    ...(replyTo ? { replyTo } : {}),
  });
  const preview = {
    messageId: ref.id,
    requestId: peer.requestId,
    text,
    updatedAt: serverTimestamp(),
  };
  batch.set(doc(db, 'users', uid, 'chatInbox', peer.peerId), preview);
  batch.set(doc(db, 'users', peer.peerId, 'chatInbox', uid), preview);
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
  inbox(uid: string, next: (rows: ChatPreview[]) => void, fail: () => void) {
    return onSnapshot(
      collection(this.database(uid), 'users', uid, 'chatInbox'),
      { includeMetadataChanges: true },
      (snap) => {
        // An unpopulated local cache does not establish that this person has no history.
        if (snap.empty && snap.metadata.fromCache) return;
        next(
          snap.docs.map((item) => {
            const data = item.data({ serverTimestamps: 'estimate' });
            return {
              peerId: item.id,
              requestId: data.requestId,
              messageId: data.messageId,
              createdAt: data.updatedAt,
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
  private sharedReads(db: Firestore, uid: string, peer: ChatPeer) {
    const parent = transcript(db, uid, peer).parent!;
    return collection(parent, 'reads');
  }
  readByOthers(
    uid: string,
    peer: ChatPeer,
    next: (through: ReadTime | undefined) => void,
    fail: () => void,
  ) {
    return onSnapshot(
      this.sharedReads(this.database(uid), uid, peer),
      (snapshot) => {
        let newest: ReadTime | undefined;
        for (const receipt of snapshot.docs) {
          const time = receipt.data().through;
          if (
            receipt.id !== uid &&
            !receipt.metadata.hasPendingWrites &&
            time instanceof Timestamp &&
            (!newest || compareTime(time, newest) > 0)
          )
            newest = time;
        }
        next(newest);
      },
      fail,
    );
  }
  async shareRead(uid: string, peer: ChatPeer, through: ReadTime) {
    const ref = doc(this.sharedReads(this.database(uid), uid, peer), uid);
    try {
      await setDoc(ref, { through: new Timestamp(through.seconds, through.nanoseconds) });
    } catch (error) {
      // Another device may already have advanced this account's shared read position.
      if ((error as { code?: string })?.code === 'permission-denied') {
        const saved = (await getDocFromServer(ref)).data()?.through;
        if (saved instanceof Timestamp && compareTime(saved, through) >= 0) return;
      }
      throw error;
    }
  }
  unread(
    uid: string,
    peer: ChatPeer,
    after: ReadTime | undefined,
    next: (count: number) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ) {
    const messages = transcript(this.database(uid), uid, peer);
    const through = newerTime(after, history?.clearedThrough);
    const hidden = historyFilter(history);
    // The badge caps at 99+. This bounds the first read even for a long-lived group.
    const unseen = query(
      messages,
      where('createdAt', '>', new Timestamp(through?.seconds ?? 0, through?.nanoseconds ?? 0)),
      where('fromId', '!=', uid),
      orderBy('createdAt'),
      orderBy('fromId'),
      limit(100 + (history?.hiddenIds.length ?? 0)),
    );
    return onSnapshot(
      unseen,
      (snap) =>
        next(
          Math.min(
            100,
            snap.docs.filter((item) => !hidden({ id: item.id, createdAt: item.data().createdAt }))
              .length,
          ),
        ),
      fail,
    );
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
  messageIds(
    uid: string,
    peer: ChatPeer,
    next: (ids: string[]) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ) {
    const after = history?.clearedThrough;
    const hidden = historyFilter(history);
    return onSnapshot(
      query(
        transcript(this.database(uid), uid, peer),
        ...(after
          ? [where('createdAt', '>', new Timestamp(after.seconds, after.nanoseconds))]
          : []),
        orderBy('createdAt', 'desc'),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        // A cached page can be incomplete. Never present it as the entire conversation.
        if (snapshot.metadata.fromCache) return;
        next(
          snapshot.docs
            .filter((item) => !hidden({ id: item.id, createdAt: item.data().createdAt }))
            .map((item) => item.id),
        );
      },
      fail,
    );
  }
  messages(
    uid: string,
    peer: ChatPeer,
    count: number,
    next: (rows: ChatMessage[]) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ) {
    const db = this.database(uid);
    const ref = transcript(db, uid, peer);
    const hidden = historyFilter(history);
    const after = history?.clearedThrough;
    let stopped = false;
    let rows: ChatMessage[] = [];
    const quotes = new Map<string, MessageReply>();
    const watches = new Map<string, () => void>();
    const stopQuotes = () => {
      for (const stop of watches.values()) stop();
      watches.clear();
      quotes.clear();
    };
    const emit = () => {
      if (stopped) return;
      const loaded = new Map(rows.map((message) => [message.id, message]));
      next(
        rows.map((message) => ({
          ...message,
          reply: message.replyTo
            ? (loaded.get(message.replyTo) ??
              quotes.get(message.replyTo) ?? { id: message.replyTo })
            : undefined,
        })),
      );
    };
    const stopMessages = onSnapshot(
      query(
        ref,
        ...(after
          ? [where('createdAt', '>', new Timestamp(after.seconds, after.nanoseconds))]
          : []),
        orderBy('createdAt', 'desc'),
        limit(count + (history?.hiddenIds.length ?? 0)),
      ),
      { includeMetadataChanges: true },
      (snap) => {
        if (stopped) return;
        if (snap.empty && snap.metadata.fromCache) return;
        rows = snap.docs
          .map((item) => {
            const data = item.data({ serverTimestamps: 'estimate' });
            return {
              id: item.id,
              fromId: data.fromId,
              senderName: typeof data.senderName === 'string' ? data.senderName : undefined,
              text: data.text,
              time: data.createdAt?.toMillis() ?? 0,
              createdAt:
                !item.metadata.hasPendingWrites || data.editedAt ? data.createdAt : undefined,
              pending: item.metadata.hasPendingWrites && !data.editedAt,
              edited: !!data.editedAt,
              replyTo: typeof data.replyTo === 'string' ? data.replyTo : undefined,
            };
          })
          .filter((message) => !hidden(message))
          .slice(0, count);
        const loaded = new Set(rows.map((message) => message.id));
        const needed = new Set(
          (count > 1 ? rows : []).flatMap((message) =>
            message.replyTo && !loaded.has(message.replyTo) ? [message.replyTo] : [],
          ),
        );
        for (const [id, stop] of watches) {
          if (!needed.has(id)) {
            stop();
            watches.delete(id);
            quotes.delete(id);
          }
        }
        for (const id of needed) {
          if (watches.has(id)) continue;
          watches.set(
            id,
            onSnapshot(
              doc(ref, id),
              (original) => {
                const data = original.data();
                quotes.set(
                  id,
                  data && !hidden({ id, createdAt: data.createdAt })
                    ? { id, fromId: data.fromId, senderName: data.senderName, text: data.text }
                    : { id, unavailable: true },
                );
                emit();
              },
              () => {
                quotes.set(id, { id, unavailable: true });
                emit();
              },
            ),
          );
        }
        emit();
      },
      () => {
        // Losing conversation access must also stop late quote snapshots.
        stopped = true;
        rows = [];
        stopQuotes();
        fail();
      },
    );
    return () => {
      stopped = true;
      stopMessages();
      stopQuotes();
    };
  }
  async send(uid: string, peer: ChatPeer, text: string, replyTo?: string) {
    const db = this.database(uid);
    const batch = writeBatch(db);
    queueChatMessage(batch, db, uid, peer, text, replyTo);
    await batch.commit();
  }
  edit(uid: string, peer: ChatPeer, messageId: string, text: string) {
    return this.changeMessage(uid, peer, messageId, text);
  }
  remove(uid: string, peer: ChatPeer, messageId: string) {
    return this.changeMessage(uid, peer, messageId);
  }
  private async changeMessage(uid: string, peer: ChatPeer, messageId: string, text?: string) {
    const db = this.database(uid);
    const ref = doc(transcript(db, uid, peer), messageId);
    await runTransaction(db, async (transaction) => {
      const message = await transaction.get(ref);
      if (!message.exists() || message.data().fromId !== uid) throw Error('Message unavailable');
      // Read our inbox before writing so a newer arrival cannot be overwritten by an old edit.
      const ownInbox =
        'peerId' in peer ? doc(db, 'users', uid, 'chatInbox', peer.peerId) : undefined;
      const preview = ownInbox ? (await transaction.get(ownInbox)).data() : undefined;
      if (text === undefined) transaction.delete(ref);
      else transaction.update(ref, { text, editedAt: serverTimestamp() });
      if (ownInbox && preview?.messageId === messageId && 'peerId' in peer) {
        const updated = { ...preview, text: text ?? '' };
        transaction.set(ownInbox, updated);
        transaction.set(doc(db, 'users', peer.peerId, 'chatInbox', uid), updated);
      }
    });
  }
}
