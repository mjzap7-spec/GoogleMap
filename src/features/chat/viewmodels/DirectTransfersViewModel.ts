import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import { fileTransferError } from '../models/fileSignaling';
import type { ChatMessage, ChatPeer } from '../models/chat';
import {
  directTransferId,
  MAX_DIRECT_FILE_BYTES,
  type DataTransferSession,
  type DataTransferTransport,
  type DirectFileDevice,
  type DirectTransfer,
  type TransferRepository,
  type TransferSink,
  type TransferSource,
} from '../models/directTransfer';
import type { CallCandidate } from '../../interviews/models/interview';

type Phase = 'waiting' | 'connecting' | 'transferring' | 'ready' | 'completed';
export interface TransferState {
  records: Record<string, DirectTransfer>;
  busy: boolean;
  error: string;
  active?: { id: string; phase: Phase; bytes: number; saving?: boolean };
}
interface Running {
  id?: string;
  source?: TransferSource;
  sink?: TransferSink;
  session?: DataTransferSession;
  abort: AbortController;
  candidates: CallCandidate[];
  index: number;
  writable: boolean;
  remoteReady: boolean;
  stopCandidates?: () => void;
  timer?: ReturnType<typeof setTimeout>;
}
const terminal = (value: DirectTransfer) => !['offered', 'accepted'].includes(value.status);

