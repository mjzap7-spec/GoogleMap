import { useMemo } from 'react';
import { useContactsSelection } from '../../contacts/bindings/ContactsProvider';
import { selectContacts } from '../../contacts/viewmodels/contactSelectors';
import { useSharingGroups } from '../../contacts/bindings/SharingProvider';
import { personChats } from '../models/personChats';
import { useUnreadChats } from './UnreadChatsProvider';

export function usePersonChats() {
  const { state: contacts } = useContactsSelection(selectContacts);
  const {
    state: { groups },
    model,
  } = useSharingGroups();
  const {
    state: { counts },
  } = useUnreadChats();
  const uid = model.user.id;
  return useMemo(() => personChats(uid, contacts, groups, counts), [uid, contacts, groups, counts]);
}
