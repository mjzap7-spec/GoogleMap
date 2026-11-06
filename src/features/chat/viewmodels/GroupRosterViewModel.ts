import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { ChatRepository, MemberCard } from '../models/chat';

export class GroupRosterViewModel extends ObservableViewModel<{
  members: MemberCard[];
  error: boolean;
}> {
  private unsubscribe?: () => void;
  private version = 0;
  constructor(
    private repo: ChatRepository | undefined,
    private uid: string,
    private groupId: string,
  ) {
    super({ members: [], error: false });
  }
  start = () => {
    this.stop();
    if (!this.uid || !this.groupId) return;
    const version = this.version;
    const fail = () => {
      if (this.version === version) this.update({ members: [], error: true });
    };
    if (!this.repo) {
      fail();
      return;
    }
    try {
      this.unsubscribe = this.repo.members(
        this.uid,
        this.groupId,
        (members) => {
          if (this.version === version) this.update({ members, error: false });
        },
        fail,
      );
    } catch {
      fail();
    }
  };
  stop = () => {
    this.version++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  };
}
