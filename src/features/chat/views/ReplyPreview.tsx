import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import type { MessageReply } from '../models/chat';

export function ReplyPreview({
  reply,
  uid,
  peerName,
}: {
  reply: MessageReply;
  uid: string;
  peerName: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.quote}>
      <Text numberOfLines={1} style={s.name}>
        {reply.fromId === uid ? t('You') : reply.senderName || peerName}
      </Text>
      <Text numberOfLines={2} style={s.text}>
        {reply.unavailable
          ? t('Original message unavailable')
          : (reply.text ?? t('Loading message…'))}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  quote: {
    borderLeftWidth: 3,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: '#00000016',
    gap: 3,
  },
  name: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  text: { color: '#D0CCDE', fontSize: 13, lineHeight: 18 },
});
