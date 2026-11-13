import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth } from '../../../config/firebase/client';
import { queueChatMessage } from '../../chat/data/FirebaseChatRepository';
import { ServerClock } from '../../contacts/data/ServerClock';
import {
  interviewInvitation,
  terminalCall,
  type InterviewCall,
  type InterviewRepository,
  type InterviewTarget,
  type InterviewMode,
  type CallDescription,
  type CallCandidate,
} from '../models/interview';

function database(uid: string) {
  if (getFirebaseAuth().currentUser?.uid !== uid) throw Error('Session changed');
  return getFirestore(getFirebaseApp());
}
/** Signaling only: no audio/video is stored in Firestore. */
export class FirebaseInterviewRepository implements InterviewRepository {
  private clocks = new Map<string, ServerClock>();
  constructor(private db: (uid: string) => Firestore = database) {}
  private clock(uid: string) {
    let clock = this.clocks.get(uid);
    if (!clock) {
      this.clocks.clear();
      clock = new ServerClock(async () => {
        const user = getFirebaseAuth().currentUser;
        if (!user || user.uid !== uid) throw Error('Session changed');
        return user.getIdTokenResult(true);
      });
      this.clocks.set(uid, clock);
    }
    return clock;
  }
  private read(uid: string, snap: DocumentSnapshot): InterviewCall | undefined {
    const data = snap.data();
    if (!data || !(data.expiresAt instanceof Timestamp) || !(data.validUntil instanceof Timestamp))
      return;
    return {
      ...data,
      id: snap.id,
      expiresAt: this.clock(uid).localDeadline(data.expiresAt.toMillis()),
      validUntil: this.clock(uid).localDeadline(data.validUntil.toMillis()),
    } as InterviewCall;
  }
  incoming(uid: string, next: (calls: InterviewCall[]) => void, fail: () => void) {
    let stopped = false;
    let snapshotVersion = 0;
    let unsubscribe: (() => void) | undefined;
    const reportFailure = () => {
      if (stopped) return;
      stopped = true;
      unsubscribe?.();
      fail();
    };
    const synchronized = this.clock(uid).synchronize();
    void synchronized.catch(reportFailure);
    try {
      unsubscribe = onSnapshot(
        query(
          collection(this.db(uid), 'interviewCalls'),
          where('toId', '==', uid),
          where('status', '==', 'ringing'),
          orderBy('createdAt', 'desc'),
          limit(10),
        ),
        { includeMetadataChanges: true },
        (snapshot) => {
          // Do not replay old cached ringing invitations while offline.
          if (stopped || snapshot.metadata.fromCache) return;
          const version = ++snapshotVersion;
          void synchronized
            .then(() => {
              if (stopped || version !== snapshotVersion) return;
              next(
                snapshot.docs
                  .map((snap) => this.read(uid, snap))
                  .filter((call): call is InterviewCall => !!call),
              );
            })
            .catch(reportFailure);
        },
        reportFailure,
      );
    } catch {
      reportFailure();
    }
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }
  prepare = (uid: string) => this.clock(uid).synchronize();

