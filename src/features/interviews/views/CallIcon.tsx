import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
export function CallIcon({
  kind = 'video',
  color = colors.accent,
}: {
  kind?: 'video' | 'voice';
  color?: string;
}) {
  return (
    <View accessible={false} style={s.frame}>
      {kind === 'video' ? (
        <>
          <View style={[s.camera, { borderColor: color }]} />
          <View style={[s.lens, { borderRightColor: color }]} />
        </>
      ) : (
        <>
          <View style={[s.mic, { borderColor: color }]} />
          <View style={[s.arc, { borderColor: color }]} />
          <View style={[s.stem, { backgroundColor: color }]} />
        </>
      )}
    </View>
  );
}
export function PhoneIcon({
  color = colors.accent,
  hangUp = false,
}: {
  color?: string;
  hangUp?: boolean;
}) {
  return (
    <View accessible={false} style={[s.handset, hangUp && s.hangUp]}>
      <View style={[s.handsetArc, { borderColor: color }]} />
      <View style={[s.handsetTip, s.handsetLeft, { backgroundColor: color }]} />
      <View style={[s.handsetTip, s.handsetRight, { backgroundColor: color }]} />
    </View>
  );
}
const s = StyleSheet.create({
  handset: { width: 23, height: 14, transform: [{ rotate: '38deg' }] },
  hangUp: { transform: [{ rotate: '180deg' }] },
  handsetArc: {
    ...StyleSheet.absoluteFill,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },
  handsetTip: { position: 'absolute', top: 0, width: 7, height: 6, borderRadius: 2.5 },
  handsetLeft: { left: 0 },
  handsetRight: { right: 0 },
  frame: { width: 24, height: 24 },
  camera: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 17,
    height: 14,
    borderWidth: 1.8,
    borderRadius: 4,
  },
  lens: {
    position: 'absolute',
    top: 7,
    right: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  mic: {
    position: 'absolute',
    top: 1,
    left: 8,
    width: 8,
    height: 13,
    borderRadius: 5,
    borderWidth: 1.8,
  },
  arc: {
    position: 'absolute',
    top: 7,
    left: 4,
    width: 16,
    height: 11,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },
  stem: { position: 'absolute', left: 11, top: 17, width: 2, height: 5 },
});
