import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import {
  terminalCall,
  type InterviewCall,
  type InterviewTarget,
  type InterviewMode,
  type InterviewRepository,
  type CallMedia,
  type CallMediaSession,
  type CallCandidate,
  type MediaPreview,
} from '../models/interview';

export interface InterviewState {
  phase:
    | 'idle'
    | 'choose'
    | 'preparing'
    | 'outgoing'
    | 'incoming'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'ended';
  target?: InterviewTarget;
  mode: InterviewMode;
  call?: InterviewCall;
  local?: MediaPreview;
  remote?: MediaPreview;
  muted: boolean;
  cameraOn: boolean;
  error: string;
  result: string;
  listeningError: boolean;
}
/** One account-scoped call. Views never access signaling or native media directly. */
export class InterviewViewModel extends ObservableViewModel<InterviewState> {
  private revision = 0;
  private foreground = true;
  private incomingStop?: () => void;
  private callStops: (() => void)[] = [];
  private media?: CallMediaSession;
  private timer?: ReturnType<typeof setTimeout>;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private ignored = new Set<string>();
  private outgoingCandidates: CallCandidate[] = [];
  private candidateIndex = 0;
  private applyingAnswer = false;
  private answerPublished = false;
  constructor(
    private uid: string,
    private identity: () => { name: string; avatar: string | null },
    private repo?: InterviewRepository,
    private devices?: CallMedia,
    private now = Date.now,
  ) {
    super({
      phase: 'idle',
      mode: 'voice',
      muted: false,
      cameraOn: false,
      error: '',
      result: '',
      listeningError: false,
    });
  }
  setIdentity = (identity: () => { name: string; avatar: string | null }) => {
    this.identity = identity;
  };
  start = () => {
    if (this.incomingStop || !this.repo || !this.foreground) return;
    this.update({ listeningError: false });
    let stopped = false;
    let restart: ReturnType<typeof setTimeout> | undefined;
    this.incomingStop = () => {
      stopped = true;
      clearTimeout(restart);
    };
    const stop = this.repo.incoming(
      this.uid,
      (calls) => {
        if (stopped) return;
        for (const call of calls) {
          if (call.toId !== this.uid || call.expiresAt <= this.now() || this.ignored.has(call.id))
            continue;
          if (this.state.call?.id === call.id) continue;
          if (!['idle', 'choose', 'ended'].includes(this.state.phase)) {
            this.ignore(call.id);
            void this.repo?.finish(this.uid, call.id, 'busy').catch(() => {});
            continue;
          }
          this.release();
          this.update({
            phase: 'incoming',
            call,
            mode: call.mode,
            error: '',
            result: '',
            muted: false,
            cameraOn: call.mode === 'video',
            target: {
              id: call.fromId,
              name: call.fromName,
              avatarUrl: call.fromAvatar,
              kind: call.kind,
              contextId: call.contextId,
            },
          });
          this.observe(call);
          if (this.state.phase === 'incoming')
            this.arm(Math.max(0, call.expiresAt - this.now()), 'No answer');
          break;
        }
      },
      () => {
        if (stopped) return;
        this.update({ listeningError: true });
        restart ??= setTimeout(() => {
          if (!stopped) this.retry();
        }, 5000);
      },
    );
    this.incomingStop = () => {
      stopped = true;
      clearTimeout(restart);
      stop();
    };
  };
  retry = () => {
    this.incomingStop?.();
    this.incomingStop = undefined;
    this.start();
  };
  choose = (target: InterviewTarget) => {
    if (!this.foreground || target.id === this.uid || !['idle', 'ended'].includes(this.state.phase))
      return;
    this.release();
    this.update({
      phase: 'choose',
      target,
      call: undefined,
      error: '',
      result: '',
      muted: false,
      cameraOn: false,
    });
  };
  startInterview = (target: InterviewTarget, mode: InterviewMode) => {
    if (!['idle', 'ended'].includes(this.state.phase) || !this.foreground || target.id === this.uid)
      return;
    this.choose(target);
    void this.begin(mode);
  };
  begin = async (mode: InterviewMode) => {
    const target = this.state.target;
    if (this.state.phase !== 'choose' || !target || !this.foreground) return;
    this.update({ phase: 'preparing', mode, cameraOn: mode === 'video', error: '' });
    const version = ++this.revision;
    this.arm(30000, 'Could not start the interview. Check permissions and connection.');
    try {
      const [media] = await Promise.all([
        this.openMedia(version, mode),
        this.repo?.prepare?.(this.uid),
      ]);
      if (!media || version !== this.revision) return;
      const offer = await media.offer();
      if (version !== this.revision) return;
      const identity = this.identity();
      if (!this.repo) throw Error();
      const call = await this.repo.create(
        this.uid,
        identity.name,
        identity.avatar,
        target,
        mode,
        offer,
      );
      if (version !== this.revision) {
        void this.repo.finish(this.uid, call.id, 'ended').catch(() => {});
        return;
      }
      this.update({ phase: 'outgoing', call });
      this.arm(Math.max(0, call.expiresAt - this.now()), 'No answer');
      this.observe(call);
      if (version === this.revision) this.flushCandidates();
    } catch (error) {
      if (version === this.revision) this.fail(error);
    }
  };
  accept = async () => {
    const call = this.state.call;
    if (this.state.phase !== 'incoming' || !call?.offer || !this.foreground) return;
    if (call.expiresAt <= this.now()) {
      this.end('No answer');
      return;
    }
    this.update({ phase: 'connecting', error: '' });
    const version = this.revision;
    this.arm(30000, 'The call could not connect. Check your internet connection and try again.');
    try {
      const media = await this.openMedia(version, call.mode);
      if (!media || version !== this.revision) return;
      const answer = await media.answer(call.offer);
      if (version !== this.revision) return;
      this.watchCandidates(call, version);
      if (version !== this.revision) return;
      await this.repo!.accept(this.uid, call.id, answer);
      if (version !== this.revision) {
        void this.repo!.finish(this.uid, call.id, 'ended').catch(() => {});
        return;
      }
      this.answerPublished = true;
      this.flushCandidates();
    } catch (error) {
      if (version === this.revision) this.fail(error);
    }
  };
  decline = () => this.end('Interview declined', 'declined');
  hangUp = () => this.end('Interview ended');
  dismiss = () => {
    if (this.state.phase === 'choose' || this.state.phase === 'ended') {
      this.release();
      this.update({ phase: 'idle', call: undefined, target: undefined, error: '', result: '' });
    }
  };
  retryInterview = () => {
    const { phase, target, mode, error } = this.state;
    if (phase !== 'ended' || !target || !error || !this.foreground) return;
    this.startInterview(target, mode);
  };
  toggleMute = () => {
    if (!this.media) return;
    const muted = !this.state.muted;
    this.media.mute(muted);
    this.update({ muted });
  };
  toggleCamera = () => {
    if (!this.media || this.state.mode !== 'video') return;
    const cameraOn = !this.state.cameraOn;
    this.media.camera(cameraOn);
    this.update({ cameraOn });
  };
  switchCamera = () => {
    if (this.state.cameraOn) this.media?.switchCamera();
  };
  setForeground = (active: boolean) => {
    this.foreground = active;
    if (active) this.start();
    else {
      this.incomingStop?.();
      this.incomingStop = undefined;
      if (!['idle', 'choose', 'ended'].includes(this.state.phase)) this.end('Interview ended');
    }
  };
  stop = () => {
    this.incomingStop?.();
    this.incomingStop = undefined;
    const call = this.state.call;
    this.release();
    if (call && !terminalCall(call.status))
      void this.repo?.finish(this.uid, call.id, 'ended').catch(() => {});
  };
  private async openMedia(version: number, mode: InterviewMode) {
    if (!this.devices) throw Error('Rebuild the development app to enable interview calls.');
    const media = await this.devices.open(mode, {
      remote: (remote) => {
        if (version === this.revision) this.update({ remote });
      },
      candidate: (candidate) => {
        if (version !== this.revision || this.candidateIndex + this.outgoingCandidates.length >= 64)
          return;
        this.outgoingCandidates.push(candidate);
        this.flushCandidates();
      },
      connection: (status) => {
        if (version !== this.revision) return;
        if (status === 'connected') {
          clearTimeout(this.timer);
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = undefined;
          this.update({ phase: 'connected' });
          this.arm(
            Math.max(0, (this.state.call?.validUntil ?? this.now() + 7200000) - this.now()),
            'Interview ended',
          );
        } else if (status === 'failed')
          this.end('The call could not connect. Check your internet connection and try again.');
        else if (!this.disconnectTimer) {
          if (this.state.phase === 'connected') this.update({ phase: 'reconnecting' });
          this.disconnectTimer = setTimeout(() => this.end('Connection lost'), 10000);
        }
      },
    });
    if (version !== this.revision || !this.foreground) {
      media.close();
      return;
    }
    this.media = media;
    this.update({ local: media.local });
    return media;
  }
  private observe(call: InterviewCall) {
    const version = this.revision;
    const stop = this.repo!.watch(
      this.uid,
      call.id,
      (next) => {
        if (version !== this.revision) return;
        if (!next || terminalCall(next.status)) {
          this.ignore(call.id);
          this.release();
          this.update({
            phase: 'ended',
            call: undefined,
            result:
              next?.status === 'declined'
                ? 'Interview declined'
                : next?.status === 'busy'
                  ? 'This person is on another call'
                  : 'Interview ended',
          });
          return;
        }
        if (
          next.status === 'accepted' &&
          next.toId === this.uid &&
          this.state.phase === 'incoming'
        ) {
          this.ignore(call.id);
          this.release();
          this.update({
            phase: 'ended',
            call: undefined,
            result: 'Interview answered on another device',
          });
          return;
        }
        this.update({ call: next });
        if (next.fromId === this.uid && next.answer && !this.applyingAnswer) {
          this.applyingAnswer = true;
          this.update({ phase: 'connecting' });
          this.arm(
            30000,
            'The call could not connect. Check your internet connection and try again.',
          );
          void this.media!.applyAnswer(next.answer)
            .then(() => {
              if (version === this.revision) this.watchCandidates(next, version);
            })
            .catch((error) => {
              if (version === this.revision) this.fail(error);
            });
        }
      },
      () => {
        if (version === this.revision) this.end('Interview connection unavailable. Please retry.');
      },
    );
    if (version === this.revision) this.callStops.push(stop);
    else stop();
  }
  private watchCandidates(call: InterviewCall, version: number) {
    let queue = Promise.resolve();
    const stop = this.repo!.candidates(
      this.uid,
      call.id,
      call.fromId === this.uid ? call.toId : call.fromId,
      (candidate) => {
        queue = queue
          .then(async () => {
            if (version === this.revision) await this.media?.addCandidate(candidate);
          })
          .catch(() => {
            if (version === this.revision)
              this.end('Interview connection unavailable. Please retry.');
          });
      },
      () => {
        if (version === this.revision) this.end('Interview connection unavailable. Please retry.');
      },
    );
    if (version === this.revision) this.callStops.push(stop);
    else stop();
  }
  private flushCandidates() {
    const call = this.state.call,
      version = this.revision;
    if (!call || !this.media || (call.toId === this.uid && !this.answerPublished)) return;
    for (const candidate of this.outgoingCandidates.splice(0)) {
      void this.repo!.candidate(this.uid, call.id, this.candidateIndex++, candidate).catch(() => {
        if (version === this.revision) this.end('Interview connection unavailable. Please retry.');
      });
    }
  }
  private fail(error: unknown) {
    if (error instanceof Error && error.message === 'Interview answered on another device') {
      if (this.state.call) this.ignore(this.state.call.id);
      this.release();
      this.update({ phase: 'ended', call: undefined, result: error.message });
      return;
    }
    const known = [
      'Rebuild the development app to enable interview calls.',
      'Allow microphone and camera access to start the interview.',
      'Could not load the call relay configuration.',
    ];
    this.end(
      error instanceof Error && known.includes(error.message)
        ? error.message
        : 'Could not start the interview. Check permissions and connection.',
    );
  }
  private end(result: string, status: 'ended' | 'declined' = 'ended') {
    const call = this.state.call;
    if (call) this.ignore(call.id);
    this.release();
    this.update({
      phase: 'ended',
      call: undefined,
      result,
      error: status === 'ended' && result !== 'Interview ended' ? result : '',
    });
    if (call) void this.repo?.finish(this.uid, call.id, status).catch(() => {});
  }
  private arm(ms: number, result: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.end(result), ms);
  }
  private ignore(id: string) {
    this.ignored.add(id);
    if (this.ignored.size > 256) this.ignored.delete(this.ignored.values().next().value!);
  }
  private release() {
    this.revision++;
    clearTimeout(this.timer);
    clearTimeout(this.disconnectTimer);
    this.disconnectTimer = undefined;
    this.callStops.splice(0).forEach((stop) => stop());
    this.media?.close();
    this.media = undefined;
    this.outgoingCandidates = [];
    this.candidateIndex = 0;
    this.applyingAnswer = false;
    this.answerPublished = false;
    this.update({ local: undefined, remote: undefined });
  }
}
