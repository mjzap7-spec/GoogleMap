import React from 'react';
import { StyleSheet } from 'react-native';
import type { MediaPreview } from '../models/interview';

export function CallVideo({ preview, local = false }: { preview: MediaPreview; local?: boolean }) {
  if (!preview.url) return null;
  // A native stream URL is available only after the bundled WebRTC runtime has loaded.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RTCView } = require('react-native-webrtc') as typeof import('react-native-webrtc');
  return (
    <RTCView
      streamURL={preview.url}
      mirror={local}
      objectFit="cover"
      zOrder={local ? 1 : 0}
      style={StyleSheet.absoluteFill}
    />
  );
}
