/** Small observable base shared by framework-independent ViewModels. */
export abstract class ObservableViewModel<State extends object> {
  private listeners = new Set<() => void>();
  protected state: Readonly<State>;
  protected constructor(initial: State) {
    this.state = Object.freeze(initial);
  }
  getSnapshot = (): Readonly<State> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  protected update(patch: Partial<State>) {
    const keys = Object.keys(patch) as (keyof State)[];
    if (!keys.some((key) => !Object.is(this.state[key], patch[key]))) return;
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }
}
