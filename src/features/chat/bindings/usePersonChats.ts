import { useMemo } from 'react';
import { useContactsContext } from '../../contacts/bindings/ContactsProvider';
import { useSharing } from '../../contacts/bindings/SharingProvider';
import { personChats } from '../models/personChats';
import { useUnreadChats } from './UnreadChatsProvider';

export function usePersonChats() {
  const {
    state: { contacts },
  } = useContactsContext();
  const {
    state: { groups },
    model,
  } = useSharing();
  const {
    state: { counts },
  } = useUnreadChats();
  const uid = model.user.id;
  return useMemo(() => personChats(uid, contacts, groups, counts), [uid, contacts, groups, counts]);
}
