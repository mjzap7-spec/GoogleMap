import { isMapLanguage, type MapLanguage, type MapPreferences } from '../models/map';
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
const key = 'google-map:map-language:v1';
export class StoredMapPreferences implements MapPreferences {
  constructor(private storage: Storage) {}
  async readLanguage(): Promise<MapLanguage> {
    try {
      const value = await this.storage.getItem(key);
      return isMapLanguage(value) ? value : 'en';
    } catch {
      return 'en';
    }
  }
  async writeLanguage(language: MapLanguage) {
    await this.storage.setItem(key, language);
  }
}
