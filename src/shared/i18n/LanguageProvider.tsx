import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { LanguageViewModel } from './LanguageViewModel';
import { translate } from './translate';
const Context = createContext<LanguageViewModel | null>(null);
export function LanguageProvider({
  model,
  children,
}: PropsWithChildren<{ model: LanguageViewModel }>) {
  useEffect(() => {
    void model.start();
  }, [model]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useTranslation() {
  const model = useContext(Context);
  if (!model) throw new Error('LanguageProvider is missing.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const t = useCallback(
    (text: string | null | undefined, values?: Record<string, string | number>) =>
      translate(text ?? '', state.language, values),
    [state.language],
  );
  return {
    language: state.language,
    error: state.error,
    setLanguage: model.writeLanguage,
    t,
  };
}
