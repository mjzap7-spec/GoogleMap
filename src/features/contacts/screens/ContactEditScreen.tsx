import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/bindings/useSession';
import { useContactEditor } from '../bindings/useContactEditor';
import { ContactEditorView } from '../views/ContactEditorView';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
export function ContactEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useSession();
  return state.user && id ? (
    <Editor key={state.user.id + id} userId={state.user.id} contactId={id} />
  ) : null;
}
function Editor({ userId, contactId }: { userId: string; contactId: string }) {
  const binding = useContactEditor(userId, contactId);
  const transition = usePageTransition();
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  useEffect(() => {
    if (binding.state.done) back();
  }, [binding.state.done]);
  return (
    <PageSurface transition={transition}>
      <ContactEditorView {...binding} onBack={() => transition.navigate(back)} />
    </PageSurface>
  );
}
