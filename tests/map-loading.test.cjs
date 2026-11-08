const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapResourceFailure,
  mapClockError,
  mapCertificateError,
} = require('../.test-build/features/map/models/mapFailure');
const { refreshEmulatorClock } = require('../scripts/emulator-clock.cjs');

test('map certificate date failures give specific recovery instructions for map resources', () => {
  for (const code of [0, 1, 4]) {
    for (const url of [
      'https://tiles.openfreemap.org/styles/dark',
      'https://tiles.openfreemap.org/planet/tiles.json',
      'https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js',
    ])
      assert.equal(mapResourceFailure(url, code), mapClockError);
  }
  assert.equal(
    mapResourceFailure('https://tiles.openfreemap.org/styles/dark', 3),
    mapCertificateError,
  );
  for (const url of [
    'https://res.cloudinary.com/avatar.png',
    'https://tiles.openfreemap.org.evil.test/style',
    'https://unpkg.com/unrelated-package',
    'not a URL',
  ])
    assert.equal(
      mapResourceFailure(url, 4),
      undefined,
      'unrelated image errors must not hide the map',
    );
});

function clockFixture({ offset = 0, automatic = true, refresh = true, failure = false } = {}) {
  const now = 1793977200000;
  let deviceTime = now + offset;
  const calls = [],
    logs = [];
  const adb = (args, options) => {
    calls.push(args);
    assert.equal(options.timeout, 8000);
    if (failure) throw new Error('unsupported shell service');
    const command = args.slice(3).join(' ');
    if (command === 'date +%s') return String(Math.floor(deviceTime / 1000));
    if (command === 'settings get global auto_time') return automatic ? '1' : '0';
    if (command === 'cmd network_time_update_service force_refresh') {
      if (refresh) deviceTime = now;
      return refresh ? 'true' : 'false';
    }
    assert.fail('Unexpected mutation: ' + command);
  };
  return {
    calls,
    logs,
    run: (serial = 'emulator-5556') =>
      refreshEmulatorClock(adb, serial, { now: () => now, log: (text) => logs.push(text) }),
  };
}

test('emulator launcher repairs a stale automatic clock before opening the app', () => {
  for (const offset of [-13 * 60 * 60 * 1000, 13 * 60 * 60 * 1000]) {
    const f = clockFixture({ offset });
    f.run();
    assert.equal(f.calls.filter((args) => args.includes('force_refresh')).length, 1);
    assert.match(f.logs[0], /refreshed automatic date and time/);
  }
});

test('clock check preserves physical devices, current clocks and manual time settings', () => {
  const physical = clockFixture({ offset: -86400000 });
  physical.run('phone123');
  assert.equal(physical.calls.length, 0);
  const current = clockFixture({ offset: -1000 });
  current.run();
  assert.equal(current.calls.length, 1);
  assert.equal(current.logs.length, 0);
  const manual = clockFixture({ offset: -86400000, automatic: false });
  manual.run();
  assert.equal(
    manual.calls.some((args) => args.includes('force_refresh')),
    false,
  );
  assert.match(manual.logs[0], /enable automatic date and time/);
});

test('unsupported time services or failed refresh do not prevent app launch', () => {
  for (const options of [{ failure: true }, { offset: -86400000, refresh: false }]) {
    const f = clockFixture(options);
    assert.doesNotThrow(() => f.run());
    assert.match(f.logs[0], /could not verify clock sync/);
  }
});
