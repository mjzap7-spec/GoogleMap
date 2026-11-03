const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { configureFirestoreStreaming } = require('../plugins/withFirestoreStreaming');

test('native streaming configuration is idempotent, debug-only and scoped to the Firestore host', () => {
  const template =
    'import android.app.Application\nclass MainApplication { fun onCreate() { loadReactNative(this) } }';
  const result = configureFirestoreStreaming(template);
  assert.equal(configureFirestoreStreaming(result), result);
  assert.match(result, /if \(BuildConfig.DEBUG\)/);
  assert.match(result, /chain.request\(\).url.host == "firestore.googleapis.com"/);
  assert.match(result, /inspector.intercept\(chain\)/);
  assert.ok(result.indexOf('setCustomClientBuilder') < result.indexOf('loadReactNative(this)'));
  assert.throws(() => configureFirestoreStreaming('unknown template'), /Expected/);
  assert.ok(
    JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.plugins.includes(
      './plugins/withFirestoreStreaming.js',
    ),
  );
});
