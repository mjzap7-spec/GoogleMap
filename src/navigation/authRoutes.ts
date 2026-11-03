import type { AuthMode } from '../features/auth/models/auth';

export const authRoutes = {
  signin: '/sign-in',
  signup: '/sign-up',
  reset: '/reset-password',
} as const satisfies Record<AuthMode, string>;
