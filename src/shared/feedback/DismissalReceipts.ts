interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
/** Explicit dismissal survives remounts and restarts; a resolved condition can notify again. */
export class DismissalReceipts {
  private known = new Map<string, boolean>();
  private writes = Promise.resolve();
  constructor(private storage: Storage) {}
  private key(scope: string, occurrence: string) {
    return 'feedback-dismissal:' + JSON.stringify([scope, occurrence]);
  }
  async has(scope: string, occurrence: string) {
    const key = this.key(scope, occurrence);
    if (this.known.has(key)) return this.known.get(key) === true;
    const stored = await this.storage.getItem(key).catch(() => null);
    if (!this.known.has(key)) this.known.set(key, stored === '1');
    return this.known.get(key) === true;
  }
  set(scope: string, occurrence: string, dismissed: boolean) {
    const key = this.key(scope, occurrence);
    if (this.known.get(key) === dismissed) return;
    this.known.set(key, dismissed);
    this.writes = this.writes
      .then(() => (dismissed ? this.storage.setItem(key, '1') : this.storage.removeItem(key)))
      .catch(() => {});
    return this.writes;
  }
}
