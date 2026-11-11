import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Contact } from '../models/contact';

type ContactAction = (contact: Contact) => void;

/** Presentation-only handlers: stable identities, latest committed row data and callbacks. */
export function useContactRowActions(
  contacts: readonly Contact[],
  onSelect: ContactAction,
  onEdit: ContactAction,
  onChat: ContactAction,
  onCall: ContactAction,
) {
  const byId = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const latest = useRef({ byId, onSelect, onEdit, onChat, onCall });
  useLayoutEffect(() => {
    latest.current = { byId, onSelect, onEdit, onChat, onCall };
  }, [byId, onSelect, onEdit, onChat, onCall]);
  return useMemo(() => {
    const invoke = (action: 'onSelect' | 'onEdit' | 'onChat' | 'onCall', id: string) => {
      const current = latest.current;
      const contact = current.byId.get(id);
      if (contact) current[action](contact);
    };
    return {
      select: (id: string) => invoke('onSelect', id),
      edit: (id: string) => invoke('onEdit', id),
      chat: (id: string) => invoke('onChat', id),
      call: (id: string) => invoke('onCall', id),
    };
  }, []);
}
