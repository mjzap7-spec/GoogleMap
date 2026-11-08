const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { waitForAndroid, ensureDevelopmentApp } = require('../scripts/emulator-app.cjs');

const target = { serial: 'emulator-5554', name: 'Pixel_8' };
const packageName = 'com.anonymous.nestauth';
const root = path.resolve(__dirname, '..');
const metadata = {
  applicationId: packageName,
  variantName: 'debug',
  elements: [{ outputFile: 'app-debug.apk' }],
};
const files = {
  existsSync: () => true,
  readFileSync: () => JSON.stringify(metadata),
};
const log = () => {};

test('existing ADB devices wait for both Android boot and the package service', async () => {
  let tick = 0;
  const calls = [];
  await waitForAndroid(
    (args) => {
      calls.push(args);
      if (args.includes('getprop')) return tick === 0 ? '0' : '1';
      return tick === 1 ? 'Service package: not found' : 'Service package: found';
    },
    target,
    {
      now: () => tick * 1000,
      sleep: async () => {
        tick++;
      },
      log,
    },
  );
  assert.equal(tick, 2, 'an online ADB connection and a booted OS alone are insufficient');
  assert.equal(calls.filter((args) => args.includes('service')).length, 2);
});

test('readiness recovers from transient ADB disconnects and reports a bounded timeout', async () => {
  let tick = 0;
  await waitForAndroid(
    (args) => {
      if (!tick) throw Object.assign(new Error('offline'), { stderr: 'device offline' });
      return args.includes('getprop') ? '1' : 'Service package: found';
    },
    target,
    {
      now: () => tick * 1000,
      sleep: async () => {
        tick++;
      },
      log,
    },
  );
  assert.equal(tick, 1);
  tick = 0;
  await assert.rejects(
    waitForAndroid(() => '0', target, {
      now: () => tick * 1000,
      sleep: async () => {
        tick++;
      },
      timeoutMs: 2000,
      log,
    }),
    /Pixel_8 \(emulator-5554\) did not become ready/,
  );
});

test('missing package exit code 1 installs and verifies the existing development build', () => {
  let installed = false;
  const calls = [];
  ensureDevelopmentApp(
    (args) => {
      calls.push(args);
      if (args.includes('install')) {
        installed = true;
        return 'Success';
      }
      if (!installed)
        throw Object.assign(new Error('Command failed'), { status: 1, stdout: '', stderr: '' });
      return 'package:/data/app/example/base.apk';
    },
    target,
    root,
    packageName,
    { files, log },
  );
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1], [
    '-s',
    target.serial,
    'install',
    '-r',
    path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'),
  ]);
});

test('an already installed app is kept without reading build files or reinstalling', () => {
  const calls = [];
  ensureDevelopmentApp(
    (args) => {
      calls.push(args);
      return 'package:/data/app/example/base.apk';
    },
    target,
    root,
    packageName,
    { files: { existsSync: () => assert.fail('No reinstall') }, log },
  );
  assert.equal(calls.length, 1);
});

test('real ADB errors are reported rather than being mistaken for a missing app', () => {
  for (const failure of [
    { status: 1, stderr: 'device offline' },
    { code: 'ETIMEDOUT', stderr: Buffer.alloc(0), stdout: Buffer.alloc(0) },
  ]) {
    assert.throws(
      () =>
        ensureDevelopmentApp(
          () => {
            throw Object.assign(new Error('Command failed'), failure);
          },
          target,
          root,
          packageName,
          { files, log },
        ),
      /could not check the installed app.*(device offline|ETIMEDOUT)/,
    );
  }
});

test('missing or mismatched builds give a device-specific command without installing anything', () => {
  for (const localFiles of [
    {
      existsSync: () => false,
      readFileSync: () => {
        throw Error('missing');
      },
    },
    {
      ...files,
      readFileSync: () => JSON.stringify({ ...metadata, applicationId: 'unrelated.app' }),
    },
  ]) {
    let calls = 0;
    assert.throws(
      () =>
        ensureDevelopmentApp(
          () => {
            calls++;
            return '';
          },
          target,
          root,
          packageName,
          { files: localFiles, log },
        ),
      /npx expo run:android --device Pixel_8/,
    );
    assert.equal(calls, 1);
  }
});

test('installation failures include the device and reason, without uninstalling or wiping data', () => {
  const calls = [];
  assert.throws(
    () =>
      ensureDevelopmentApp(
        (args) => {
          calls.push(args);
          if (args.includes('install'))
            throw Object.assign(new Error('install failed'), {
              status: 1,
              stderr: 'INSTALL_FAILED_INSUFFICIENT_STORAGE',
            });
          return '';
        },
        target,
        root,
        packageName,
        { files, log },
      ),
    /Pixel_8.*installation failed.*INSUFFICIENT_STORAGE/,
  );
  assert.equal(calls.length, 2);
  assert.equal(
    calls.some((args) => args.includes('uninstall') || args.includes('clear')),
    false,
  );
});
