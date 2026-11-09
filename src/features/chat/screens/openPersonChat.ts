import { router } from 'expo-router';
export function openPersonChat(person: string) {
  // The chat workspace has the history needed to choose between a contact thread
  // and a private conversation inside a shared group. A zero badge is not history.
  router.push({ pathname: '/chat', params: { person } });
}
