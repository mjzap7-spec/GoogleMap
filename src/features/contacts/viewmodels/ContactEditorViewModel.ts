import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import { contactErrorMessage, type Contact, type ContactRepository } from '../models/contact';
export interface ContactEditorState {
  contact: Contact | null;
  nickname: string;
  loading: boolean;
  action: '' | 'save' | 'delete';
  error: string;
  done: boolean;
}
export class ContactEditorViewModel extends ObservableViewModel<ContactEditorState> {
  private detailVersion = 0;
  private generation = 0;
  private stop?: () => void;
  private dirty = false;
  constructor(
    private repository: ContactRepository,
    private userId: string,
    private contactId: string,
  ) {
    super({ contact: null, nickname: '', loading: true, action: '', error: '', done: false });
  }
  start = () => {
    this.stop?.();
    const generation = ++this.generation;
    this.update({ loading: true, error: '' });
    this.stop = this.repository.observe(
      this.userId,
      (contacts) => {
        if (generation !== this.generation) return;
        const detailVersion = ++this.detailVersion;
        const contact = contacts.find((item) => item.id === this.contactId);
        if (!contact) {
          this.update({
            contact: null,
            loading: false,
            error: 'This contact is no longer available.',
          });
          return;
        }
        this.update({
          contact,
          loading: false,
          ...(!this.dirty ? { nickname: contact.name } : {}),
        });
        if (this.repository.details)
          void this.repository
            .details(this.userId, contact)
            .then((details) => {
              if (generation === this.generation && detailVersion === this.detailVersion)
                this.update({ contact: details });
            })
            .catch((error) => {
              if (generation === this.generation)
                this.update({ error: contactErrorMessage(error) });
            });
      },
      (error) => {
        if (generation === this.generation)
          this.update({ loading: false, error: contactErrorMessage(error) });
      },
    );
  };
  setNickname = (nickname: string) => {
    if (!this.state.action) {
      this.dirty = true;
      this.update({ nickname, error: '' });
    }
  };
  save = async () => {
    if (this.state.action || !this.state.contact) return;
    const nickname = this.state.nickname.trim();
    if (!nickname || nickname.length > 100) {
      this.update({ error: 'Enter a nickname (up to 100 characters).' });
      return;
    }
    const generation = this.generation;
    this.update({ action: 'save', error: '' });
    try {
      if (!this.repository.rename) throw new Error('Nickname updates are unavailable.');
      await this.repository.rename(this.userId, this.state.contact, nickname);
      if (generation === this.generation) this.update({ done: true });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ action: '' });
    }
  };
  remove = async () => {
    if (this.state.action || !this.state.contact) return;
    const generation = this.generation;
    this.update({ action: 'delete', error: '' });
    try {
      if (!this.repository.remove) throw new Error('Contact deletion is unavailable.');
      await this.repository.remove(this.userId, this.state.contact);
      if (generation === this.generation) this.update({ done: true });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ action: '' });
    }
  };
  dispose = () => {
    this.generation++;
    this.stop?.();
  };
}
