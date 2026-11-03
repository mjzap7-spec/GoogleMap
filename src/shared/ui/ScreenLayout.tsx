import React, { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ui } from './styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';

export function ScreenLayout({
  children,
  onBack,
  backDisabled,
}: PropsWithChildren<{ onBack: () => void; backDisabled?: boolean }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={ui.screen}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 28 }}>
        <BackButton onPress={onBack} disabled={backDisabled} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={ui.content}
        >
          <View style={ui.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
