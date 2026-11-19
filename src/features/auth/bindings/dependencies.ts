/** Compatibility exports for existing providers and injected test services. */
export { createViewModels as createAuthDependencies } from '../../../application/createViewModels';
export type {
  AppServices as AuthServices,
  AppDependencies as AuthDependencies,
} from '../../../application/createViewModels';
