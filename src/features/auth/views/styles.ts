import { StyleSheet } from 'react-native';
import { colors } from '../../../shared/theme/colors';

export const authStyles = StyleSheet.create({
  form: { marginTop: 32 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 28 },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarPlus: { fontSize: 30, fontWeight: '300', color: colors.accent },
  avatarActions: { flex: 1 },
  avatarAction: { minHeight: 44, justifyContent: 'center' },
  avatarHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  profileDetails: { marginTop: 24, marginBottom: 12, gap: 12 },
  passwordRow: { position: 'relative' },
  show: { position: 'absolute', right: 5, top: 6, padding: 13, minHeight: 44 },
  forgot: { alignSelf: 'flex-end', minHeight: 44, paddingTop: 6, marginTop: -10 },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
  },
  switchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  setup: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 24, textAlign: 'center' },
});
