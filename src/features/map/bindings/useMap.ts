import { useMemo, useSyncExternalStore } from 'react';
import { useMapViewModel } from './MapProvider';
export function useMap() {
  const viewModel = useMapViewModel();
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  const commands = useMemo(
    () => ({
      setLanguage: viewModel.setLanguage,
      pauseTracking: viewModel.pauseTracking,
      resumeTracking: viewModel.resumeTracking,
      toggleRecording: viewModel.toggleRecording,
      clearTrail: viewModel.clearTrail,
    }),
    [viewModel],
  );
  return { state, commands };
}
