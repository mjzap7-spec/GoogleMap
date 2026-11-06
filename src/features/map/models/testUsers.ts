import type { MapUserMarker } from './map';
import type { TravelPoint } from './travel';
export type TestUserCount = 0 | 10 | 100 | 500;
export function isTestUserCount(value: number): value is TestUserCount {
  return value === 0 || value === 10 || value === 100 || value === 500;
}
/** Deterministic local fixtures include dense clusters and separated people within 1 km. */
export function createTestUsers(
  center: TravelPoint,
  count: TestUserCount,
  now: number,
): MapUserMarker[] {
  if (
    !Number.isFinite(center.latitude) ||
    !Number.isFinite(center.longitude) ||
    Math.abs(center.latitude) > 90 ||
    Math.abs(center.longitude) > 180
  )
    return [];
  const names = [
    'Alex',
    'Blair',
    'Casey',
    'Drew',
    'Emery',
    'Finley',
    'Gray',
    'Harper',
    'Indigo',
    'Jules',
  ];
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963229728653;
    const distance = index % 5 === 0 ? 35 : 180 + 650 * Math.sqrt((index + 1) / count);
    const angularDistance = distance / 6371000;
    const latitude = (center.latitude * Math.PI) / 180;
    const longitude = (center.longitude * Math.PI) / 180;
    const targetLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(angle),
    );
    const targetLongitude =
      longitude +
      Math.atan2(
        Math.sin(angle) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
      );
    return {
      id: 'demo-map-user-' + String(index + 1).padStart(3, '0'),
      nickname: names[index % names.length] + ' ' + String(index + 1).padStart(3, '0'),
      avatarUrl: null,
      latitude: (targetLatitude * 180) / Math.PI,
      longitude: (((targetLongitude * 180) / Math.PI + 540) % 360) - 180,
      expiresAt: now + 86400000,
    };
  });
}