/** One transfer per open conversation. Disk handles and network sessions stay outside view state. */
export class DirectTransfersViewModel extends ObservableViewModel<TransferState> {
  private subscriptions = new Map<string, () => void>();
  private running?: Running;
  constructor(
    private repository: TransferRepository | undefined,
    private device: DirectFileDevice | undefined,
    private transport: DataTransferTransport | undefined,
    private uid: string,
    private peer: ChatPeer,
  ) {
    super({ records: {}, busy: false, error: '' });
  }
  sync = (messages: readonly ChatMessage[]) => {
    const ids = new Set(
      messages
        .map((m) => directTransferId(m.text))
        .filter((id): id is string => !!id)
        .slice(0, 50),
    );
    if (this.running?.id) ids.add(this.running.id);
    for (const [id, stop] of this.subscriptions)
      if (!ids.has(id)) {
        stop();
        this.subscriptions.delete(id);
      }
    const records = Object.fromEntries(
      Object.entries(this.state.records).filter(([id]) => ids.has(id)),
    );
    if (Object.keys(records).length !== Object.keys(this.state.records).length)
      this.update({ records });
    for (const id of ids) this.watch(id);
  };
  private watch(id: string) {
    if (this.subscriptions.has(id) || !this.repository) return;
    this.subscriptions.set(
      id,
      this.repository.watch(
        this.uid,
        id,
        (value) => {
          if (!value) return;
          this.update({ records: { ...this.state.records, [id]: value } });
          const run = this.running;
          if (run?.id !== id) return;
          if (terminal(value)) {
            if (value.status === 'completed' && this.state.active?.phase === 'ready') {
              run.session?.close();
              run.stopCandidates?.();
              clearTimeout(run.timer);
            } else if (value.status !== 'completed' || this.state.active?.phase !== 'completed') {
              this.dispose();
              this.update({ active: undefined, busy: false });
            }
          } else if (
            value.status === 'accepted' &&
            run.source &&
            !run.remoteReady &&
            value.answer
          ) {
            run.remoteReady = true;
            this.update({ active: { id, phase: 'connecting', bytes: 0 } });
            void run
              .session!.applyAnswer(value.answer)
              .then(() => this.remoteCandidates(run))
              .catch(() => this.fail(run));
          }
        },
        () => {
          if (this.running?.id === id)
            this.fail(this.running, 'File invitation is no longer available.');
          const records = { ...this.state.records };
          delete records[id];
          this.update({ records });
        },
      ),
    );
  }
  private current(run: Running) {
    return this.running === run && !run.abort.signal.aborted;
  }
  private dispose() {
    const run = this.running;
    this.running = undefined;
    if (!run) return;
    clearTimeout(run.timer);
    run.abort.abort();
    run.stopCandidates?.();
    run.session?.close();
    run.source?.close();
    run.sink?.close();
  }
  private fail(run: Running, error = 'Could not transfer the file. Please try again.') {
    if (!this.current(run)) return;
    if (run.id && (run.source || run.writable))
      void this.repository?.finish(this.uid, run.id, 'failed').catch(() => {});
    this.dispose();
    this.update({ busy: false, active: undefined, error });
  }
  private publishCandidates(run: Running) {
    if (!run.id || !run.writable || !this.current(run)) return;
    for (const value of run.candidates.splice(0)) {
      const index = run.index++;
      if (index < 64)
        void this.repository!.candidate(this.uid, run.id, index, value).catch(() => {
          if (this.current(run) && !['ready', 'completed'].includes(this.state.active?.phase ?? ''))
            this.fail(run);
        });
    }
  }
  private remoteCandidates(run: Running) {
    if (!this.current(run) || !run.id) return;
    const record = this.state.records[run.id];
    if (!record) return;
    run.stopCandidates = this.repository!.candidates(
      this.uid,
      run.id,
      record.fromId === this.uid ? record.toId : record.fromId,
      (value) => {
        if (this.current(run)) void run.session!.candidate(value).catch(() => this.fail(run));
      },
      () => this.fail(run),
    );
  }
  private open(run: Running, size: number) {
    return this.transport!.open({
      size,
      source: run.source,
      sink: run.sink,
      signal: run.abort.signal,
      candidate: (value) => {
        if (this.current(run) && run.index + run.candidates.length < 64) {
          run.candidates.push(value);
          this.publishCandidates(run);
        }
      },
      progress: (bytes) => {
        if (this.current(run) && run.id)
          this.update({ active: { id: run.id, phase: 'transferring', bytes } });
      },
      fail: (message) => this.fail(run, message),
      complete: () => {
        if (!this.current(run) || !run.id) return;
        clearTimeout(run.timer);
        this.update({
          busy: false,
          active: { id: run.id, phase: run.sink ? 'ready' : 'completed', bytes: size },
        });
        if (run.source) {
          run.source.close();
          run.source = undefined;
          void this.repository!.finish(this.uid, run.id, 'completed').catch(() =>
            this.update({ error: 'Could not update the transfer history.' }),
          );
        }
      },
    });
  }
  private begin(): Running | undefined {
    if (
      this.state.busy ||
      !this.repository ||
      !this.device ||
      !this.transport ||
      'senderName' in this.peer
    )
      return;
    // Keep a received file until it has been saved or explicitly cancelled.
    if (this.running?.sink) {
      this.update({ error: 'Save or cancel the received file first.' });
      return;
    }
    this.dispose();
    const run: Running = {
      abort: new AbortController(),
      candidates: [],
      index: 0,
      writable: false,
      remoteReady: false,
    };
    this.running = run;
    this.update({ busy: true, error: '', active: undefined });
    return run;
  }
  send = async () => {
    const run = this.begin();
    if (!run) return;
    try {
      const source = await this.device!.pick();
      if (!this.current(run)) {
        source?.close();
        return;
      }
      if (!source) {
        this.dispose();
        this.update({ busy: false });
        return;
      }
      run.source = source;
      if (source.size <= 0 || source.size > MAX_DIRECT_FILE_BYTES)
        throw Error('Choose a file up to 100 MB.');
      run.session = this.open(run, source.size);
      const offer = await run.session.offer();
      if (!this.current(run)) return;
      const record = await this.repository!.create(
        this.uid,
        this.peer,
        { name: source.name, size: source.size, mime: source.mime },
        offer,
      );
      if (!this.current(run)) {
        void this.repository!.finish(this.uid, record.id, 'cancelled').catch(() => {});
        return;
      }
      run.id = record.id;
      run.writable = true;
      this.update({
        records: { ...this.state.records, [record.id]: record },
        active: { id: record.id, phase: 'waiting', bytes: 0 },
      });
      run.timer = setTimeout(
        () => this.fail(run, 'File invitation expired. Please send it again.'),
        Math.max(0, record.expiresAt - Date.now()),
      );
      this.watch(record.id);
      this.publishCandidates(run);
    } catch (error) {
      this.fail(run, fileTransferError(error));
    }
  };
  accept = async (id: string) => {
    const record = this.state.records[id];
    if (
      !record ||
      record.toId !== this.uid ||
      record.status !== 'offered' ||
      record.expiresAt <= Date.now()
    )
      return;
    const run = this.begin();
    if (!run) return;
    run.id = id;
    this.update({ active: { id, phase: 'connecting', bytes: 0 } });
    try {
      const sink = await this.device!.receive(record);
      if (!this.current(run)) {
        sink.close();
        return;
      }
      run.sink = sink;
      run.session = this.open(run, record.size);
      const answer = await run.session.answer(record.offer);
      if (!this.current(run)) return;
      await this.repository!.accept(this.uid, id, answer);
      if (!this.current(run)) return;
      run.writable = true;
      this.remoteCandidates(run);
      this.publishCandidates(run);
      run.timer = setTimeout(
        () => this.fail(run, 'File invitation expired. Please send it again.'),
        Math.max(0, record.expiresAt - Date.now()),
      );
    } catch (error) {
      this.fail(run, fileTransferError(error));
    }
  };
  cancel = (id: string) => {
    const record = this.state.records[id];
    const run = this.running;
    if (run && (run.id === id || (!id && !run.id))) {
      this.dispose();
      this.update({ busy: false, active: undefined, error: '' });
    }
    if (record && !terminal(record))
      void this.repository!.finish(
        this.uid,
        id,
        record.toId === this.uid && record.status === 'offered' && run?.id !== id
          ? 'declined'
          : 'cancelled',
      ).catch(() => this.update({ error: 'Could not update the transfer history.' }));
  };
  save = async (id: string) => {
    const run = this.running;
    if (
      run?.id !== id ||
      !run.sink ||
      this.state.active?.phase !== 'ready' ||
      this.state.active.saving
    )
      return;
    this.update({ active: { ...this.state.active, saving: true }, error: '' });
    try {
      await run.sink.save();
      // Keep the file available if the system save/share sheet was dismissed.
    } catch {
      if (this.current(run)) this.update({ error: 'Could not save the received file.' });
    } finally {
      if (this.current(run) && this.state.active)
        this.update({ active: { ...this.state.active, saving: false } });
    }
  };
  stop = () => {
    const canFinish = this.running && (!!this.running.source || this.running.writable);
    const id = this.running?.id,
      phase = this.state.active?.phase;
    this.dispose();
    if (canFinish && id && !['ready', 'completed'].includes(phase ?? ''))
      void this.repository?.finish(this.uid, id, 'cancelled').catch(() => {});
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions.clear();
    this.update({ busy: false, active: undefined });
  };
}
