export const appLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
] as const;
export type AppLanguage = (typeof appLanguages)[number]['code'];
export function isAppLanguage(value: unknown): value is AppLanguage {
  return appLanguages.some((item) => item.code === value);
}
