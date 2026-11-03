import { useTranslation } from '../../../shared/i18n/LanguageProvider';
export function useMapSettings() {
  const { language, setLanguage, error } = useTranslation();
  return { language, setLanguage, error };
}
