import type {
  CallCandidate,
  CallDescription,
  CallMediaEvents,
  CallMediaSession,
  InterviewMode,
  MediaPreview,
} from '../models/interview';

export interface RtcTrack {
  enabled: boolean;
  stop(): void;
  _switchCamera?: () => void;
}
export interface RtcStream {
  getTracks(): RtcTrack[];
  getAudioTracks(): RtcTrack[];
  getVideoTracks(): RtcTrack[];
  toURL?: () => string;
  release?: () => void;
}
export interface RtcPeer {
  localDescription: CallDescription | null;
  connectionState: string;
  iceConnectionState?: string;
  addTrack(track: RtcTrack, stream: RtcStream): unknown;
  addEventListener(
    name: string,
    next: (event: { candidate?: { toJSON(): CallCandidate }; streams?: RtcStream[] }) => void,
  ): void;
  createOffer(options: object): Promise<CallDescription>;
  createAnswer(): Promise<CallDescription>;
  setLocalDescription(description: CallDescription): Promise<void>;
  setRemoteDescription(description: CallDescription): Promise<void>;
  addIceCandidate(candidate: CallCandidate): Promise<void>;
  getStats?(): Promise<ReadonlyMap<string, AudioStat>>;
  close(): void;
}
interface AudioStat {
  type: string;
  kind?: string;
  mediaType?: string;
  packetsSent?: number;
  packetsReceived?: number;
  totalAudioEnergy?: number;
}
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
export interface RtcRuntime {
  mediaDevices: { getUserMedia(options: object): Promise<RtcStream> };
  RTCPeerConnection: new (options: { iceServers: IceServer[] }) => RtcPeer;
}
function preview(stream: RtcStream): MediaPreview {
  return stream.toURL ? { url: stream.toURL() } : { stream };
}
function releaseStream(stream: RtcStream) {
  stream.getTracks().forEach((track) => track.stop());
  stream.release?.();
}
/** Shared transport, independent of the screen and signaling repository. */
export async function openPeerMedia(
  runtime: RtcRuntime,
  servers: IceServer[] | Promise<IceServer[]>,
  mode: InterviewMode,
  events: CallMediaEvents,
): Promise<CallMediaSession> {
  const [capture, relay] = await Promise.allSettled([
    runtime.mediaDevices.getUserMedia({
      audio: true,
      video:
        mode === 'video' ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false,
    }),
    servers,
  ]);
  if (capture.status === 'rejected') {
    const name = capture.reason?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
      throw Error('Allow microphone and camera access to start the interview.');
    throw capture.reason;
  }
  const local = capture.value;
  if (relay.status === 'rejected') {
    releaseStream(local);
    throw relay.reason;
  }
  if (!local.getAudioTracks().length || (mode === 'video' && !local.getVideoTracks().length)) {
    releaseStream(local);
    throw Error('Allow microphone and camera access to start the interview.');
  }
  let closed = false,
    remote: RtcStream | undefined,
    peer: RtcPeer;
  let audioCheck: ReturnType<typeof setTimeout> | undefined;
  try {
    peer = new runtime.RTCPeerConnection({ iceServers: relay.value });
  } catch (error) {
    releaseStream(local);
    throw error;
  }
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(audioCheck);
    releaseStream(local);
    if (remote) releaseStream(remote);
    peer.close();
  };
  try {
    local.getTracks().forEach((track) => peer.addTrack(track, local));
    const diagnostics = process.env.NODE_ENV === 'development';
    const checkAudio = async () => {
      try {
        const stats = await peer.getStats?.();
        if (closed || !stats) return;
        const audio = [...stats.values()].filter(
          (stat) => (stat.kind ?? stat.mediaType) === 'audio',
        );
        console.info('[Interview] Audio stats:', {
          sent: audio.find((stat) => stat.type === 'outbound-rtp')?.packetsSent,
          received: audio.find((stat) => stat.type === 'inbound-rtp')?.packetsReceived,
          microphoneEnergy: audio.find((stat) => stat.type === 'media-source')?.totalAudioEnergy,
          receivedEnergy: audio.find((stat) => stat.type === 'inbound-rtp')?.totalAudioEnergy,
        });
      } catch {
        // Diagnostics must never affect the call.
      }
    };
    const gathered = new Set<string>();
    peer.addEventListener('icecandidate', (event) => {
      if (closed || !event.candidate) return;
      const data = event.candidate.toJSON();
      if (diagnostics) {
        const type = /\btyp (host|srflx|prflx|relay)\b/.exec(data.candidate)?.[1];
        if (type && !gathered.has(type)) {
          gathered.add(type);
          console.info('[Interview] Local ICE candidate type:', type);
        }
      }
      // Browser candidates include usernameFragment; keep the signaling schema identical on native/web.
      // Empty candidates signal gathering completion and do not need a Firestore write.
      if (data.candidate)
        events.candidate({
          candidate: data.candidate,
          sdpMid: data.sdpMid ?? null,
          sdpMLineIndex: data.sdpMLineIndex ?? null,
        });
    });
    peer.addEventListener('track', (event) => {
      if (!closed && event.streams?.[0]) {
        remote = event.streams[0];
        events.remote(preview(remote));
      }
    });
    peer.addEventListener('connectionstatechange', () => {
      if (diagnostics && !closed && peer.connectionState === 'connected' && !audioCheck)
        audioCheck = setTimeout(() => void checkAudio(), 8000);
      if (diagnostics && !closed)
        console.info(
          '[Interview] Connection state:',
          peer.connectionState,
          peer.iceConnectionState,
        );
      if (!closed && ['connected', 'disconnected', 'failed'].includes(peer.connectionState))
        events.connection(peer.connectionState as 'connected' | 'disconnected' | 'failed');
    });
    return {
      local: preview(local),
      async offer() {
        const offer = await peer.createOffer({});
        if (closed) throw Error('Closed');
        await peer.setLocalDescription(offer);
        return { type: 'offer', sdp: peer.localDescription!.sdp };
      },
      async answer(offer) {
        await peer.setRemoteDescription(offer);
        if (closed) throw Error('Closed');
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        return { type: 'answer', sdp: peer.localDescription!.sdp };
      },
      async applyAnswer(answer) {
        if (!closed) await peer.setRemoteDescription(answer);
      },
      async addCandidate(candidate) {
        if (!closed) await peer.addIceCandidate(candidate);
      },
      mute(muted) {
        local.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      },
      camera(enabled) {
        local.getVideoTracks().forEach((track) => {
          track.enabled = enabled;
        });
      },
      switchCamera() {
        local.getVideoTracks().forEach((track) => track._switchCamera?.());
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
