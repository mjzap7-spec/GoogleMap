import React, { memo, useEffect, useState } from 'react';
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
  return (
    <View
      accessible={false}
      style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {Array.from(name.trim())[0]?.toUpperCase() || '?'}
      </Text>
      {uri && <AvatarImage key={uri} uri={uri} size={size} />}
    </View>
  );
});
function AvatarImage({ uri, size }: { uri: string; size: number }) {
  const thumbnail = avatarImageUrl(uri, size * 2);
  const [attempt, setAttempt] = useState<'thumbnail' | 'original' | 'waiting' | 'retry' | 'failed'>(
    thumbnail === uri ? 'original' : 'thumbnail',
  );
  useEffect(() => {
    if (attempt !== 'waiting') return;
    const retry = setTimeout(() => setAttempt('retry'), 1000);
    return () => clearTimeout(retry);
  }, [attempt]);
  if (attempt === 'waiting' || attempt === 'failed') return null;
  return (
    <Image
      key={attempt}
      source={{ uri: attempt === 'thumbnail' ? thumbnail : uri }}
      onError={() =>
        setAttempt((current) => {
          if (current !== attempt) return current;
          if (attempt === 'thumbnail') return 'original';
          return attempt === 'original' ? 'waiting' : 'failed';
        })
      }
      fadeDuration={120}
      style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
    />
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
