/** Keep a selected snapshot stable when unrelated ViewModel fields change. */
export function selectSnapshot<State, Selection>(
  getSnapshot: () => State,
  select: (state: State) => Selection,
  equal: (previous: Selection, next: Selection) => boolean = Object.is,
): () => Selection {
  let cached: { state: State; selection: Selection } | undefined;
  return () => {
    const state = getSnapshot();
    if (cached && Object.is(cached.state, state)) return cached.selection;
    const next = select(state);
    const selection = cached && equal(cached.selection, next) ? cached.selection : next;
    cached = { state, selection };
    return selection;
  };
}
