import React, { type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ui } from './styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';

export function ScreenLayout({
  children,
  onBack,
  backDisabled,
  header,
  title,
  footer,
}: PropsWithChildren<{
  onBack: () => void;
  backDisabled?: boolean;
  header?: ReactNode;
  title?: string;
  footer?: React.ReactElement;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={ui.screen}>
      <StatusBar style="light" />
      <ScreenHeader onBack={onBack} disabled={backDisabled} title={title}>
        {header}
      </ScreenHeader>
      <KeyboardAvoidingView style={{ flex: 1 }} enabled={Platform.OS === 'ios'} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            ui.content,
            footer && { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View
            style={[
              ui.card,
              title && { maxWidth: 520 },
              footer && { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
            ]}
          >
            {children}
          </View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
