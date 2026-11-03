const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('native Firestore uses long polling while browsers retain their default transport', () => {
  const calls = [];
  const app = { name: '[DEFAULT]' };
  const database = {};
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === 'firebase/firestore')
      return {
        initializeFirestore: (selected, settings) => {
          calls.push({ selected, settings });
          return database;
        },
        getFirestore: (selected) => {
          calls.push({ selected });
          return database;
        },
      };
    return original.call(this, request, ...args);
  };
  try {
    for (const platform of ['firestore.native', 'firestore']) {
      const filename = require.resolve('../.test-build/config/firebase/' + platform);
      delete require.cache[filename];
      assert.equal(require(filename).initializePlatformFirestore(app), database);
    }
  } finally {
    Module._load = original;
  }
  assert.deepEqual(calls, [
    {
      selected: app,
      settings: {
        experimentalForceLongPolling: true,
        experimentalLongPollingOptions: { timeoutSeconds: 5 },
      },
    },
    { selected: app },
  ]);
});
