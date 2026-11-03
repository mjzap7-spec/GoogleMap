import { useContactsContext } from './ContactsProvider';
export function useContacts() {
  const { state, commands } = useContactsContext();
  return { state, commands };
}
