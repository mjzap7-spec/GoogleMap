const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isProjectMetro } = require('./metro-server.cjs');
const { refreshEmulatorClock } = require('./emulator-clock.cjs');
const { waitForAndroid, ensureDevelopmentApp } = require('./emulator-app.cjs');

const projectRoot = path.resolve(__dirname, '..');
const packageName = 'com.anonymous.nestauth';
const preferences = `shared_prefs/${packageName}_preferences.xml`;
const ports = { Pixel_8a: 8081, Pixel_8: 8082 };

function parseDevices(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^(emulator-\d+)\s+device$/);
    return match ? [match[1]] : [];
  });
}

function setMetroHost(xml, port) {
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<map(?:\s[^>]*)?>/.test(xml))
    throw new Error('Unrecognized Android developer preferences; refusing to overwrite them.');
  const setting = `<string name="debug_http_host">localhost:${port}</string>`;
  const previous = /<string\b[^>]*\bname="debug_http_host"[^>]*>[\s\S]*?<\/string>/;
  if (previous.test(xml)) return xml.replace(previous, setting);
  if (/<map\s*\/>/.test(xml)) return xml.replace(/<map\s*\/>/, `<map>${setting}</map>`);
  if (!xml.includes('</map>')) throw new Error('Invalid Android developer preferences.');
  return xml.replace('</map>', `${setting}</map>`);
}

async function main(sharedPort, { bootMissing = false } = {}) {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
  ].filter(Boolean);
  const adbPath = candidates
    .map((sdk) => path.join(sdk, 'platform-tools', 'adb.exe'))
    .find((candidate) => fs.existsSync(candidate));
  if (!adbPath) throw new Error('Android SDK adb.exe was not found. Set ANDROID_HOME to your SDK.');
  const adb = (args, options = {}) =>
    execFileSync(adbPath, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
  const findTargets = () =>
    parseDevices(adb(['devices'])).flatMap((serial) => {
      const name = adb(['-s', serial, 'emu', 'avd', 'name']).split(/\r?\n/)[0].trim();
      return ports[name] ? [{ serial, name, port: sharedPort ?? ports[name] }] : [];
    });
  let targets = findTargets();
  if (bootMissing) {
    const emulator = path.resolve(adbPath, '../../emulator/emulator.exe');
    const installedAvds = execFileSync(emulator, ['-list-avds'], {
      encoding: 'utf8',
      windowsHide: true,
    })
      .trim()
      .split(/\r?\n/);
    for (const name of Object.keys(ports)) {
      if (targets.some((target) => target.name === name)) continue;
      if (!installedAvds.includes(name))
        throw new Error(`Create ${name} in Android Studio Device Manager first.`);
      console.log(`Starting ${name}...`);
      const args = ['-avd', name];
      if (name === 'Pixel_8a') args.push('-no-snapshot-load');
      const child = spawn(emulator, args, { detached: true, windowsHide: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      child.unref();
      // Wait for each AVD to claim its console port before starting the next.
      const deadline = Date.now() + 180000;
      while (true) {
        targets = findTargets();
        const target = targets.find((item) => item.name === name);
        if (
          target &&
          adb(['-s', target.serial, 'shell', 'getprop', 'sys.boot_completed']).trim() === '1'
        )
          break;
        if (Date.now() >= deadline)
          throw new Error(`${name} did not finish starting. Check Device Manager.`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  if (!targets.length)
    throw new Error('Start Pixel_8a or Pixel_8, wait for Android to boot, then retry.');

  // Validate all servers before stopping an app or changing its preferences.
  for (const port of new Set(targets.map((target) => target.port))) {
    if (!(await isProjectMetro(port, projectRoot)))
      throw new Error(
        `Metro on ${port} is not responding for ${projectRoot}. Run npm run android:dev to reconnect both apps.`,
      );
  }
  for (const { serial, name, port } of targets) {
    await waitForAndroid(adb, { serial, name });
    ensureDevelopmentApp(adb, { serial, name }, projectRoot, packageName);
    refreshEmulatorClock(adb, serial);
    adb(['-s', serial, 'shell', 'am', 'force-stop', packageName]);
    let xml;
    try {
      xml = adb(['-s', serial, 'shell', 'run-as', packageName, 'cat', preferences]);
    } catch (error) {
      if (!String(error.stderr).includes('No such file')) throw error;
      xml = '<map></map>';
    }
    const updated = setMetroHost(xml, port);
    adb(['-s', serial, 'shell', 'run-as', packageName, 'mkdir', '-p', 'shared_prefs']);
    adb(['-s', serial, 'shell', `run-as ${packageName} sh -c 'cat > ${preferences}'`], {
      input: updated,
    });
    adb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    const url = `nest-auth://?__expo_url=${encodeURIComponent(`http://localhost:${port}`)}`;
    adb([
      '-s',
      serial,
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      url,
      '-p',
      packageName,
    ]);
    console.log(`${name} (${serial}) opened on Metro ${port}.`);
  }
}

module.exports = { parseDevices, setMetroHost, openEmulators: main };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
