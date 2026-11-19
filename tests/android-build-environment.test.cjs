const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { androidBuildEnvironment } = require('../scripts/run-android.cjs');

test('Windows builds discover the SDK and Studio Java without modifying the parent environment', () => {
  const env = { LOCALAPPDATA: 'C:/Users/test/AppData/Local', ProgramFiles: 'C:/Program Files' };
  const sdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  const java = path.join(env.ProgramFiles, 'Android', 'Android Studio', 'jbr');
  const files = new Set([
    path.join(sdk, 'platform-tools', 'adb.exe'),
    path.join(java, 'bin', 'java.exe'),
  ]);
  const result = androidBuildEnvironment(env, 'win32', (value) => files.has(value));
  assert.equal(result.ANDROID_HOME, sdk);
  assert.equal(result.JAVA_HOME, java);
  assert.equal(env.ANDROID_HOME, undefined);
});
test('explicit SDK and Java installations take precedence and missing defaults are not invented', () => {
  const env = { ANDROID_HOME: 'D:/Sdk', ANDROID_SDK_ROOT: 'E:/Sdk', JAVA_HOME: 'D:/Java' };
  assert.deepEqual(
    androidBuildEnvironment(env, 'win32', () => true),
    env,
  );
  assert.deepEqual(
    androidBuildEnvironment({}, 'win32', () => false),
    {},
  );
  assert.deepEqual(
    androidBuildEnvironment(env, 'darwin', () => true),
    env,
  );
});
