import { useMemo, useSyncExternalStore } from 'react';
import { selectSnapshot } from './selectSnapshot';

/** Views subscribe only to the fields they display. Keep selectors outside render. */
export function useViewModelSelection<State, Selection>(
  model: { getSnapshot: () => State; subscribe: (listener: () => void) => () => void },
  select: (state: State) => Selection,
  equal?: (previous: Selection, next: Selection) => boolean,
) {
  const snapshot = useMemo(
    () => selectSnapshot(model.getSnapshot, select, equal),
    [model, select, equal],
  );
  return useSyncExternalStore(model.subscribe, snapshot, snapshot);
}
