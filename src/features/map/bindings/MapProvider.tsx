import { useSession } from '../../auth/bindings/useSession';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { MapViewModel } from '../viewmodels/MapViewModel';
const Context = createContext<MapViewModel | null>(null);
/** The signed-in map and toolbar share one recorder across screen changes. */
export function MapProvider({ children }: PropsWithChildren) {
  const { createMap } = useAuthDependencies();
  const [model] = useState(createMap);
  const { state: session } = useSession();
  const eligible =
    !!session.user &&
    !session.profileRequired &&
    !session.registrationProfilePending &&
    session.user?.profileStatus !== 'loading' &&
    session.user?.profileStatus !== 'error';
  const trackingAllowed = useRef(eligible);
  useEffect(() => {
    model.setForeground(AppState.currentState === 'active' && trackingAllowed.current);
    model.start();
    const subscription = AppState.addEventListener('change', (state) =>
      model.setForeground(state === 'active' && trackingAllowed.current),
    );
    return () => {
      subscription.remove();
      model.dispose();
    };
  }, [model]);
  useEffect(() => {
    trackingAllowed.current = eligible;
    model.setForeground(AppState.currentState === 'active' && trackingAllowed.current);
  }, [eligible, model]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useMapViewModel() {
  const model = useContext(Context);
  if (!model) throw new Error('MapProvider is required.');
  return model;
}
