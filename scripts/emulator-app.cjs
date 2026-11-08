const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

function commandDetail(error) {
  return (
    [error.stderr, error.stdout, error.code, error.message]
      .map((part) => String(part || '').trim())
      .find(Boolean)
      ?.slice(0, 500) || 'Unknown ADB error'
  );
}

async function waitForAndroid(
  adb,
  { serial, name },
  { now = Date.now, sleep = delay, timeoutMs = 90000, log = console.log } = {},
) {
  const deadline = now() + timeoutMs;
  let announced = false;
  let detail = 'Android is still starting.';
  while (true) {
    try {
      const booted = adb(['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], {
        timeout: 8000,
      }).trim();
      if (
        booted === '1' &&
        /\bpackage:\s+found\b/.test(
          adb(['-s', serial, 'shell', 'service', 'check', 'package'], { timeout: 8000 }),
        )
      )
        return;
    } catch (error) {
      detail = commandDetail(error);
    }
    if (now() >= deadline)
      throw new Error(
        `${name} (${serial}) did not become ready. Cold Boot this emulator in Device Manager and retry. ${detail}`,
      );
    if (!announced) {
      log(`Waiting for Android on ${name} (${serial})...`);
      announced = true;
    }
    await sleep(1000);
  }
}

function installedApp(adb, serial, packageName) {
  try {
    const result = adb(['-s', serial, 'shell', 'pm', 'path', packageName], {
      timeout: 15000,
    }).trim();
    if (!result) return false;
    if (/^package:/m.test(result)) return true;
    throw new Error(`Unexpected package-manager response: ${result}`);
  } catch (error) {
    // Android returns exit code 1 with no output when this package isn't installed.
    if (
      error.status === 1 &&
      !String(error.stdout || '').trim() &&
      !String(error.stderr || '').trim()
    )
      return false;
    throw error;
  }
}

function ensureDevelopmentApp(
  adb,
  { serial, name },
  root,
  packageName,
  { files = fs, log = console.log } = {},
) {
  try {
    if (installedApp(adb, serial, packageName)) return;
  } catch (error) {
    throw new Error(
      `${name} (${serial}): could not check the installed app. ${commandDetail(error)}`,
    );
  }
  const directory = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
  const apk = path.join(directory, 'app-debug.apk');
  let metadata;
  try {
    metadata = JSON.parse(files.readFileSync(path.join(directory, 'output-metadata.json'), 'utf8'));
  } catch {
    /* A fresh checkout may not have a native development build yet. */
  }
  const validBuild =
    files.existsSync(apk) &&
    metadata?.applicationId === packageName &&
    metadata.variantName === 'debug' &&
    metadata.elements?.some((element) => element.outputFile === 'app-debug.apk');
  if (!validBuild)
    throw new Error(
      `${name} (${serial}) does not have the development app installed, and no matching local debug build is available. Run npx expo run:android --device ${name} once, then retry npm run android:dev.`,
    );
  log(`Installing the existing development app on ${name} (${serial})...`);
  try {
    adb(['-s', serial, 'install', '-r', apk], { timeout: 120000 });
    if (!installedApp(adb, serial, packageName))
      throw new Error('Package was not found after installation.');
  } catch (error) {
    throw new Error(
      `${name} (${serial}): development app installation failed. ${commandDetail(error)}`,
    );
  }
}

module.exports = { waitForAndroid, ensureDevelopmentApp };
