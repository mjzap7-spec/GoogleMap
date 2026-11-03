const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shortenObjectPaths } = require('../plugins/withShortAndroidObjectPaths');
test('Windows native path configuration is idempotent and upgrades the limit that prevented codegen filename hashing', () => {
  const base = 'android { defaultConfig {} }';
  const first = shortenObjectPaths(base);
  assert.match(first, /-DCMAKE_OBJECT_PATH_MAX=250/);
  assert.equal(shortenObjectPaths(first), first);
  const previous = first.replace('CMAKE_OBJECT_PATH_MAX=250', 'CMAKE_OBJECT_PATH_MAX=240');
  assert.equal(shortenObjectPaths(previous), first);
  assert.equal((first.match(/shorten native object paths/g) || []).length, 1);
});
