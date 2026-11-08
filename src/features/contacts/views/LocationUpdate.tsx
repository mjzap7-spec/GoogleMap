import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedMapUser } from '../models/contact';
import { locationFreshness } from '../../map/models/locationFreshness';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';

export function LocationUpdate({ user }: { user: SharedMapUser }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const status = locationFreshness(user, now);
  return (
    <View style={s.row}>
      <View
        style={[
          s.dot,
          status.kind === 'current' ? s.current : status.kind === 'stale' ? s.stale : undefined,
        ]}
      />
      <View style={s.copy}>
        <Text style={s.text}>{t(status.label, status.values)}</Text>
        {status.kind === 'stale' && <Text style={s.text}>{t('Last known location')}</Text>}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  current: { backgroundColor: '#8BD6AD' },
  stale: { backgroundColor: '#E8C080' },
  copy: { flex: 1 },
  text: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
