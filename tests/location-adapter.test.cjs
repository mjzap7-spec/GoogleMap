const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(
  require.resolve('../.test-build/features/map/data/ExpoLocationTracker'),
  'utf8',
);
function fixture({
  services = true,
  granted = true,
  addresses = [],
  cached = async () => null,
} = {}) {
  let options;
  let deliver;
  let watcherCalls = 0;
  let removed = 0;
  const location = {
    Accuracy: { High: 4 },
    getLastKnownPositionAsync: cached,
    reverseGeocodeAsync: async () => addresses,
    hasServicesEnabledAsync: async () => services,
    requestForegroundPermissionsAsync: async () => ({ granted }),
    watchPositionAsync: async (config, callback) => {
      options = config;
      deliver = callback;
      watcherCalls++;
      return { remove: () => removed++ };
    },
  };
  const context = {
    exports: {},
    require: (name) => {
      assert.equal(name, 'expo-location');
      return location;
    },
  };
  vm.runInNewContext(source, context);
  return {
    tracker: new context.exports.ExpoLocationTracker(),
    options: () => options,
    deliver: (point) => deliver(point),
    watcherCalls: () => watcherCalls,
    removed: () => removed,
  };
}
test('device tracker handles permissions and services without starting unauthorized watchers', async () => {
  const denied = fixture({ granted: false });
  await assert.rejects(
    denied.tracker.watch(
      () => {},
      () => {},
    ),
    /permission/,
  );
  assert.equal(denied.watcherCalls(), 0);
  const off = fixture({ services: false });
  await assert.rejects(
    off.tracker.watch(
      () => {},
      () => {},
    ),
    /services/,
  );
  assert.equal(off.watcherCalls(), 0);
});
test('device tracker subscribes with movement limits, maps GPS data, and removes its subscription', async () => {
  const f = fixture();
  let point;
  const stop = await f.tracker.watch(
    (value) => (point = value),
    () => {},
  );
  assert.equal(f.options().distanceInterval, 5);
  assert.equal(f.options().timeInterval, 1000);
  f.deliver({ coords: { latitude: 28, longitude: -81, accuracy: 5 }, timestamp: Date.now() });
  assert.equal(point.latitude, 28);
  assert.ok(point.timestamp > 0);
  stop();
  assert.equal(f.removed(), 1);
});

test('device place names use city and region rather than numeric coordinates', async () => {
  const f = fixture({
    addresses: [{ city: 'Orlando', region: 'Florida', country: 'United States' }],
  });
  assert.equal(await f.tracker.describe({ latitude: 28, longitude: -81 }), 'Orlando, Florida');
  assert.equal(await fixture().tracker.describe({ latitude: 28, longitude: -81 }), '');
});

const flush = () => new Promise((resolve) => setImmediate(resolve));
test('recent device fixes arrive while GPS starts, and late cached results cannot override live GPS or update stopped watchers', async () => {
  let finish;
  const f = fixture({
    cached: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const points = [];
  const stop = await f.tracker.watch(
    (point) => points.push(point),
    () => {},
  );
  const now = Date.now();
  f.deliver({ coords: { latitude: 28, longitude: -81, accuracy: 5 }, timestamp: now });
  finish({ coords: { latitude: 27, longitude: -81, accuracy: 5 }, timestamp: now - 1000 });
  await flush();
  assert.equal(points.length, 1);
  assert.equal(points[0].latitude, 28);
  stop();
  f.deliver({ coords: { latitude: 29, longitude: -81, accuracy: 5 }, timestamp: now + 1000 });
  assert.equal(points.length, 1);
});
test('cache is optional, bounded by freshness and accuracy, and never blocks live subscription', async () => {
  for (const fix of [
    { coords: { latitude: 28, longitude: -81, accuracy: 5 }, timestamp: Date.now() },
    { coords: { latitude: 28, longitude: -81, accuracy: 5 }, timestamp: Date.now() - 60000 },
    { coords: { latitude: 28, longitude: -81, accuracy: 100 }, timestamp: Date.now() },
  ]) {
    const points = [];
    const f = fixture({
      cached: async (options) => {
        assert.equal(options.maxAge, 15000);
        assert.equal(options.requiredAccuracy, 50);
        return fix;
      },
    });
    const stop = await f.tracker.watch(
      (point) => points.push(point),
      () => {},
    );
    await flush();
    assert.equal(f.watcherCalls(), 1);
    assert.equal(
      points.length,
      fix.coords.accuracy <= 50 && Date.now() - fix.timestamp < 15000 ? 1 : 0,
    );
    stop();
  }
});
