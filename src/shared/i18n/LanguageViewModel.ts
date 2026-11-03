import { ObservableViewModel } from '../mvvm/ObservableViewModel';
import { isAppLanguage, type AppLanguage } from './languages';
export interface LanguageStorage {
  readLanguage(): Promise<string>;
  writeLanguage(language: AppLanguage): Promise<void>;
}
/** One app-wide source of truth; late restoration cannot overwrite a user selection. */
export class LanguageViewModel extends ObservableViewModel<{
  language: AppLanguage;
  error: string;
}> {
  private revision = 0;
  private started = false;
  private saving: Promise<void> = Promise.resolve();
  constructor(private storage?: LanguageStorage) {
    super({ language: 'en', error: '' });
  }
  start = async () => {
    if (this.started) return;
    this.started = true;
    const revision = this.revision;
    try {
      const language = await this.storage?.readLanguage();
      if (revision === this.revision && isAppLanguage(language)) this.update({ language });
    } catch {
      /* English stays available when device storage cannot be read. */
    }
  };
  readLanguage = async () => {
    await this.start();
    return this.state.language;
  };
  writeLanguage = (language: string): Promise<void> => {
    if (!isAppLanguage(language)) return Promise.resolve();
    const revision = ++this.revision;
    this.update({ language, error: '' });
    this.saving = this.saving
      .catch(() => {})
      .then(async () => {
        try {
          await this.storage?.writeLanguage(language);
        } catch {
          if (revision === this.revision)
            this.update({ error: 'Could not save language. Select it again to retry.' });
        }
      });
    return this.saving;
  };
  subscribeLanguage = (listener: (language: AppLanguage) => void) =>
    this.subscribe(() => listener(this.state.language));
}
