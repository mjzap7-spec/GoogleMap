import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
/** Show initials while loading and after failure; never shift the surrounding row. */
export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <View
      accessible={false}
      style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {Array.from(name.trim())[0]?.toUpperCase() || '?'}
      </Text>
      {!!uri && failed !== uri && (
        <Image
          source={{ uri }}
          onError={() => setFailed(uri)}
          fadeDuration={120}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#BCB5FF18',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: colors.accent, fontWeight: '600' },
});
