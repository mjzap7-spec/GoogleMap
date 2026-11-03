import type { AuthUser } from '../../auth/models/auth';
import type { TravelPoint } from '../../map/models/travel';
import {
  normalizeContactEmail,
  ContactFailure,
  type ContactRequest,
  type SharedMapUser,
  type ContactFocus,
  contactErrorMessage,
  type Contact,
  type ContactEvent,
  type ContactRepository,
} from '../models/contact';
import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
export interface ContactsState {
  selectedUser: SharedMapUser | null;
  mapRequestBusy: boolean;
  mapRequestError: string;
  requestedUserIds: string[];
  contacts: Contact[];
  requests: ContactRequest[];
  events: ContactEvent[];
  notificationError: string;
  inboxOpen: boolean;
  email: string;
  notice: string;
  actionId: string;
  requestAction: '' | 'agree' | 'disagree';
  nearby: SharedMapUser[];
  nearbyError: string;
  showNearby: boolean;
  sharingError: string;
  focus: ContactFocus | null;

  loading: boolean;
  loadError: string;
  name: string;
  formOpen: boolean;
  busy: boolean;
  error: string;
}
export class ContactsViewModel extends ObservableViewModel<ContactsState> {
  private eventsStop?: () => void;
  private requestsStop?: () => void;
  private nearbyStop?: () => void;
  private nearbyVersion = 0;
  private heartbeat?: ReturnType<typeof setInterval>;
  private position: TravelPoint | null = null;
  private center: TravelPoint | null = null;
  private foreground = false;
  private desiredPresence: TravelPoint | null = null;
  private presenceRevision = 0;
  private pumping = false;
  private lastPublish = 0;
  private userKey = '';
  private selfUser?: AuthUser;
  private focusRevision = 0;
  private generation = 0;
  private stop?: () => void;
  constructor(
    private repository: ContactRepository,
    private userId: string,
  ) {
    super({
      selectedUser: null,
      mapRequestBusy: false,
      mapRequestError: '',
      requestedUserIds: [],
      contacts: [],
      requests: [],
      events: [],
      notificationError: '',
      inboxOpen: false,
      email: '',
      notice: '',
      actionId: '',
      requestAction: '',
      nearby: [],
      nearbyError: '',
      showNearby: false,
      sharingError: '',
      focus: null,
      loading: true,
      loadError: '',
      name: '',
      formOpen: false,
      busy: false,
      error: '',
    });
  }
  private stopNearby() {
    this.nearbyVersion++;
    const stop = this.nearbyStop;
    this.nearbyStop = undefined;
    this.center = null;
    stop?.();
  }
  start = () => {
    if (this.state.busy || this.state.actionId || this.state.mapRequestBusy) return;
    this.stopNearby();
    this.stop?.();
    this.requestsStop?.();
    this.eventsStop?.();
    const generation = ++this.generation;
    this.update({ loading: true, loadError: '', error: '', notificationError: '' });
    this.stop = this.repository.observe(
      this.userId,
      (contacts) => {
        if (generation === this.generation)
          this.update({
            contacts,
            loading: false,
            loadError: '',
            requestedUserIds: this.state.requestedUserIds.filter(
              (id) => !contacts.some((contact) => contact.peerId === id),
            ),
          });
      },
      (error) => {
        if (generation === this.generation)
          this.update({ loading: false, loadError: contactErrorMessage(error) });
      },
    );
    if (this.repository.observeRequests) {
      try {
        this.requestsStop = this.repository.observeRequests(
          this.userId,
          (requests) => {
            if (generation === this.generation)
              this.update({
                requests,
                inboxOpen:
                  this.state.inboxOpen ||
                  requests.some(
                    (item) => !this.state.requests.some((previous) => previous.id === item.id),
                  ),
              });
          },
          (error) => {
            if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
          },
        );
      } catch (error) {
        this.update({ error: contactErrorMessage(error) });
      }
    }
    if (this.repository.observeEvents) {
      this.eventsStop = this.repository.observeEvents(
        this.userId,
        (events) => {
          if (generation !== this.generation) return;
          this.update({
            events,
            notificationError: '',
            inboxOpen:
              this.state.inboxOpen ||
              events.some(
                (event) => !this.state.events.some((previous) => previous.id === event.id),
              ),
          });
        },
        (error) => {
          if (generation === this.generation)
            this.update({ notificationError: contactErrorMessage(error) });
        },
      );
    }
    this.setPosition(this.position, this.foreground);
    if (this.selfUser && !this.userKey) void this.registerUser(this.selfUser);
  };
  registerUser = async (user: AuthUser) => {
    if (user.id !== this.userId) return;
    this.selfUser = user;
    const key = [user.id, user.email, user.fullName, user.avatarUrl].join('|');
    if (this.userKey === key || !this.repository.registerSelf) return;
    this.userKey = key;
    const generation = this.generation;
    try {
      await this.repository.registerSelf(user);
    } catch (error) {
      if (generation === this.generation) {
        this.userKey = '';
        this.update({ error: contactErrorMessage(error) });
      }
    }
  };
  selectMapUser = (id: string) => {
    if (this.state.mapRequestBusy) return;
    const user =
      this.state.nearby.find((item) => item.id === id) ??
      (this.state.focus?.id === id ? this.state.focus : null);
    if (!user || id === this.userId || user.expiresAt <= Date.now()) return;
    this.update({ selectedUser: user, mapRequestError: '', formOpen: false });
  };
  closeMapUser = () => {
    if (!this.state.mapRequestBusy) this.update({ selectedUser: null, mapRequestError: '' });
  };
  requestSelectedUser = async () => {
    const user = this.state.selectedUser;
    if (
      !user ||
      this.state.mapRequestBusy ||
      this.state.loading ||
      this.state.loadError ||
      this.state.contacts.some((item) => item.peerId === user.id) ||
      this.state.requestedUserIds.includes(user.id)
    )
      return;
    if (user.expiresAt <= Date.now()) {
      this.update({ mapRequestError: 'This user is not sharing a recent location.' });
      return;
    }
    const generation = this.generation;
    this.update({ mapRequestBusy: true, mapRequestError: '' });
    try {
      if (!this.repository.sendRequestToUser)
        throw new ContactFailure('Update the app to send requests.');
      await this.repository.sendRequestToUser(this.userId, user.id);
      if (generation === this.generation)
        this.update({
          requestedUserIds: [...this.state.requestedUserIds, user.id],
          notice: 'Contact request sent.',
        });
    } catch (error) {
      if (generation === this.generation)
        this.update({ mapRequestError: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ mapRequestBusy: false });
    }
  };
  dismissEvent = async (id: string) => {
    if (this.state.actionId || !this.repository.dismissEvent) return;
    const generation = this.generation;
    this.update({ actionId: id, error: '' });
    try {
      await this.repository.dismissEvent(this.userId, id);
      if (generation === this.generation)
        this.update({ events: this.state.events.filter((event) => event.id !== id) });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ actionId: '' });
    }
  };
  openInbox = () => {
    if (this.state.notificationError) this.start();
    this.update({ inboxOpen: true });
  };
  closeInbox = () => this.update({ inboxOpen: false });
  setEmail = (email: string) => {
    if (!this.state.busy) this.update({ email, error: '', notice: '' });
  };
  sendRequest = async () => {
    if (this.state.busy || !this.state.formOpen) return;
    let email: string;
    try {
      email = normalizeContactEmail(this.state.email);
    } catch (error) {
      this.update({ error: contactErrorMessage(error) });
      return;
    }
    const generation = this.generation;
    this.update({ busy: true, error: '', notice: '' });
    try {
      if (!this.repository.sendRequest)
        throw new ContactFailure('Update the app to send requests.');
      await this.repository.sendRequest(this.userId, email);
      if (generation === this.generation)
        this.update({ formOpen: false, email: '', notice: 'Contact request sent.' });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  };
  respond = async (request: ContactRequest, accept: boolean) => {
    if (this.state.actionId || !this.repository.respond) return;
    const generation = this.generation;
    this.update({ actionId: request.id, requestAction: accept ? 'agree' : 'disagree', error: '' });
    try {
      await this.repository.respond(this.userId, request, accept);
      if (generation === this.generation)
        this.update({
          requests: this.state.requests.filter((item) => item.id !== request.id),
          notice: accept ? 'Contact added.' : 'Request declined.',
        });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ actionId: '', requestAction: '' });
    }
  };
  locateContact = async (contact: Contact) => {
    if (this.state.actionId) return;
    if (!contact.peerId) {
      this.update({ error: 'This contact has no shared GPS location.' });
      return;
    }
    const generation = this.generation;
    this.update({ actionId: 'locate:' + contact.id, error: '', notice: '' });
    try {
      const cached = this.state.nearby.find(
        (user) => user.id === contact.peerId && user.expiresAt > Date.now(),
      );
      const location =
        cached ?? (await this.repository.sharedLocation?.(this.userId, contact.peerId));
      if (generation !== this.generation) return;
      if (!location) throw new ContactFailure('This user is not sharing a recent location.');
      this.update({
        focus: { ...location, nickname: contact.name, revision: ++this.focusRevision },
      });
    } catch (error) {
      if (generation === this.generation) this.update({ error: contactErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ actionId: '' });
    }
  };
  setPosition = (point: TravelPoint | null, active: boolean) => {
    const wasActive = this.foreground && !!this.position;
    this.position = point;
    this.foreground = active;
    if (active && point) {
      if (!this.heartbeat)
        this.heartbeat = setInterval(() => {
          if (this.foreground && this.position) this.queuePresence(this.position);
        }, 30000);
      if (!wasActive || Date.now() - this.lastPublish > 15000) this.queuePresence(point);
    } else {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
      if (wasActive || this.desiredPresence) this.queuePresence(null);
    }
    if (!active || !point || !this.state.showNearby) {
      this.stopNearby();
      this.update({
        nearby: this.state.nearby.length ? [] : this.state.nearby,
        selectedUser:
          active && point && this.state.selectedUser?.id === this.state.focus?.id
            ? this.state.selectedUser
            : null,
        focus:
          this.state.focus && this.state.focus.expiresAt > Date.now() ? this.state.focus : null,
      });
      return;
    }
    if (
      this.repository.observeNearby &&
      (!this.center ||
        Math.hypot(point.latitude - this.center.latitude, point.longitude - this.center.longitude) >
          0.002)
    ) {
      this.stopNearby();
      this.center = point;
      const nearbyVersion = this.nearbyVersion;
      const generation = this.generation;
      try {
        this.nearbyStop = this.repository.observeNearby(
          this.userId,
          point,
          (users) => {
            if (
              generation !== this.generation ||
              nearbyVersion !== this.nearbyVersion ||
              !this.state.showNearby ||
              !this.foreground
            )
              return;
            const now = Date.now();
            const freshUsers = users.filter((user) => user.expiresAt > now);
            const nearby = sameMapUsers(this.state.nearby, freshUsers)
              ? this.state.nearby
              : freshUsers;
            const selectedId = this.state.selectedUser?.id;
            const focusedUser = this.state.focus;
            this.update({
              nearby,
              selectedUser: this.state.selectedUser
                ? (nearby.find((user) => user.id === selectedId) ??
                  (focusedUser && focusedUser.id === selectedId && focusedUser.expiresAt > now
                    ? focusedUser
                    : null))
                : null,
              nearbyError: '',
              ...(this.state.focus && this.state.focus.expiresAt < Date.now()
                ? { focus: null }
                : {}),
            });
          },
          (error) => {
            if (generation === this.generation && nearbyVersion === this.nearbyVersion)
              this.update({ nearbyError: contactErrorMessage(error) });
          },
        );
      } catch (error) {
        this.update({ nearbyError: contactErrorMessage(error) });
      }
    }
  };
  setShowNearby = (showNearby: boolean) => {
    this.update({ showNearby, nearbyError: '' });
    this.setPosition(this.position, this.foreground);
  };
  retryNearby = () => {
    if (!this.state.showNearby) return;
    this.stopNearby();
    this.update({ nearbyError: '', sharingError: '' });
    this.setPosition(this.position, this.foreground);
    if (this.position && this.foreground) this.queuePresence(this.position);
  };
  private queuePresence(point: TravelPoint | null) {
    if (point) this.lastPublish = Date.now();
    this.desiredPresence = point;
    this.presenceRevision++;
    void this.pumpPresence();
  }
  private async pumpPresence() {
    if (this.pumping || !this.repository.publishPresence) return;
    this.pumping = true;
    let processed = -1;
    try {
      while (processed !== this.presenceRevision) {
        processed = this.presenceRevision;
        const point = this.desiredPresence;
        const generation = this.generation;
        try {
          await this.repository.publishPresence(this.userId, point);
          this.lastPublish = Date.now();
          if (generation === this.generation) this.update({ sharingError: '' });
        } catch (error) {
          if (generation === this.generation)
            this.update({ sharingError: contactErrorMessage(error) });
        }
      }
    } finally {
      this.pumping = false;
    }
  }
  openForm = () => {
    if (!this.state.busy)
      this.update({ formOpen: true, name: '', email: '', error: '', notice: '' });
  };
  cancel = () => {
    if (!this.state.busy) this.update({ formOpen: false, name: '', error: '' });
  };
  setName = (name: string) => {
    if (!this.state.busy) this.update({ name, error: '' });
  };
  save = async () => {
    if (this.state.busy || !this.state.formOpen) return;
    const name = this.state.name.trim();
    if (!name || name.length > 100) {
      this.update({ error: 'Enter a contact name (up to 100 characters).' });
      return;
    }
    const generation = this.generation;
    this.update({ busy: true, error: '' });
    try {
      const contact = await this.repository.add(this.userId, name);
      if (generation === this.generation) {
        const contacts = [
          ...this.state.contacts.filter((item) => item.id !== contact.id),
          contact,
        ].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        this.update({ contacts, formOpen: false, name: '', busy: false });
      }
    } catch (error) {
      if (generation === this.generation)
        this.update({ busy: false, error: contactErrorMessage(error) });
    }
  };
  dispose = () => {
    this.generation++;
    this.stop?.();
    this.stop = undefined;
    this.requestsStop?.();
    this.eventsStop?.();
    this.stopNearby();
    clearInterval(this.heartbeat);
    if (this.foreground || this.desiredPresence || this.pumping) this.queuePresence(null);
    this.foreground = false;
    this.position = null;
    this.update({ showNearby: false });
  };
}

function sameMapUsers(first: readonly SharedMapUser[], second: readonly SharedMapUser[]) {
  return (
    first.length === second.length &&
    first.every((user, index) => {
      const other = second[index];
      return (
        user.id === other.id &&
        user.nickname === other.nickname &&
        user.avatarUrl === other.avatarUrl &&
        user.latitude === other.latitude &&
        user.longitude === other.longitude &&
        user.expiresAt === other.expiresAt
      );
    })
  );
}
