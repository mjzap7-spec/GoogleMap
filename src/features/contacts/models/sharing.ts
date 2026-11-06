import type { AuthUser } from '../../auth/models/auth';
import type { TravelPoint } from '../../map/models/travel';

/** Only visit the newest recorded points. Each segment is a continuous GPS leg. */
export function sharedTripTrail(trail: readonly (readonly TravelPoint[])[], startedAt: number) {
  const legs: (readonly TravelPoint[])[] = [];
  let remaining = 500;
  for (let i = trail.length - 1; i >= 0 && remaining > 0; i--) {
    const leg = trail[i];
    if (!leg.length) continue;
    let first = leg.length;
    while (first > 0 && leg.length - first < remaining && leg[first - 1].timestamp >= startedAt)
      first--;
    if (first < leg.length) {
      legs.push(first === 0 ? leg : leg.slice(first));
      remaining -= leg.length - first;
    }
    if (first > 0) break;
  }
  return legs.reverse();
}
export interface SharingPreferences {
  nearby: boolean;
  groups: boolean;
}
/** Older clients could enable both audiences. Honor the narrower choice. */
export function sharingAudience(value?: Partial<SharingPreferences>): SharingPreferences {
  const groups = value?.groups === true;
  return { nearby: !groups && (value === undefined || value.nearby === true), groups };
}
export function changeSharingAudience(
  current: SharingPreferences,
  key: 'sharing' | 'groups',
  enabled: boolean,
): SharingPreferences {
  if (key === 'sharing')
    return { nearby: enabled && !current.groups, groups: enabled && current.groups };
  if (!enabled && !current.groups) return current;
  return { nearby: !enabled, groups: enabled };
}
export interface GroupSummary {
  id: string;
  name: string;
  creatorName?: string;
  createdAt?: number;
  memberCount?: number;
}
export interface PrivateGroup extends GroupSummary {
  ownerId: string;
  memberIds: string[];
  joinedIds: string[];
}
export interface DirectoryGroup extends GroupSummary {
  discoverable: true;
}
type GroupRow = PrivateGroup | DirectoryGroup;
export function groupList(
  groups: readonly PrivateGroup[],
  directory: readonly DirectoryGroup[],
  query: string,
): GroupRow[] {
  const term = query.trim().normalize('NFC').toLocaleLowerCase();
  const activeIds = new Set(groups.map((group) => group.id));
  const listings = new Map(directory.map((g) => [g.id, g]));
  return [
    ...groups.map((group) => {
      const info = listings.get(group.id);
      return {
        ...group,
        creatorName: info?.creatorName,
        createdAt: info?.createdAt,
        memberCount: group.joinedIds.length,
      };
    }),
    ...directory.filter((g) => !activeIds.has(g.id)),
  ].filter((group) => group.name.normalize('NFC').toLocaleLowerCase().includes(term));
}
export function groupSections(rows: readonly GroupRow[], userId: string) {
  const own = { key: 'own', title: 'Created by you', data: [] as GroupRow[] };
  const other = { key: 'other', title: 'Created by others', data: [] as GroupRow[] };
  // Owners are always members. The directory can stay free of account identifiers.
  for (const row of rows) {
    const section = 'ownerId' in row && row.ownerId === userId ? own : other;
    section.data.push(row);
  }
  return [own, other]
    .filter((section) => section.data.length > 0)
    .map((section) => {
      section.data.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      return section;
    });
}
export interface GroupLocation {
  groupId?: string;
  id: string;
  nickname: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  expiresAt: number;
  trip: boolean;
  trail: readonly (readonly TravelPoint[])[];
}
export interface SharingRepository {
  observePreferences(
    userId: string,
    next: (value: SharingPreferences) => void,
    error: (error: unknown) => void,
  ): () => void;
  savePreferences(userId: string, value: SharingPreferences): Promise<void>;
  observeGroups(
    userId: string,
    next: (groups: PrivateGroup[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  createGroup(userId: string, name: string): Promise<string>;
  observeDirectory(
    userId: string,
    next: (groups: DirectoryGroup[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  invite(userId: string, group: PrivateGroup, peerId: string): Promise<void>;
  join(user: AuthUser, group: GroupSummary): Promise<void>;
  leave(userId: string, group: PrivateGroup): Promise<void>;
  observeLocations(
    userId: string,
    groupId: string,
    next: (locations: GroupLocation[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  publish(
    user: AuthUser,
    groupId: string,
    point: TravelPoint | null,
    trail: readonly (readonly TravelPoint[])[],
    trip: boolean,
  ): Promise<void>;
}
export function sharingMessage(error: unknown) {
  return error instanceof Error && !('code' in error)
    ? error.message
    : 'Could not update sharing. Try again.';
}
