import React from 'react';
import { SharingSettingsView } from '../views/SharingSettingsView';
import { useSharing } from '../bindings/SharingProvider';
import { useMapControls } from '../../map/bindings/useMapControls';
import { useContacts } from '../bindings/useContacts';
export function SharingSettings() {
  const { state, model } = useSharing();
  const map = useMapControls();
  const contacts = useContacts();
  return (
    <SharingSettingsView
      state={state}
      onChange={model.savePreferences}
      onStopAll={model.stopAllSharing}
      groupNames={state.groups
        .filter((group) => group.joinedIds.includes(model.user.id))
        .map((group) => group.name)}
      recording={map.state.recording}
      onRecording={map.commands.toggleRecording}
      recordingDisabled={!map.state.recording && map.state.recordingFull}
      showPeople={contacts.state.showNearby}
      onShowPeople={contacts.commands.setShowNearby}
    />
  );
}
