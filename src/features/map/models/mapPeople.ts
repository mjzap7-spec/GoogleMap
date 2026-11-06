import type { Contact, ContactFocus } from '../../contacts/models/contact';
import type { GroupLocation } from '../../contacts/models/sharing';
import type { MapUserMarker } from './map';
import type { TravelPoint } from './travel';

function visibleTripTrails(trips: GroupLocation[]) {
  const routes = trips.filter((trip) => trip.trail.some((segment) => segment.length >= 2));
  if (routes.length <= 1) return routes[0]?.trail;
  // Keep separate legs for each traveler, inside the renderer's total 500-point budget.
  const budget = Math.max(2, Math.floor(500 / routes.length));
  const result: (readonly TravelPoint[])[] = [];
  for (const trip of routes.slice(0, Math.floor(500 / budget))) {
    let remaining = budget;
    for (let i = trip.trail.length - 1; i >= 0 && remaining >= 2; i--) {
      const segment = trip.trail[i];
      if (segment.length < 2) continue;
      const tail = segment.length <= remaining ? segment : segment.slice(-remaining);
      result.push(tail);
      remaining -= tail.length;
    }
  }
  return result;
}

/** The viewer switch applies to every real-person overlay, including a previously focused trip. */
export function mapPeople(
  showNearby: boolean,
  ownId: string,
  nearby: readonly MapUserMarker[],
  groupLocations: readonly GroupLocation[],
  groupFocus: (GroupLocation & { revision: number }) | null,
  contactFocus: ContactFocus | null,
  contacts: readonly Contact[],
) {
  if (!showNearby) return { users: [], focus: null, sharedTrail: undefined };
  const now = Date.now();
  const trips = new Map<string, GroupLocation>();
  for (const location of groupLocations) {
    if (
      location.trip &&
      location.id !== ownId &&
      location.expiresAt > now &&
      !trips.has(location.id)
    )
      trips.set(location.id, location);
  }
  const selected = [groupFocus, contactFocus].find(
    (person) => person && person.id !== ownId && person.expiresAt > now,
  );
  const names = new Map(contacts.map((contact) => [contact.peerId, contact.name]));
  const people = new Map<string, MapUserMarker>();
  // Reserve space for the selected person and joined groups before filling the nearby layer.
  for (const person of [selected, ...trips.values(), ...groupLocations, ...nearby]) {
    if (!person || person.id === ownId || person.expiresAt <= now || people.has(person.id))
      continue;
    const { id, nickname, avatarUrl, latitude, longitude, expiresAt } =
      trips.get(person.id) ?? person;
    people.set(id, {
      id,
      nickname: names.get(id) ?? nickname,
      avatarUrl,
      latitude,
      longitude,
      expiresAt,
      ...(trips.has(id) && { trip: true }),
    });
    if (people.size === 500) break;
  }
  return {
    users: Array.from(people.values()),
    focus: selected ? { ...people.get(selected.id)!, revision: selected.revision } : null,
    sharedTrail:
      (selected && trips.get(selected.id)?.trail) ??
      visibleTripTrails([...trips.values()].filter((trip) => people.has(trip.id))),
  };
}
