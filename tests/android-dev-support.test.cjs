const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { configureDevSupport } = require('../plugins/withAndroidDevSupport');

test('generated Android debug hosts enable Metro using the application build type', () => {
  const generated = `ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages
    )`;
  const configured = configureDevSupport(generated);
  assert.match(configured, /useDevSupport = BuildConfig.DEBUG,/);
  assert.equal(configureDevSupport(configured), configured);
  assert.throws(() => configureDevSupport('unknown template'), /Expected/);
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  assert.ok(app.expo.plugins.includes('./plugins/withAndroidDevSupport.js'));
});
