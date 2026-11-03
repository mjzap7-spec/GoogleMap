import { TravelRecorder, isUsableTravelPoint, type LocationTracker } from '../models/travel';
import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import { isMapLanguage, type MapLanguage, type MapPreferences, type MapState } from '../models/map';

export class MapViewModel extends ObservableViewModel<MapState> {
  private stopLanguage?: () => void;
  private placeBusy = false;
  private lastPlacePoint: import('../models/travel').TravelPoint | null = null;
  private lastPlaceAt = 0;
  private recorder = new TravelRecorder();
  private trackingVersion = 0;
  private stopTracking?: () => void;
  private trackingWanted = true;
  private foreground = true;
  private generation = 0;
  private touchedLanguage = false;
  constructor(
    private preferences?: MapPreferences,
    private tracker?: LocationTracker,
    private now: () => number = Date.now,
  ) {
    super({
      language: 'en',
      tracking: 'idle',
      recording: false,
      trackingError: '',
      placeName: '',
      live: null,
      trail: [],
      recordedPoints: 0,
    });
  }
  start = () => {
    const generation = ++this.generation;
    this.stopLanguage?.();
    this.stopLanguage = this.preferences?.subscribeLanguage?.((language) => {
      if (generation === this.generation && isMapLanguage(language)) this.update({ language });
    });
    if (this.trackingWanted && this.foreground) void this.beginTracking();
    void this.preferences
      ?.readLanguage()
      .then((language) => {
        if (generation === this.generation && !this.touchedLanguage && isMapLanguage(language))
          this.update({ language });
      })
      .catch(() => {});
  };
  setLanguage = (language: MapLanguage) => {
    if (!isMapLanguage(language)) return;
    this.touchedLanguage = true;
    this.update({ language });
    void this.preferences?.writeLanguage(language).catch(() => {});
  };
  private stopWatcher() {
    this.trackingVersion++;
    this.stopTracking?.();
    this.stopTracking = undefined;
    this.recorder.breakSegment();
  }
  setForeground = (foreground: boolean) => {
    this.foreground = foreground;
    if (!foreground) {
      this.stopWatcher();
      this.update({ tracking: 'paused' });
    } else if (this.trackingWanted) void this.beginTracking();
  };
  pauseTracking = () => {
    this.trackingWanted = false;
    this.stopWatcher();
    this.update({ tracking: 'paused', trackingError: '' });
  };
  resumeTracking = () => {
    this.trackingWanted = true;
    if (this.foreground) void this.beginTracking();
  };
  toggleRecording = () => {
    if (this.state.recording) {
      this.recorder.breakSegment();
      this.update({ recording: false });
      return;
    }
    if (this.recorder.count >= 5000) return;
    this.recorder.breakSegment();
    this.update({ recording: true, trackingError: '' });
    if (
      this.state.live &&
      isUsableTravelPoint(this.state.live) &&
      this.recorder.add(this.state.live)
    )
      this.update({ trail: this.recorder.segments, recordedPoints: this.recorder.count });
    this.resumeTracking();
  };
  clearTrail = () => {
    this.recorder.clear();
    this.update({ trail: [], recordedPoints: 0 });
  };
  private async beginTracking() {
    if (!this.tracker || this.state.tracking === 'requesting' || this.stopTracking) return;
    this.stopWatcher();
    const version = this.trackingVersion;
    this.update({ tracking: 'requesting', trackingError: '' });
    try {
      const stop = await this.tracker.watch(
        (point) => {
          if (version !== this.trackingVersion || !isUsableTravelPoint(point)) return;
          if (this.state.live && point.timestamp <= this.state.live.timestamp) return;
          const recorded = this.state.recording && this.recorder.add(point);
          this.update({
            live: { ...point },
            ...(recorded
              ? { trail: this.recorder.segments, recordedPoints: this.recorder.count }
              : {}),
          });
          void this.resolvePlace(point);
          if (this.recorder.count >= 5000 && this.state.recording) {
            this.update({
              recording: false,
              trackingError: 'Path limit reached. Clear the path and resume to record more.',
            });
          }
        },
        (message) => {
          if (version !== this.trackingVersion) return;
          this.stopWatcher();
          this.update({ tracking: 'error', recording: false, trackingError: message });
        },
      );
      if (version !== this.trackingVersion) {
        stop();
        return;
      }
      this.stopTracking = stop;
      this.update({ tracking: 'tracking' });
    } catch (error) {
      if (version === this.trackingVersion)
        this.update({
          tracking: 'error',
          recording: false,
          trackingError:
            error instanceof Error
              ? error.message
              : 'Location could not start. Tap Resume to retry.',
        });
    }
  }
  private async resolvePlace(point: import('../models/travel').TravelPoint) {
    if (!this.tracker?.describe || this.placeBusy || !this.foreground) return;
    const moved =
      !this.lastPlacePoint ||
      Math.hypot(
        point.latitude - this.lastPlacePoint.latitude,
        point.longitude - this.lastPlacePoint.longitude,
      ) > 0.005;
    if (!moved && this.state.placeName) return;
    if (this.lastPlacePoint && this.now() - this.lastPlaceAt < 60000) {
      if (moved && this.state.placeName) this.update({ placeName: '' });
      return;
    }
    this.placeBusy = true;
    this.lastPlaceAt = this.now();
    this.lastPlacePoint = point;
    const generation = this.generation;
    try {
      const name = await this.tracker.describe(point);
      const live = this.state.live;
      if (
        generation === this.generation &&
        this.foreground &&
        live &&
        Math.hypot(live.latitude - point.latitude, live.longitude - point.longitude) < 0.005
      )
        this.update({ placeName: name });
    } catch {
      /* The GPS marker and path keep working if place lookup is unavailable. */
    } finally {
      this.placeBusy = false;
    }
  }
  dispose = () => {
    this.stopLanguage?.();
    this.stopLanguage = undefined;
    this.stopWatcher();
    this.update({ tracking: 'paused' });
    this.generation++;
  };
}
