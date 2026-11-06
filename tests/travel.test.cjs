const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TravelRecorder } = require('../.test-build/features/map/models/travel');
const { MapViewModel } = require('../.test-build/features/map/viewmodels/MapViewModel');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const now = Date.now();
const fix = (offset = 0, overrides = {}) => ({
  latitude: 28.5,
  longitude: -81.3 - offset * 0.0001,
  timestamp: now + offset * 3000,
  accuracy: 5,
  ...overrides,
});
test('GPS recording filters stale, inaccurate, duplicated, invalid, and jitter points', () => {
  const recorder = new TravelRecorder(() => now + 10000);
  assert.equal(recorder.add(fix()), true);
  for (const bad of [
    fix(),
    fix(1, { accuracy: 100 }),
    fix(1, { latitude: Infinity }),
    fix(1, { accuracy: null }),
    fix(1, { timestamp: now - 60000 }),
    fix(1, { longitude: -81.300001 }),
  ])
    assert.equal(recorder.add(bad), false);
  assert.equal(recorder.add(fix(1)), true);
  assert.equal(recorder.segments.length, 1);
  assert.equal(recorder.count, 2);
  const input = fix(2);
  recorder.add(input);
  input.longitude = 0;
  assert.notEqual(recorder.live.longitude, 0);
});
test('pauses, missing updates, and GPS jumps create separate path segments; clearing resets data', () => {
  const recorder = new TravelRecorder(() => now + 100000);
  recorder.add(fix(0, { timestamp: now + 80000 }));
  recorder.breakSegment();
  recorder.add(fix(1, { timestamp: now + 83000 }));
  recorder.add(fix(2, { timestamp: now + 99000, latitude: 40 }));
  assert.equal(recorder.segments.length, 3);
  recorder.clear();
  assert.equal(recorder.count, 0);
  assert.equal(recorder.live, null);
  assert.deepEqual(recorder.segments, []);
});
test('late GPS subscriptions are removed after backgrounding; resume respects user pause and disposal', async () => {
  const pending = [];
  let stopped = 0;
  let callback;
  const tracker = {
    watch: (point) => {
      callback = point;
      return new Promise((resolve) => pending.push(() => resolve(() => stopped++)));
    },
  };
  const model = new MapViewModel(undefined, tracker);
  model.start();
  assert.equal(model.getSnapshot().tracking, 'requesting');
  model.setForeground(false);
  callback(fix());
  assert.equal(model.getSnapshot().recordedPoints, 0);
  pending[0]();
  await flush();
  assert.equal(stopped, 1);
  model.setForeground(true);
  pending[1]();
  await flush();
  assert.equal(model.getSnapshot().tracking, 'tracking');
  callback(fix());
  assert.equal(model.getSnapshot().recordedPoints, 1);
  model.pauseTracking();
  assert.equal(stopped, 2);
  model.setForeground(false);
  model.setForeground(true);
  assert.equal(pending.length, 2);
  model.resumeTracking();
  pending[2]();
  await flush();
  callback(fix(1));
  assert.equal(model.getSnapshot().trail.length, 2);
  const lastGps = model.getSnapshot().live;
  model.clearTrail();
  assert.equal(model.getSnapshot().live, lastGps, 'clearing history keeps the GPS marker');
  assert.equal(model.getSnapshot().recordedPoints, 0);
  model.dispose();
  callback(fix(2));
  assert.equal(model.getSnapshot().recordedPoints, 0);
  assert.equal(stopped, 3);
});
test('permission errors remain recoverable and watcher errors stop subscriptions', async () => {
  let fail = true;
  let onError;
  let stopped = 0;
  const model = new MapViewModel(undefined, {
    watch: async (_point, error) => {
      if (fail) throw new Error('Permission denied');
      onError = error;
      return () => stopped++;
    },
  });
  model.start();
  await flush();
  assert.match(model.getSnapshot().trackingError, /Permission/);
  fail = false;
  model.resumeTracking();
  await flush();
  assert.equal(model.getSnapshot().tracking, 'tracking');
  onError('GPS stopped');
  assert.equal(stopped, 1);
  assert.equal(model.getSnapshot().tracking, 'error');
  model.dispose();
});

test('long gaps never connect two observed path sections', () => {
  let clock = now;
  const recorder = new TravelRecorder(() => clock);
  recorder.add(fix());
  clock += 40000;
  recorder.add(fix(1, { timestamp: clock }));
  assert.equal(recorder.segments.length, 2);
});

