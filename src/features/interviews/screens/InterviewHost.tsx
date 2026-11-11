import React, { useSyncExternalStore } from 'react';
import { useInterviewModel } from '../bindings/InterviewsProvider';
import { InterviewTone } from '../views/InterviewTone';
import { InterviewView } from '../views/InterviewView';

export function InterviewHost() {
  const model = useInterviewModel();
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  if (state.phase === 'idle') return null;
  return (
    <>
      {(state.phase === 'incoming' || state.phase === 'outgoing') && (
        <InterviewTone incoming={state.phase === 'incoming'} />
      )}
      <InterviewView state={state} commands={model} />
    </>
  );
}
