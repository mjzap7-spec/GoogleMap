export interface TravelPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
}
export interface LocationTracker {
  refresh?(): void;
  describe?(point: TravelPoint): Promise<string>;
  watch(
    onPoint: (point: TravelPoint) => void,
    onError: (message: string) => void,
  ): Promise<() => void>;
}
export type TrackingStatus = 'idle' | 'requesting' | 'tracking' | 'paused' | 'error';
export function distanceMeters(a: TravelPoint, b: TravelPoint) {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
/** Filter GPS jitter and split gaps instead of inventing travelled connections. */
export class TravelRecorder {
  segments: readonly (readonly TravelPoint[])[] = [];
  live: TravelPoint | null = null;
  count = 0;
  private gap = true;
  constructor(private now: () => number = Date.now) {}
  breakSegment() {
    this.gap = true;
  }
  clear() {
    this.segments = [];
    this.live = null;
    this.count = 0;
    this.gap = true;
  }
  add(point: TravelPoint) {
    if (!isUsableTravelPoint(point, this.now()) || this.count >= 5000) return false;
    const previous = this.live;
    if (previous && point.timestamp <= previous.timestamp) return false;
    const meters = previous ? distanceMeters(previous, point) : 0;
    if (previous && !this.gap && meters < 5) return false;
    const seconds = previous ? (point.timestamp - previous.timestamp) / 1000 : 0;
    const newSegment = this.gap || !previous || seconds > 30 || meters / seconds > 80;
    const accepted = { ...point };
    const segments = [...this.segments];
    if (newSegment) segments.push([accepted]);
    else segments[segments.length - 1] = [...segments[segments.length - 1], accepted];
    this.segments = segments;
    this.live = accepted;
    this.count++;
    this.gap = false;
    return true;
  }
}

export function isUsableTravelPoint(point: TravelPoint, now = Date.now()): boolean {
  return !(
    ![point.latitude, point.longitude, point.timestamp].every(Number.isFinite) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180 ||
    point.accuracy === null ||
    !Number.isFinite(point.accuracy) ||
    point.accuracy < 0 ||
    point.accuracy > 50 ||
    now - point.timestamp > 20000 ||
    point.timestamp > now + 10000
  );
}
