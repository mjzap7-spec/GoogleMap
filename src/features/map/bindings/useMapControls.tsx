import { useViewModelSelection } from '../../../shared/mvvm/useViewModelSelection';
import type { MapState } from '../models/map';
import { useMapViewModel } from './MapProvider';

const select = (state: Readonly<MapState>) => ({
  recording: state.recording,
  recordingFull: state.recordedPoints >= 5000,
  trackingError: state.trackingError,
});
const equal = (a: ReturnType<typeof select>, b: ReturnType<typeof select>) =>
  a.recording === b.recording &&
  a.recordingFull === b.recordingFull &&
  a.trackingError === b.trackingError;

/** GPS fixes update the map, not the toolbar or its animations. */
export function useMapControls() {
  const commands = useMapViewModel();
  const state = useViewModelSelection(commands, select, equal);
  return { state, commands };
}