test('GPS place names resolve without blocking tracking or repeating nearby lookups', async () => {
  let callback;
  let resolveName;
  let lookups = 0;
  const model = new MapViewModel(undefined, {
    watch: async (next) => {
      callback = next;
      return () => {};
    },
    describe: async () => {
      lookups++;
      return new Promise((resolve) => (resolveName = resolve));
    },
  });
  model.start();
  await flush();
  callback(fix());
  assert.equal(model.getSnapshot().recordedPoints, 1);
  assert.equal(model.getSnapshot().placeName, '');
  callback(fix(1));
  assert.equal(lookups, 1);
  resolveName('Orlando, Florida');
  await flush();
  assert.equal(model.getSnapshot().placeName, 'Orlando, Florida');
  callback(fix(2));
  assert.equal(lookups, 1);
  model.dispose();
});
test('late place lookup results cannot update a disposed map', async () => {
  let callback;
  let resolveName;
  const model = new MapViewModel(undefined, {
    watch: async (next) => {
      callback = next;
      return () => {};
    },
    describe: async () => new Promise((resolve) => (resolveName = resolve)),
  });
  model.start();
  await flush();
  callback(fix());
  model.dispose();
  resolveName('Old place');
  await flush();
  assert.equal(model.getSnapshot().placeName, '');
});

test('a stationary trip asks for a new fix only when the foreground watch has gone quiet', async (t) => {
  let deliver,
    requests = 0,
    clock = now;
  const model = new MapViewModel(
    undefined,
    {
      watch: async (next) => {
        deliver = next;
        return () => {};
      },
      refresh: () => requests++,
    },
    () => clock,
  );
  t.after(model.dispose);
  model.start();
  await flush();
  deliver(fix());
  model.refreshTripFix();
  assert.equal(requests, 0);
  clock += 30000;
  model.refreshTripFix();
  assert.equal(requests, 1);
  model.setForeground(false);
  model.refreshTripFix();
  assert.equal(requests, 1);
});

test('a fresh session records immediately and a manual pause survives foreground and screen changes', async () => {
  let deliver;
  let watchers = 0;
  let stopped = 0;
  const model = new MapViewModel(undefined, {
    watch: async (next) => {
      deliver = next;
      watchers++;
      return () => stopped++;
    },
  });
  model.start();
  await flush();
  deliver(fix());
  assert.equal(model.getSnapshot().recording, true);
  assert.equal(model.getSnapshot().recordedPoints, 1);
  assert.equal(model.getSnapshot().live.longitude, fix().longitude);
  deliver(fix(1));
  assert.equal(model.getSnapshot().recordedPoints, 2);
  model.toggleRecording();
  deliver(fix(2));
  assert.equal(model.getSnapshot().recordedPoints, 2);
  assert.equal(model.getSnapshot().live.longitude, fix(2).longitude);
  assert.equal(model.getSnapshot().tracking, 'tracking');
  assert.equal(stopped, 0);
  model.setForeground(false);
  model.setForeground(true);
  model.start();
  await flush();
  assert.equal(model.getSnapshot().recording, false);
  model.toggleRecording();
  deliver(fix(3));
  assert.equal(model.getSnapshot().trail.length, 2);
  assert.equal(model.getSnapshot().trail[1][0].longitude, fix(2).longitude);
  assert.equal(watchers, 2);
  model.clearTrail();
  assert.equal(model.getSnapshot().recordedPoints, 0);
  assert.ok(model.getSnapshot().live);
  model.dispose();
  assert.equal(stopped, 2);
});
test('rapid start then pause during GPS startup does not create duplicate watchers or record late fixes', async () => {
  let deliver, finish;
  let watchers = 0;
  const model = new MapViewModel(undefined, {
    watch: (next) => {
      watchers++;
      deliver = next;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  model.start();
  model.toggleRecording();
  finish(() => {});
  await flush();
  deliver(fix());
  assert.equal(watchers, 1);
  assert.equal(model.getSnapshot().recording, false);
  assert.equal(model.getSnapshot().recordedPoints, 0);
  assert.ok(model.getSnapshot().live);
  model.dispose();
});
test('an unavailable place name retries after the lookup cooldown without requiring a large movement', async () => {
  let callback;
  let clock = 1000;
  let calls = 0;
  const model = new MapViewModel(
    undefined,
    {
      watch: async (next) => {
        callback = next;
        return () => {};
      },
      describe: async () => (++calls === 1 ? '' : 'Orlando, Florida'),
    },
    () => clock,
  );
  model.start();
  await flush();
  callback(fix());
  await flush();
  assert.equal(calls, 1);
  assert.equal(model.getSnapshot().placeName, '');
  callback(fix(1));
  await flush();
  assert.equal(calls, 1);
  clock += 60001;
  callback(fix(2));
  await flush();
  assert.equal(calls, 2);
  assert.equal(model.getSnapshot().placeName, 'Orlando, Florida');
  model.dispose();
});
