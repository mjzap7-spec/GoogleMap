import { useEffect } from 'react';
import type { AudioPlayer } from 'expo-audio';

const incomingTone = require('../../../../assets/audio/interview-incoming.wav');
const outgoingTone = require('../../../../assets/audio/interview-ringback.wav');

export function InterviewTone({ incoming }: { incoming: boolean }) {
  useEffect(() => {
    let player: AudioPlayer | undefined;
    try {
      // An older development build can still place calls before it is rebuilt with Expo Audio.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      player = createAudioPlayer(incoming ? incomingTone : outgoingTone);
      player.loop = true;
      player.play();
    } catch {
      // A playback failure must not interrupt call signaling or media.
    }
    return () => player?.release();
  }, [incoming]);

  return null;
}
