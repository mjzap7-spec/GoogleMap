const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { parseDevices, setMetroHost } = require('../scripts/open-emulators.cjs');
const {
  isProjectMetro,
  isPortAvailable,
  selectMetroServer,
} = require('../scripts/metro-server.cjs');
const { main: startEmulators } = require('../scripts/start-emulators.cjs');

const root = path.resolve(__dirname, '..');

async function statusServer(t, { delay = 0, project = encodeURIComponent(root), body } = {}) {
  const server = http.createServer((_, response) => {
    const timer = setTimeout(() => {
      if (project !== null) response.setHeader('x-react-native-project-root', project);
      response.end(body ?? 'packager-status:running');
    }, delay);
    response.once('close', () => clearTimeout(timer));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return server.address().port;
}

test('a Metro response slower than two seconds is reused without starting another server', async (t) => {
  const port = await statusServer(t, { delay: 2200 });
  const server = await selectMetroServer(root, {
    ports: [port],
    available: () => assert.fail('A responding Metro server must be reused'),
  });
  assert.deepEqual(server, { port, reused: true });
});

test('launcher verifies the project and Metro status before reusing an occupied port', async (t) => {
  for (const settings of [
    { project: encodeURIComponent(path.resolve(root, '../other-project')) },
    { project: null },
    { project: '%' },
    { body: 'another service' },
  ]) {
    const port = await statusServer(t, settings);
    assert.equal(await isProjectMetro(port, root), false);
    assert.equal(await isPortAvailable(port), false);
  }
});

test('a stalled status endpoint stays occupied and times out instead of blocking discovery', async (t) => {
  const port = await statusServer(t, { delay: 2000 });
  assert.equal(await isProjectMetro(port, root, { timeoutMs: 100 }), false);
  assert.equal(await isPortAvailable(port), false);
});

test('an existing project server on 8082 takes priority over starting on a free 8081', async () => {
  assert.deepEqual(
    await selectMetroServer(root, {
      ports: [8081, 8082],
      probe: async (port) => port === 8082,
      available: () => assert.fail('Do not start a second Metro'),
    }),
    { port: 8082, reused: true },
  );
});

test('busy ports are skipped and the first available port is selected', async () => {
  assert.deepEqual(
    await selectMetroServer(root, {
      ports: [8081, 8082, 8083],
      probe: async () => false,
      available: async (port) => port === 8083,
    }),
    { port: 8083, reused: false },
  );
  await assert.rejects(
    selectMetroServer(root, { probe: async () => false, available: async () => false }),
    /Ports 8081–8090 are busy/,
  );
});

test('reused Metro opens both emulators on its port before starting the requested route', async () => {
  const events = [];
  await startEmulators(['--route', 'saved-route', 'Pixel_8a'], {
    select: async () => ({ port: 8082, reused: true }),
    start: () => assert.fail('Must not spawn a duplicate Metro'),
    open: async (port, options) => events.push(['open', port, options]),
    play: async (...args) => events.push(['route', ...args]),
    log: () => {},
  });
  assert.deepEqual(events, [
    ['open', 8082, { bootMissing: true }],
    ['route', 'saved-route', 'Pixel_8a'],
  ]);
});

test('a newly selected port reaches the emulator opener only after Metro is ready', async () => {
  const events = [];
  await startEmulators([], {
    select: async () => ({ port: 8083, reused: false }),
    start: async (port) => events.push(['ready', port]),
    open: async (port) => events.push(['open', port]),
    play: () => assert.fail('No route was requested'),
    log: () => {},
  });
  assert.deepEqual(events, [
    ['ready', 8083],
    ['open', 8083],
  ]);
  await assert.rejects(
    startEmulators(['--route'], {
      select: async () => ({ port: 8083, reused: false }),
      start: async () => {
        throw new Error('Metro failed');
      },
      open: () => assert.fail('Do not open apps when Metro failed'),
      play: () => assert.fail('Do not play a route when Metro failed'),
      log: () => {},
    }),
    /Metro failed/,
  );
});

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
