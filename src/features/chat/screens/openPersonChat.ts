import { router } from 'expo-router';
import type { PersonChat } from '../models/personChats';

export function openPersonChat(chat: PersonChat) {
  const { target } = chat;
  if ('contactId' in target)
    router.push({ pathname: '/chat/[id]', params: { id: target.contactId } });
  else
    router.push({ pathname: '/chat', params: { group: target.groupId, member: target.memberId } });
}
