const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

async function main() {
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
  const targets = parseDevices(adb(['devices'])).flatMap((serial) => {
    const name = adb(['-s', serial, 'emu', 'avd', 'name']).split(/\r?\n/)[0].trim();
    return ports[name] ? [{ serial, name, port: ports[name] }] : [];
  });
  if (!targets.length)
    throw new Error('Start Pixel_8a or Pixel_8, wait for Android to boot, then retry.');

  // Validate all servers before stopping an app or changing its preferences.
  for (const { port } of targets) {
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${port}/status`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || (await response.text()).trim() !== 'packager-status:running')
        throw new Error();
    } catch {
      throw new Error(
        `Start Metro in another terminal: npx expo start --dev-client --port ${port}`,
      );
    }
    const root = response.headers.get('x-react-native-project-root');
    if (!root || path.resolve(decodeURIComponent(root)).toLowerCase() !== projectRoot.toLowerCase())
      throw new Error(
        `Port ${port} is not serving ${projectRoot}. Start this project's Metro server there.`,
      );
  }
  for (const { serial, name, port } of targets) {
    const installed = adb(['-s', serial, 'shell', 'pm', 'path', packageName]).trim();
    if (!installed.startsWith('package:'))
      throw new Error(`${name}: install the development app first.`);
    adb(['-s', serial, 'shell', 'am', 'force-stop', packageName]);
    let xml;
    try {
      xml = adb(['-s', serial, 'shell', 'run-as', packageName, 'cat', preferences]);
    } catch (error) {
      if (!String(error.stderr).includes('No such file')) throw error;
      xml = '<map></map>';
    }
    const updated = setMetroHost(xml, port);
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

module.exports = { parseDevices, setMetroHost };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
