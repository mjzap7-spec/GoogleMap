const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');
const { SessionViewModel } = require('../.test-build/features/auth/viewmodels/SessionViewModel');

test('session stays in restoration until the SDK resolves a cached user or signed-out state', () => {
  for (const signedIn of [true, false]) {
    const fixture = createFirebaseFixture();
    const session = new SessionViewModel(fixture.repository);
    session.start();
    assert.equal(session.getSnapshot().loading, true);
    fixture.authChanged(signedIn ? fixture.user : null);
    assert.equal(session.getSnapshot().loading, false);
    assert.equal(session.getSnapshot().user?.id ?? null, signedIn ? fixture.user.uid : null);
    session.stop();
  }
});

test('token refresh preserves the profile and does not restart its listener; sign-out clears it', () => {
  const fixture = createFirebaseFixture();
  const updates = [];
  const stop = fixture.repository.observeSession(
    (user) => updates.push(user),
    () => {},
  );
  fixture.authChanged(fixture.user);
  fixture.profileChanged({
    fullName: 'Saved name',
    birthday: '2000-01-01',
    location: 'Saved location',
  });
  fixture.authChanged({ ...fixture.user });
  assert.equal(updates.at(-1).fullName, 'Saved name');
  assert.equal(fixture.calls.filter((c) => c[0] === 'watch-profile').length, 1);
  fixture.authChanged(null);
  assert.equal(updates.at(-1), null);
  assert.ok(fixture.calls.some((c) => c[0] === 'stop-profile'));
  stop();
});

test('cached profiles can open Home while the first server watch has priority; offline startup also releases background listeners', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const slow of [false, true]) {
    const cached = {
      fullName: 'Cached',
      birthday: '2000-01-01',
      location: 'Orlando',
      avatarUrl: null,
    };
    const fixture = createFirebaseFixture({
      profileCache: { read: async () => cached, write: async () => {} },
    });
    const session = new SessionViewModel(fixture.repository);
    session.start();
    fixture.authChanged(fixture.user);
    await Promise.resolve();
    assert.equal(session.getSnapshot().user.profileStatus, 'ready');
    assert.equal(session.getSnapshot().user.profileSyncPending, true);
    fixture.profileChanged(cached, { fromCache: true });
    if (slow) {
      t.mock.timers.tick(10000);
      assert.equal(session.getSnapshot().user.profileSyncPending, false);
      assert.equal(session.getSnapshot().error, '');
    }
    fixture.profileChanged({ ...cached, fullName: 'From server' }, { fromCache: false });
    assert.equal(session.getSnapshot().user.fullName, 'From server');
    assert.equal(session.getSnapshot().user.profileSyncPending, false);
    session.stop();
  }
});

function clientFixture({ apps = [], initializationError, firestoreError } = {}) {
  const keys = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].map(
    (key) => `EXPO_PUBLIC_FIREBASE_${key}`,
  );
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    process.env[key] = 'local-test-config';
  });
  const calls = [];
  const app = { name: '[DEFAULT]' };
  const auth = { name: 'persisted-auth' };
  const filename = require.resolve('../.test-build/config/firebase/client');
  delete require.cache[filename];
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (request === 'firebase/app')
      return {
        getApps: () => apps,
        getApp: () => app,
        initializeApp: () => {
          calls.push('initialize-app');
          return app;
        },
      };
    if (request === 'firebase/auth')
      return {
        getAuth: () => {
          calls.push('get-existing-auth');
          return auth;
        },
      };
    if (request === './persistence')
      return {
        initializePlatformAuth: (selected) => {
          assert.equal(selected.name, '[DEFAULT]');
          calls.push('initialize-persistent-auth');
          if (initializationError) throw initializationError;
          return auth;
        },
      };
    if (request === './firestore')
      return {
        initializePlatformFirestore: (selected) => {
          assert.equal(selected, app);
          calls.push('initialize-firestore');
          if (firestoreError) throw firestoreError;
        },
      };
    return load.call(this, request, ...args);
  };
  try {
    return { client: require(filename), calls, auth };
  } finally {
    Module._load = load;
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
}

test('the primary Auth instance is initialized with platform persistence once and cached', () => {
  const fixture = clientFixture({ apps: [{ name: 'temporary-registration' }] });
  assert.equal(fixture.client.getFirebaseAuth(), fixture.auth);
  assert.equal(fixture.client.getFirebaseAuth(), fixture.auth);
  assert.deepEqual(fixture.calls, ['initialize-app', 'initialize-persistent-auth']);
});

test('Fast Refresh reuses previously initialized Auth without masking other initialization failures', () => {
  const fixture = clientFixture({
    apps: [{ name: '[DEFAULT]' }],
    initializationError: { code: 'auth/already-initialized' },
  });
  assert.equal(fixture.client.getFirebaseAuth(), fixture.auth);
  assert.deepEqual(fixture.calls, ['initialize-persistent-auth', 'get-existing-auth']);
  const failed = clientFixture({ initializationError: new Error('persistence failed') });
  assert.throws(() => failed.client.getFirebaseAuth(), /persistence failed/);
  assert.equal(failed.calls.includes('get-existing-auth'), false);
});

test('every repository receives the app only after Firestore transport is configured once', () => {
  const fixture = clientFixture();
  const app = fixture.client.getFirebaseApp();
  assert.equal(fixture.client.getFirebaseApp(), app);
  assert.deepEqual(fixture.calls, [
    'initialize-app',
    'initialize-persistent-auth',
    'initialize-firestore',
  ]);
  const failed = clientFixture({ firestoreError: new Error('transport setup failed') });
  assert.throws(() => failed.client.getFirebaseApp(), /transport setup failed/);
  assert.throws(() => failed.client.getFirebaseApp(), /transport setup failed/);
  assert.equal(failed.calls.filter((call) => call === 'initialize-firestore').length, 2);
});
