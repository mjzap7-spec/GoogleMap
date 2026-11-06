import { ObservableViewModel } from '../mvvm/ObservableViewModel';

/** An action confirmation belongs to the action that produced it. The banner takes it once. */
export abstract class NoticeViewModel<
  State extends { notice: string },
> extends ObservableViewModel<State> {
  observeNotices = (show: (message: string) => void) => {
    const deliver = () => {
      const message = this.state.notice;
      if (!message) return;
      this.update({ ...this.state, notice: '' });
      show(message);
    };
    const unsubscribe = this.subscribe(deliver);
    deliver();
    return unsubscribe;
  };
}
