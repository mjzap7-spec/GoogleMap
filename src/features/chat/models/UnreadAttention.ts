import { callMessagePrefix, interviewInvitation } from '../../interviews/models/interview';

interface UnreadRow {
  id: string;
  text: string;
}
interface CallAttention {
  toId?: string;
  status?: string;
  answer?: unknown;
}
type CallWatch = { pending: boolean; stop?: () => void };

/** Counts unread text/files plus unattended incoming calls, never two badges for one invitation. */
export class UnreadAttention {
  private calls = new Map<string, CallWatch>();
  private ordinary = 0;
  private previous?: number;
  private stopped = false;
  private syncing = false;
  constructor(
    private uid: string,
    private watch: (id: string, next: (call: CallAttention | undefined) => void) => () => void,
    private next: (count: number) => void,
  ) {}
  sync(rows: readonly UnreadRow[]) {
    if (this.stopped) return;
    this.syncing = true;
    const calls = new Set<string>();
    this.ordinary = 0;
    for (const row of rows) {
      const id = row.id.slice(callMessagePrefix.length);
      if (
        row.id.startsWith(callMessagePrefix) &&
        /^[A-Za-z0-9]{20}$/.test(id) &&
        (row.text === interviewInvitation.voice || row.text === interviewInvitation.video)
      )
        calls.add(id);
      else this.ordinary++;
    }
    for (const [id, current] of this.calls)
      if (!calls.has(id)) {
        this.calls.delete(id);
        current.stop?.();
      }
    for (const id of calls)
      if (!this.calls.has(id)) {
        const current: CallWatch = { pending: false };
        this.calls.set(id, current);
        try {
          current.stop = this.watch(id, (call) => {
            if (this.stopped || this.calls.get(id) !== current) return;
            current.pending =
              !!call &&
              call.toId === this.uid &&
              !call.answer &&
              (call.status === 'ringing' || call.status === 'ended' || call.status === 'busy');
            this.publish();
          });
        } catch {
          current.pending = false;
        }
      }
    this.syncing = false;
    this.publish();
  }
  private publish() {
    if (this.syncing || this.stopped) return;
    const count = Math.min(
      100,
      this.ordinary + [...this.calls.values()].filter((call) => call.pending).length,
    );
    if (count === this.previous) return;
    this.previous = count;
    this.next(count);
  }
  stop() {
    this.stopped = true;
    this.calls.forEach((call) => call.stop?.());
    this.calls.clear();
  }
}
