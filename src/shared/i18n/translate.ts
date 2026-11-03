import { catalog } from './catalog';
import type { AppLanguage } from './languages';
const columns = { es: 0, fr: 1, de: 2, zh: 3, ja: 4 };
export function translate(
  text: string,
  language: AppLanguage,
  values?: Record<string, string | number>,
): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const translated =
    language === 'en' ? normalized : (catalog[normalized]?.[columns[language]] ?? normalized);
  return values
    ? translated.replace(/\{(\w+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
      )
    : translated;
}
