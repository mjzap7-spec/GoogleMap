import type { CallMedia } from '../../models/interview';
import { openPeerMedia, type RtcRuntime } from '../webrtc/PeerCallMedia';
import { callIceServers } from '../webrtc/callIceServers';

export class DeviceCallMedia implements CallMedia {
  prepare = callIceServers;
  open: CallMedia['open'] = async (mode, events, signal) => {
    if (typeof window === 'undefined' || !navigator.mediaDevices || !window.RTCPeerConnection)
      throw Error('Allow microphone and camera access to start the interview.');
    return openPeerMedia(
      {
        mediaDevices: navigator.mediaDevices,
        RTCPeerConnection: window.RTCPeerConnection,
      } as unknown as RtcRuntime,
      callIceServers(),
      mode,
      events,
      signal,
    );
  };
}
