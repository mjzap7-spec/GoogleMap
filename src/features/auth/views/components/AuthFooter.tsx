import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ui } from '../../../../shared/ui/styles';
import { authStyles } from '../styles';

interface AuthFooterProps {
  prompt: string;
  actionLabel: string;
  disabled: boolean;
  onPress: () => void;
}

export function AuthFooter({ prompt, actionLabel, disabled, onPress }: AuthFooterProps) {
  return (
    <View style={authStyles.switchRow}>
      <Text style={ui.muted}>{prompt}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={authStyles.switchButton}
        onPress={onPress}
      >
        <Text style={ui.link}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
