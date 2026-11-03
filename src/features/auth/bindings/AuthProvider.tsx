import React, { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import type { AuthDependencies } from './dependencies';

const AuthContext = createContext<AuthDependencies | null>(null);

export function AuthProvider({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies: AuthDependencies }>) {
  useEffect(() => {
    dependencies.session.start();
    return dependencies.session.stop;
  }, [dependencies]);

  return <AuthContext.Provider value={dependencies}>{children}</AuthContext.Provider>;
}

export function useAuthDependencies() {
  const dependencies = useContext(AuthContext);
  if (!dependencies) throw new Error('AuthProvider is missing. Wrap the app in AppProviders.');
  return dependencies;
}
