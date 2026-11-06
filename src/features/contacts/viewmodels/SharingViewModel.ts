import { NoticeViewModel } from '../../../shared/feedback/NoticeViewModel';
import type { AuthUser } from '../../auth/models/auth';
import { distanceMeters, type TravelPoint } from '../../map/models/travel';
import {
  sharingMessage,
  sharedTripTrail,
  type SharingRepository,
  type SharingPreferences,
  type PrivateGroup,
  type GroupSummary,
  type DirectoryGroup,
  type GroupLocation,
} from '../models/sharing';
const tripFixMaxAge = 60000;
const tripPublishInterval = 2000;
export interface SharingState {
  preferences: SharingPreferences;
  ready: boolean;
  groups: PrivateGroup[];
  membershipsLoaded: boolean;
  directoryLoaded: boolean;
  directory: DirectoryGroup[];
  selectedId: string;
  locations: GroupLocation[];
  tripGroupId: string;
  busy: boolean;
  action: string;
  error: string;
  name: string;
  notice: string;
  focus: (GroupLocation & { revision: number }) | null;
}
export class SharingViewModel extends NoticeViewModel<SharingState> {
  private stops: (() => void)[] = [];
  private locationFeeds = new Map<string, { stop?: () => void; rows: GroupLocation[] }>();
  private lastPositionPublish = 0;
  private lastGroupPoint: TravelPoint | null = null;
  private lastTripPoint: TravelPoint | null = null;
  private lastTripPublish = 0;
  private tripTimer?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;
  private focusRevision = 0;
  private point: TravelPoint | null = null;
  private trail: readonly (readonly TravelPoint[])[] = [];
  private active = false;
  private tripStartedAt = 0;
  private generation = 0;
  private dirty = new Set<string>();
  private publishing = new Set<string>();
  private published = new Set<string>();
  constructor(
    private repository: SharingRepository | undefined,
    public user: AuthUser,
  ) {
    super({
      preferences: { nearby: false, groups: false },
      ready: false,
      groups: [],
      membershipsLoaded: false,
      directoryLoaded: false,
      directory: [],
      selectedId: '',
      locations: [],
      tripGroupId: '',
      busy: false,
      action: '',
      error: '',
      name: '',
      notice: '',
      focus: null,
    });
  }
  setUser = (user: AuthUser) => {
    if (user.id !== this.user.id) return;
    const changed = this.user.fullName !== user.fullName || this.user.avatarUrl !== user.avatarUrl;
    this.user = user;
    if (changed) this.queue();
  };
  start = () => {
    if (this.state.busy) return;
    this.stops.forEach((stop) => stop());
    this.stopLocationFeeds();
    this.update({ error: '', selectedId: '', locations: [], focus: null });
    const version = ++this.generation;
    if (!this.repository) return;
    const error = (reason: unknown) => {
      if (version === this.generation) this.update({ error: sharingMessage(reason) });
    };
    this.stops = [
      this.repository.observeDirectory(
        this.user.id,
        (directory) => {
          if (version === this.generation) this.update({ directory, directoryLoaded: true });
        },
        error,
      ),
      this.repository.observePreferences(
        this.user.id,
        (preferences) => {
          if (version !== this.generation) return;
          this.update({ preferences, ready: true });
          this.queue();
        },
        error,
      ),
      this.repository.observeGroups(
        this.user.id,
        (groups) => {
          if (version !== this.generation) return;
          this.update({ groups, membershipsLoaded: true });
          this.syncLocationFeeds(groups);
          if (
            !groups.some(
              (group) =>
                group.id === this.state.selectedId && group.joinedIds.includes(this.user.id),
            )
          )
            this.selectGroup('');
          if (
            this.state.tripGroupId &&
            !groups.some(
              (group) =>
                group.id === this.state.tripGroupId && group.joinedIds.includes(this.user.id),
            )
          )
            this.endTrip();
          this.queue();
        },
        error,
      ),
    ];
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.refreshLocations();
      this.queue();
    }, 30000);
  };
  private run = async <T>(action: (current: () => boolean) => Promise<T>, key = '') => {
    if (this.state.busy) return;
    if (!this.repository) {
      this.update({ error: 'Could not update sharing. Try again.' });
      return;
    }
    const version = this.generation;
    this.update({ busy: true, action: key, error: '', notice: '' });
    try {
      return await action(() => version === this.generation);
    } catch (error) {
      if (version === this.generation) this.update({ error: sharingMessage(error) });
    } finally {
      if (version === this.generation) this.update({ busy: false, action: '' });
    }
  };
  setName = (name: string) => this.update({ name });
  create = () =>
    this.run(async (current) => {
      const name = this.state.name.trim();
      if (!name || name.length > 60) throw new Error('Enter a group name (up to 60 characters).');
      const id = await this.repository!.createGroup(this.user.id, name);
      if (!current()) return;
      this.update({ name: '', notice: 'Group created. Invite your contacts.' });
      this.selectGroup(id);
      return id;
    }, 'create');
  savePreferences = (preferences: SharingPreferences) =>
    // The listener also receives edits from other devices while a save is pending.
    // Keep it as the source for both the switch value and location publishing.
    this.run(() => this.repository!.savePreferences(this.user.id, preferences), 'preferences');
  invite = (group: PrivateGroup, peerId: string) =>
    this.run(async (current) => {
      await this.repository?.invite(this.user.id, group, peerId);
      if (current()) this.update({ notice: 'Group invitation sent.' });
    }, 'invite:' + peerId);
  join = (group: GroupSummary) =>
    this.run(async (current) => {
      await this.repository?.join(this.user, group);
      if (current()) this.selectGroup(group.id);
    }, 'join:' + group.id);
  leave = (group: PrivateGroup) =>
    this.run(async () => {
      await this.repository?.leave(this.user.id, group);
    });
  selectGroup = (selectedId: string) => {
    this.update({ selectedId });
  };
  private stopLocationFeeds() {
    const feeds = [...this.locationFeeds.values()];
    this.locationFeeds.clear();
    for (const feed of feeds) feed.stop?.();
  }
  private syncLocationFeeds(groups: PrivateGroup[]) {
    const joined = groups.filter((group) => group.joinedIds.includes(this.user.id));
    const ids = new Set(joined.map((group) => group.id));
    for (const [id, feed] of this.locationFeeds) {
      if (ids.has(id)) continue;
      this.locationFeeds.delete(id);
      feed.stop?.();
    }
    for (const group of joined) {
      if (this.locationFeeds.has(group.id)) continue;
      const feed: { stop?: () => void; rows: GroupLocation[] } = { rows: [] };
      this.locationFeeds.set(group.id, feed);
      feed.stop = this.repository!.observeLocations(
        this.user.id,
        group.id,
        (locations) => {
          if (this.locationFeeds.get(group.id) !== feed) return;
          feed.rows = locations.map((location) => ({ ...location, groupId: group.id }));
          this.refreshLocations();
        },
        (error) => {
          if (this.locationFeeds.get(group.id) !== feed) return;
          feed.rows = [];
          this.refreshLocations();
          this.update({ error: sharingMessage(error) });
        },
      );
    }
    this.refreshLocations();
  }
  private refreshLocations() {
    const now = Date.now();
    const locations = this.state.groups
      .flatMap((group) => {
        const feed = this.locationFeeds.get(group.id);
        return (
          feed?.rows.filter((row) => row.expiresAt > now && group.joinedIds.includes(row.id)) ?? []
        );
      })
      .sort((a, b) => b.expiresAt - a.expiresAt);
    const previous = this.state.focus;
    const live =
      previous &&
      locations.find((row) => row.id === previous.id && row.groupId === previous.groupId);
    this.update({ locations, focus: live ? { ...live, revision: previous!.revision } : null });
  }
  clearFocus = () => this.update({ focus: null });
  focusLocation = (location: GroupLocation) => {
    const live = this.state.locations.find(
      (row) =>
        row.id === location.id && row.groupId === location.groupId && row.expiresAt > Date.now(),
    );
    if (live) this.update({ focus: { ...live, revision: 1000000 + ++this.focusRevision } });
  };
  focusMember = (peerId?: string) => {
    const live = this.state.locations.find(
      (row) => row.id === peerId && row.expiresAt > Date.now(),
    );
    if (!live) return false;
    this.focusLocation(live);
    return true;
  };
  startTrip = (group: PrivateGroup) => {
    if (this.state.busy || this.state.tripGroupId === group.id) return;
    if (!this.active) {
      this.update({ error: 'Enable GPS before sharing a trip.' });
      return;
    }
    if (
      !this.state.groups.some(
        (current) => current.id === group.id && current.joinedIds.includes(this.user.id),
      )
    )
      return;
    this.tripStartedAt = Date.now();
    this.resetTripSchedule();
    this.update({ tripGroupId: group.id, notice: 'Trip sharing started.', error: '' });
    this.queue();
  };
  stopTrip = () => {
    this.endTrip();
    this.update({ notice: 'Trip sharing stopped.' });
    this.queue();
  };
  private endTrip() {
    this.resetTripSchedule();
    this.update({ tripGroupId: '' });
  }
  private resetTripSchedule() {
    clearTimeout(this.tripTimer);
    this.tripTimer = undefined;
    this.lastTripPoint = this.point;
    this.lastTripPublish = Date.now();
  }
  private scheduleTripUpdate() {
    const id = this.state.tripGroupId;
    if (!id || !this.point || !this.active) return;
    if (Date.now() - this.point.timestamp > tripFixMaxAge) return;
    if (
      this.lastTripPoint &&
      this.point.timestamp - this.lastTripPoint.timestamp < tripFixMaxAge &&
      distanceMeters(this.lastTripPoint, this.point) < 5
    )
      return;
    const remaining = Math.min(
      tripPublishInterval,
      this.lastTripPublish + tripPublishInterval - Date.now(),
    );
    if (remaining <= 0) {
      this.resetTripSchedule();
      this.queue(id);
    } else if (!this.tripTimer) {
      this.tripTimer = setTimeout(() => {
        this.tripTimer = undefined;
        this.scheduleTripUpdate();
      }, remaining);
    }
  }
  setPosition = (
    point: TravelPoint | null,
    trail: readonly (readonly TravelPoint[])[],
    active: boolean,
  ) => {
    const wasReady = this.active && !!this.point;
    this.point = point;
    this.trail = trail;
    this.active = active;
    const isReady = active && !!point;
    if (
      wasReady !== isReady ||
      (point &&
        isReady &&
        this.state.preferences.groups &&
        this.lastGroupPoint &&
        distanceMeters(this.lastGroupPoint, point) >= 20 &&
        Date.now() - this.lastPositionPublish >= 10000)
    ) {
      this.lastPositionPublish = Date.now();
      this.lastGroupPoint = point;
      this.resetTripSchedule();
      this.queue();
    } else this.scheduleTripUpdate();
  };
  private queue(groupId?: string) {
    const targets = groupId
      ? [groupId]
      : new Set([
          ...this.published,
          ...this.publishing,
          ...this.state.groups
            .filter(
              (g) =>
                this.active &&
                this.point &&
                g.joinedIds.includes(this.user.id) &&
                (this.state.preferences.groups || g.id === this.state.tripGroupId),
            )
            .map((g) => g.id),
        ]);
    for (const id of targets) {
      this.dirty.add(id);
      void this.pump(id);
    }
  }
  private shouldPublish(id: string) {
    return (
      this.active &&
      !!this.point &&
      (id !== this.state.tripGroupId || Date.now() - this.point.timestamp <= tripFixMaxAge) &&
      (this.state.preferences.groups || id === this.state.tripGroupId) &&
      this.state.groups.some((g) => g.id === id && g.joinedIds.includes(this.user.id))
    );
  }
  private async pump(id: string) {
    if (this.publishing.has(id) || !this.repository) return;
    this.publishing.add(id);
    try {
      while (this.dirty.delete(id)) {
        const version = this.generation;
        const sendPoint = this.shouldPublish(id) ? this.point : null;
        try {
          const trip = id === this.state.tripGroupId;
          const trail = trip && sendPoint ? sharedTripTrail(this.trail, this.tripStartedAt) : [];
          await this.repository.publish(this.user, id, sendPoint, trail, trip);
          if (sendPoint) this.published.add(id);
          else this.published.delete(id);
        } catch (error) {
          if (version === this.generation) this.update({ error: sharingMessage(error) });
        }
      }
    } finally {
      this.publishing.delete(id);
    }
  }
  dispose = () => {
    this.generation++;
    this.stops.forEach((stop) => stop());
    this.stopLocationFeeds();
    this.update({ locations: [], focus: null });
    clearInterval(this.timer);
    this.active = false;
    this.endTrip();
    this.queue();
  };
}
