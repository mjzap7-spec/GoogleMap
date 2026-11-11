import React, { useEffect, useRef } from 'react';
import type { MediaPreview } from '../models/interview';
export function CallVideo({ preview, local = false }: { preview: MediaPreview; local?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = preview.stream as MediaStream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [preview]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={local}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: local ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}
