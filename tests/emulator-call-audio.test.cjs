const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureEmulatorCallAudio } = require('../plugins/withEmulatorCallAudio');

test('emulator audio override initializes before WebRTC and survives repeated prebuilds', () => {
  const source = 'class MainApplication {\n  fun onCreate() {\n    loadReactNative(this)\n  }\n}';
  const result = configureEmulatorCallAudio(source);
  assert.equal(configureEmulatorCallAudio(result), result);
  assert.ok(result.indexOf('audioDeviceModule =') < result.indexOf('loadReactNative(this)'));
  assert.match(result, /if \(emulatorAudio\)/);
  assert.match(result, /AudioSource\.MIC/);
  assert.match(result, /setUseHardwareAcousticEchoCanceler\(false\)/);
  assert.match(result, /if \(BuildConfig.DEBUG\)/);
  assert.throws(
    () => configureEmulatorCallAudio('unexpected native template'),
    /Expected React Native/,
  );
});
