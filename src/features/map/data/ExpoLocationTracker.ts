import type { LocationTracker, TravelPoint } from '../models/travel';
/** Device GPS only. No routing API, location uploads, or background permission. */
export class ExpoLocationTracker implements LocationTracker {
  refresh?: () => void;
  async describe(point: TravelPoint) {
    try {
      const location = await import('expo-location');
      const [address] = await location.reverseGeocodeAsync({
        latitude: point.latitude,
        longitude: point.longitude,
      });
      if (!address) return '';
      return [
        ...new Set(
          [
            address.city || address.district || address.subregion,
            address.region || address.country,
          ].filter((part): part is string => Boolean(part)),
        ),
      ].join(', ');
    } catch {
      return '';
    }
  }
  async watch(onPoint: (point: TravelPoint) => void, onError: (message: string) => void) {
    let location: typeof import('expo-location');
    try {
      // Start permission checks without waiting for a separate Metro bundle.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      location = require('expo-location');
    } catch {
      throw new Error('Rebuild the installed app to enable device location.');
    }
    if (!(await location.hasServicesEnabledAsync()))
      throw new Error('Turn on device location services, then tap Resume.');
    const permission = await location.requestForegroundPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        'Location permission is required. Allow location in app settings, then tap Resume.',
      );
    let active = true;
    let latestTimestamp = -Infinity;
    const deliver = (fix: import('expo-location').LocationObject) => {
      if (!active || fix.timestamp <= latestTimestamp) return;
      const accuracy = fix.coords.accuracy;
      if (
        accuracy === null ||
        !Number.isFinite(accuracy) ||
        accuracy > 50 ||
        accuracy < 0 ||
        Date.now() - fix.timestamp > 15000 ||
        fix.timestamp > Date.now() + 10000
      )
        return;
      latestTimestamp = fix.timestamp;
      onPoint({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy,
        timestamp: fix.timestamp,
      });
    };
    // Warm start and live subscription run together; a slow cache never delays GPS.
    void location
      .getLastKnownPositionAsync({ maxAge: 15000, requiredAccuracy: 50 })
      .then((fix) => {
        if (fix) deliver(fix);
      })
      .catch(() => {});
    try {
      const subscription = await location.watchPositionAsync(
        { accuracy: location.Accuracy.High, distanceInterval: 5, timeInterval: 1000 },
        deliver,
        () => {
          if (!active) return;
          active = false;
          onError('Location updates stopped. Check GPS and permissions, then tap Resume.');
        },
      );
      // Distance-based watches can stay silent when a traveler is standing still.
      let requestingFix = false;
      const refresh = () => {
        if (!active || requestingFix) return;
        requestingFix = true;
        void location
          .getCurrentPositionAsync({ accuracy: location.Accuracy.High })
          .then(deliver)
          .catch(() => {}) // A failed one-off fix leaves the foreground watch running.
          .finally(() => {
            requestingFix = false;
          });
      };
      this.refresh = refresh;
      return () => {
        active = false;
        if (this.refresh === refresh) this.refresh = undefined;
        subscription.remove();
      };
    } catch (error) {
      active = false;
      throw error;
    }
  }
}
