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
  private stopDetails?: () => void;
  private dirty = false;
  constructor(
    private repository: ContactRepository,
    private userId: string,
    private contactId: string,
    private observe: ContactRepository['observe'] = repository.observe.bind(repository),
  ) {
    super({ contact: null, nickname: '', loading: true, action: '', error: '', done: false });
  }
  start = () => {
    this.stop?.();
    this.stopDetails?.();
    const generation = ++this.generation;
    this.update({ loading: true, error: '' });
    let detailIdentity: string | undefined;
    let refreshed: Contact | undefined;
    this.stop = this.observe(
      this.userId,
      (contacts) => {
        if (generation !== this.generation) return;
        const contact = contacts.find((item) => item.id === this.contactId);
        if (!contact) {
          this.detailVersion++;
          this.stopDetails?.();
          this.stopDetails = undefined;
          detailIdentity = undefined;
          refreshed = undefined;
          this.update({
            contact: null,
            loading: false,
            error: 'This contact is no longer available.',
          });
          return;
        }
        const identity = JSON.stringify([contact.peerId, contact.requestId]);
        if (detailIdentity !== identity) refreshed = undefined;
        this.update({
          contact: refreshed ? { ...refreshed, name: contact.name } : contact,
          loading: false,
          ...(!this.dirty ? { nickname: contact.name } : {}),
        });
        if (detailIdentity === identity) return;
        detailIdentity = identity;
        const detailVersion = ++this.detailVersion;
        this.stopDetails?.();
        this.stopDetails = this.repository.observeDetails?.(
          this.userId,
          contact,
          (details) => {
            if (generation === this.generation && detailVersion === this.detailVersion) {
              refreshed = details;
              this.update({
                contact: { ...details, name: this.state.contact?.name ?? details.name },
              });
            }
          },
          (error) => {
            if (generation === this.generation && detailVersion === this.detailVersion)
              this.update({ error: contactErrorMessage(error) });
          },
        );
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
    if (nickname === this.state.contact.name) {
      this.update({ done: true, error: '' });
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
    this.stopDetails?.();
    this.stopDetails = undefined;
  };
}
