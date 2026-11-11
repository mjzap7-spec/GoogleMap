import React, { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { avatarImageUrl } from '../utils/avatarImageUrl';
/** Show initials while loading and after failure; never shift the surrounding row. */
export const Avatar = memo(function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const thumbnail = uri ? avatarImageUrl(uri, size * 2) : undefined;
  const imageUri = failed === thumbnail ? uri : thumbnail;
  return (
    <View
      accessible={false}
      style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {Array.from(name.trim())[0]?.toUpperCase() || '?'}
      </Text>
      {!!uri && !!imageUri && failed !== uri && (
        <Image
          source={{ uri: imageUri }}
          onError={() => setFailed(imageUri)}
          fadeDuration={120}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#BCB5FF18',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: colors.accent, fontWeight: '600' },
});
