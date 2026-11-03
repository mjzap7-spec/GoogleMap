import { ContactFailure } from '../models/contact';

/** Estimates Firebase time from a freshly issued ID token, never storing the token itself. */
export class ServerClock {
  private offset = 0;
  private synchronizedAt = -Infinity;
  private pending?: Promise<void>;
  constructor(
    private refresh: () => Promise<{ issuedAtTime: string }>,
    private localNow: () => number = () => Date.now(),
  ) {}
  now = () => this.localNow() + this.offset;
  localDeadline = (serverDeadline: number) => serverDeadline - this.offset;
  synchronize = (force = false): Promise<void> => {
    if (this.pending) return this.pending;
    const age = this.localNow() - this.synchronizedAt;
    if (!force && age >= 0 && age < 30000) return Promise.resolve();
    this.pending = this.refresh()
      .then((result) => {
        const serverTime = Date.parse(result.issuedAtTime);
        if (!Number.isFinite(serverTime))
          throw new ContactFailure(
            'Could not synchronize location sharing. Check your connection and retry.',
          );
        // Token issuance happens on Firebase's server, not on the device's wall clock.
        this.synchronizedAt = this.localNow();
        this.offset = serverTime - this.synchronizedAt;
      })
      .catch(() => {
        throw new ContactFailure(
          'Could not synchronize location sharing. Check your connection and retry.',
        );
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  };
}
