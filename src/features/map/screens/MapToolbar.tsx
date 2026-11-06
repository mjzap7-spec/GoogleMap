import React from 'react';
import { AppToolbar } from '../../../shared/ui/AppToolbar';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useMap } from '../bindings/useMap';
import { useUnreadChats } from '../../chat/bindings/UnreadChatsProvider';
export function MapToolbar({
  onMap,
  ...props
}: Omit<
  React.ComponentProps<typeof AppToolbar>,
  'recording' | 'onToggleRecording' | 'recordingDisabled' | 'recordingHint' | 'unread'
> & { onMap: boolean }) {
  const { state, commands } = useMap();
  const {
    state: { total },
  } = useUnreadChats();
  const { t } = useTranslation();
  return (
    <AppToolbar
      {...props}
      unread={total}
      recording={state.recording}
      onToggleRecording={commands.toggleRecording}
      recordingDisabled={!onMap || (!state.recording && state.recordedPoints >= 5000)}
      recordingHint={state.trackingError ? t(state.trackingError) : undefined}
    />
  );
}
