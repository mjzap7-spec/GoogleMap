import React from 'react';
import { SharingSettingsView } from '../views/SharingSettingsView';
import { useSharing } from '../bindings/SharingProvider';
export function SharingSettings() {
  const { state, model } = useSharing();
  return <SharingSettingsView state={state} onChange={model.savePreferences} />;
}
