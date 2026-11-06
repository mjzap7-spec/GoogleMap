import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type {
  ContactEditorState,
  ContactEditorViewModel,
} from '../viewmodels/ContactEditorViewModel';
import { ScreenLayout } from '../../../shared/ui/ScreenLayout';
import { FormField } from '../../../shared/ui/FormField';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { colors } from '../../../shared/theme/colors';
export function ContactEditorView({
  state,
  commands,
  onBack,
}: {
  state: Readonly<ContactEditorState>;
  commands: Pick<ContactEditorViewModel, 'setNickname' | 'save' | 'remove'> & { retry: () => void };
  onBack: () => void;
}) {
  const { t } = useTranslation();

  const contact = state.contact;
  return (
    <ScreenLayout
      onBack={onBack}
      backDisabled={!!state.action}
      title={contact?.name ?? t('Contact')}
    >
      {state.loading && <ActivityIndicator color={colors.accent} />}
      {contact && (
        <>
          <FormField
            label={t('Nickname')}
            value={state.nickname}
            onChangeText={commands.setNickname}
            editable={!state.action}
            maxLength={100}
          />
          {(
            [
              [t('Name'), contact.fullName],
              [t('Email'), contact.email],
              [t('Birthday'), contact.birthday],
              [t('Profile location'), contact.profileLocation],
            ] as const
          ).map(([label, value]) => (
            <React.Fragment key={t(label)}>
              <Text style={styles.label}>{t(label)}</Text>
              <Text selectable style={styles.value}>
                {value || t('Not shared')}
              </Text>
            </React.Fragment>
          ))}
          <PrimaryButton
            label={t('Save')}
            busy={state.action === 'save'}
            disabled={!!state.action}
            onPress={commands.save}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!!state.action}
            accessibilityLabel={t('Delete contact')}
            accessibilityState={{ disabled: !!state.action, busy: state.action === 'delete' }}
            onPress={commands.remove}
            style={styles.remove}
          >
            {state.action === 'delete' ? (
              <ActivityIndicator color="#ffb4be" />
            ) : (
              <Text style={styles.error}>{t('Delete contact')}</Text>
            )}
          </Pressable>
        </>
      )}
      {!!state.error && (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {t(state.error)}
          </Text>
          <Pressable accessibilityRole="button" onPress={commands.retry} style={styles.remove}>
            <Text style={styles.label}>{t('Retry')}</Text>
          </Pressable>
        </>
      )}
    </ScreenLayout>
  );
}
const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  value: { color: colors.text, fontSize: 16, lineHeight: 23, marginBottom: 16 },
  remove: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ffb4be', fontSize: 15, lineHeight: 22 },
});
