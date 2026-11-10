import type { ContactsState } from './ContactsViewModel';

/** List and badge consumers do not need nearby positions, map focus or form drafts. */
export const selectContactDirectory = (state: Readonly<ContactsState>) => ({
  contacts: state.contacts,
  loading: state.loading,
  loadError: state.loadError,
});
export const selectContactList = (state: Readonly<ContactsState>) => ({
  ...selectContactDirectory(state),
  requests: state.requests,
  events: state.events,
  actionId: state.actionId,
});
export type ContactListState = ReturnType<typeof selectContactList>;
export const selectContacts = (state: Readonly<ContactsState>) => state.contacts;
export const selectNearbyEnabled = (state: Readonly<ContactsState>) => state.showNearby;
export const selectContactOverlays = (state: Readonly<ContactsState>) => ({
  contacts: state.contacts,
  loading: state.loading,
  loadError: state.loadError,
  requests: state.requests,
  events: state.events,
  inboxOpen: state.inboxOpen,
  inboxManual: state.inboxManual,
  formOpen: state.formOpen,
  email: state.email,
  busy: state.busy,
  error: state.error,
  actionId: state.actionId,
  requestAction: state.requestAction,
  notificationError: state.notificationError,
  selectedUser: state.selectedUser,
  requestedUserIds: state.requestedUserIds,
  mapRequestBusy: state.mapRequestBusy,
  mapRequestError: state.mapRequestError,
});
export type ContactOverlayState = ReturnType<typeof selectContactOverlays>;
