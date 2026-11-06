const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { parseDevices } = require('./open-emulators.cjs');

// Extended Controls serializes GPX imports as timed points and driving routes as legs.
function readPoints(route) {
  let points = route.path;
  if (!Array.isArray(points)) {
    points = [];
    let elapsed = 0;
    for (const leg of route.routes?.[0]?.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const geometry = step.path;
        const seconds = step.duration?.value;
        if (
          !Array.isArray(geometry) ||
          geometry.length < 2 ||
          !Number.isFinite(seconds) ||
          seconds < 0
        )
          throw new Error('Invalid geometry or timing in driving route.');
        geometry.forEach((p, i) => {
          if (i || !points.length)
            points.push({ ...p, delay_sec: elapsed + (seconds * i) / (geometry.length - 1) });
        });
        elapsed += seconds;
      }
    }
  }
  if (
    points.length < 2 ||
    points.some(
      (p, i) =>
        !p ||
        !Number.isFinite(p.lat) ||
        Math.abs(p.lat) > 90 ||
        !Number.isFinite(p.lng) ||
        Math.abs(p.lng) > 180 ||
        !Number.isFinite(p.delay_sec) ||
        p.delay_sec < 0 ||
        (i > 0 && p.delay_sec < points[i - 1].delay_sec),
    )
  )
    throw Error('The saved route needs at least two valid, time-ordered GPS points.');
  return points;
}
function routeFile(name) {
  if (name && path.extname(name) === '.json') return path.resolve(name);
  const home = process.env.ANDROID_USER_HOME || path.join(os.homedir(), '.android');
  const directory = path.join(home, 'locations', 'routes');
  if (name && path.basename(name) !== name)
    throw Error('Use a saved route name or a route.json file.');
  if (!name && fs.existsSync(directory)) {
    const names = fs
      .readdirSync(directory)
      .filter((n) => fs.existsSync(path.join(directory, n, 'route.json')))
      .sort();
    // Prefer an imported track, which also works when the host map preview is offline.
    name =
      names.find((n) =>
        Array.isArray(
          JSON.parse(fs.readFileSync(path.join(directory, n, 'route.json'), 'utf8')).path,
        ),
      ) || names.at(-1);
  }
  if (!name)
    throw Error(
      'No saved emulator routes. Import a GPX in Extended Controls or pass a route.json file.',
    );
  return path.join(directory, name, 'route.json');
}
async function playRoute(name, deviceName = 'Pixel_8a') {
  const file = routeFile(name);
  const points = readPoints(JSON.parse(fs.readFileSync(file, 'utf8')));
  const sdk = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
  ].find((p) => p && fs.existsSync(path.join(p, 'platform-tools', 'adb.exe')));
  if (!sdk) throw Error('Android SDK platform-tools not found.');
  const adb = (args) =>
    execFileSync(path.join(sdk, 'platform-tools', 'adb.exe'), args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 12000,
    }).trim();
  const serial = parseDevices(adb(['devices'])).find(
    (id) => adb(['-s', id, 'emu', 'avd', 'name']).split(/\s+/)[0] === deviceName,
  );
  if (!serial) throw Error('Start ' + deviceName + ' and retry.');
  console.log(
    'Loaded ' +
      points.length +
      ' points from ' +
      file +
      ' for ' +
      deviceName +
      '. Open Map and tap Start recording to draw the path. Ctrl+C stops playback.',
  );
  const start = performance.now();
  for (const [index, p] of points.entries()) {
    await delay(
      Math.max(0, (p.delay_sec - points[0].delay_sec) * 1000 - (performance.now() - start)),
    );
    const result = adb([
      '-s',
      serial,
      'emu',
      'geo',
      'fix',
      String(p.lng),
      String(p.lat),
      String(Number.isFinite(p.elevation) ? p.elevation : 0),
    ]);
    if (!result.includes('OK'))
      throw Error('Emulator rejected GPS point ' + (index + 1) + ': ' + result);
    if (index === 0 || (index + 1) % 10 === 0)
      console.log('GPS point ' + (index + 1) + ' / ' + points.length);
  }
  console.log('Route playback complete.');
}
module.exports = { playRoute, readPoints };
if (require.main === module)
  playRoute(...process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
