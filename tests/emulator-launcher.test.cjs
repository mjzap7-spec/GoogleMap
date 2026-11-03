const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDevices, setMetroHost } = require('../scripts/open-emulators.cjs');

test('launcher accepts online emulator serials without assuming their AVD order', () => {
  assert.deepEqual(
    parseDevices(
      'List of devices attached\r\nemulator-5556 device\r\nemulator-5554 device\r\nemulator-5558 offline\r\nphone123 device\r\n',
    ),
    ['emulator-5556', 'emulator-5554'],
  );
});

test('changing Metro host preserves other developer preferences and replaces stale ports', () => {
  const old =
    '<map><boolean name="unrelated" value="true"/><string name="debug_http_host">localhost:8082</string></map>';
  const updated = setMetroHost(old, 8081);
  assert.match(updated, /localhost:8081/);
  assert.doesNotMatch(updated, /localhost:8082/);
  assert.match(updated, /<boolean name="unrelated" value="true"\/>/);
  assert.equal(setMetroHost(updated, 8081), updated);
  assert.match(setMetroHost('<map />', 8082), /localhost:8082/);
  assert.match(setMetroHost('<map></map>', 8081), /localhost:8081/);
  assert.throws(() => setMetroHost('not XML', 8081), /refusing/);
});
