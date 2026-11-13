import { requestInterviewPermissions } from '../../../shared/platform/interviewPermissions';
import { openInterviewAudio } from '../../../shared/platform/interviewAudio';
import type { CallMedia } from '../models/interview';
import { openPeerMedia, type RtcRuntime } from './PeerCallMedia';
import { callIceServers } from './callIceServers';

export class DeviceCallMedia implements CallMedia {
  open: CallMedia['open'] = async (mode, events) => {
    let runtime: typeof import('react-native-webrtc');
    try {
      // Keep WebRTC in the native bundle so Accept does not wait for a Metro split bundle.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      runtime = require('react-native-webrtc');
    } catch {
      throw Error('Rebuild the development app to enable interview calls.');
    }
    const native = runtime as unknown as RtcRuntime;
    let releaseAudio = () => {};
    const mediaDevices: RtcRuntime['mediaDevices'] = {
      getUserMedia: async (options) => {
        await requestInterviewPermissions(mode === 'video');
        releaseAudio = await openInterviewAudio();
        return native.mediaDevices.getUserMedia(options);
      },
    };
    try {
      const session = await openPeerMedia(
        { RTCPeerConnection: native.RTCPeerConnection, mediaDevices },
        callIceServers(),
        mode,
        events,
      );
      return {
        ...session,
        close() {
          try {
            session.close();
          } finally {
            releaseAudio();
          }
        },
      };
    } catch (error) {
      releaseAudio();
      throw error;
    }
  };
}