  async create(
    uid: string,
    name: string,
    avatar: string | null,
    target: InterviewTarget,
    mode: InterviewMode,
    offer: CallDescription,
  ) {
    const clock = this.clock(uid);
    await clock.synchronize();
    const db = this.db(uid);
    const ref = doc(collection(db, 'interviewCalls'));
    const expiresAt = clock.now() + 60000,
      validUntil = clock.now() + 7200000;
    const data = {
      fromId: uid,
      toId: target.id,
      fromName: name,
      fromAvatar: avatar,
      kind: target.kind,
      contextId: target.contextId,
      mode,
      status: 'ringing' as const,
      offer,
    };
    const batch = writeBatch(db);
    batch.set(ref, {
      ...data,
      expiresAt: Timestamp.fromMillis(expiresAt),
      validUntil: Timestamp.fromMillis(validUntil),
      createdAt: serverTimestamp(),
    });

    queueChatMessage(
      batch,
      db,
      uid,
      target.kind === 'contact'
        ? { requestId: target.contextId, peerId: target.id }
        : { groupId: target.contextId, memberId: target.id },
      interviewInvitation[mode],
    );
    await batch.commit();
    return {
      ...data,
      id: ref.id,
      expiresAt: clock.localDeadline(expiresAt),
      validUntil: clock.localDeadline(validUntil),
    };
  }
  watch(
    uid: string,
    id: string,
    next: (call: InterviewCall | undefined) => void,
    fail: () => void,
  ) {
    const db = this.db(uid);
    let stopped = false,
      contextStop: (() => void) | undefined;
    const failed = () => {
      if (!stopped) fail();
    };
    const callStop = onSnapshot(
      doc(db, 'interviewCalls', id),
      { includeMetadataChanges: true },
      (snap) => {
        if (stopped) return;
        // A listener can initially miss the document while Firestore reconnects.
        // Only a server snapshot can confirm that the call no longer exists.
        if (!snap.exists() && snap.metadata.fromCache) return;
        const call = this.read(uid, snap);
        next(call);
        if (!call || terminalCall(call.status) || contextStop || stopped) return;
        // End media if a contact is removed or either person leaves the shared group.
        contextStop = onSnapshot(
          doc(db, call.kind === 'group' ? 'privateGroups' : 'contactRequests', call.contextId),
          { includeMetadataChanges: true },
          (context) => {
            if (stopped || context.metadata.fromCache) return;
            const data = context.data();
            if (
              call.kind === 'group'
                ? !data?.joinedIds?.includes(call.fromId) || !data?.joinedIds?.includes(call.toId)
                : data?.status !== 'accepted'
            )
              failed();
          },
          failed,
        );
      },
      failed,
    );
    return () => {
      stopped = true;
      callStop();
      contextStop?.();
    };
  }
  async accept(uid: string, id: string, answer: CallDescription) {
    const db = this.db(uid),
      ref = doc(db, 'interviewCalls', id);
    try {
      // The rules check recipient, expiry and the current ringing state atomically.
      await updateDoc(ref, { status: 'accepted', answer });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'permission-denied') {
        const current = await getDocFromServer(ref).catch(() => undefined);
        if (current?.data()?.status === 'accepted')
          throw Error('Interview answered on another device');
      }
      throw error;
    }
  }
  async finish(uid: string, id: string, status: 'ended' | 'declined' | 'busy') {
    const db = this.db(uid),
      ref = doc(db, 'interviewCalls', id);
    await runTransaction(db, async (transaction) => {
      const call = (await transaction.get(ref)).data();
      if (!call || terminalCall(call.status)) return;
      transaction.update(ref, { status, endedAt: serverTimestamp() });
    });
    // Best effort cleanup. Expired sessions are never usable even if the app goes offline here.
    void getDocs(collection(ref, 'candidates'))
      .then((snapshot) => Promise.all(snapshot.docs.map((candidate) => deleteDoc(candidate.ref))))
      .catch(() => {});
  }
  candidate(uid: string, id: string, index: number, candidate: CallCandidate) {
    return setDoc(doc(this.db(uid), 'interviewCalls', id, 'candidates', uid + '_' + index), {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      fromId: uid,
      index,
    });
  }
  candidates(
    uid: string,
    id: string,
    otherId: string,
    next: (candidate: CallCandidate) => void,
    fail: () => void,
  ) {
    return onSnapshot(
      query(
        collection(this.db(uid), 'interviewCalls', id, 'candidates'),
        where('fromId', '==', otherId),
        limit(64),
      ),
      (snapshot) => {
        for (const change of snapshot.docChanges())
          if (change.type === 'added') {
            const { candidate, sdpMid, sdpMLineIndex } = change.doc.data();
            next({ candidate, sdpMid, sdpMLineIndex });
          }
      },
      fail,
    );
  }
}
