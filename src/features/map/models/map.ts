import type { TravelPoint, TrackingStatus } from './travel';
export const mapLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'local', label: 'Local names' },
] as const;
export type MapLanguage = (typeof mapLanguages)[number]['code'];
export function isMapLanguage(value: unknown): value is MapLanguage {
  return mapLanguages.some((item) => item.code === value);
}
export interface MapState {
  developerTestingEnabled: boolean;
  testUserCount: import('./testUsers').TestUserCount;
  testUsers: readonly MapUserMarker[];
  selectedTestUserId: string;
  language: MapLanguage;
  tracking: TrackingStatus;
  recording: boolean;
  trackingError: string;
  placeName: string;
  live: TravelPoint | null;
  trail: readonly (readonly TravelPoint[])[];
  recordedPoints: number;
}
export interface MapPreferences {
  subscribeLanguage?(listener: (language: MapLanguage) => void): () => void;
  readLanguage(): Promise<MapLanguage>;
  writeLanguage(language: MapLanguage): Promise<void>;
}
export type MapCommand = 'zoom-in' | 'zoom-out' | 'recenter';
export interface MapUserMarker {
  readonly trip?: boolean;
  readonly id: string;
  readonly nickname: string;
  readonly avatarUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly expiresAt: number;
  readonly updatedAt?: number;
}
export interface MapCanvasProps {
  /** Keep the renderer mounted, but send only the latest state when this screen is visible. */
  active?: boolean;
  sharedTrail?: readonly (readonly TravelPoint[])[];
  onSelectUser?: (id: string) => void;
  users?: readonly MapUserMarker[];
  focus?: (MapUserMarker & { readonly revision: number }) | null;
  state: Readonly<MapState>;
  commands: {
    setLanguage: (language: MapLanguage) => void;
    pauseTracking: () => void;
    resumeTracking: () => void;
    clearTrail: () => void;
  };
}
export function labelExpression(language: MapLanguage): unknown[] {
  return language === 'local'
    ? ['coalesce', ['get', 'name'], ['get', 'name:latin'], '']
    : [
        'coalesce',
        ['get', `name:${language}`],
        ['get', `name_${language}`],
        ['get', 'name'],
        ['get', 'name:latin'],
        '',
      ];
}
