const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SessionViewModel } = require('../.test-build/features/auth/viewmodels/SessionViewModel');
const { createAuthDependencies } = require('../.test-build/features/auth/bindings/dependencies');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');
const complete = {
  id: 'one',
  email: 'person@example.com',
  fullName: 'Alex',
  birthday: '2000-01-01',
  location: 'Orlando, Florida, United States',
  profileStatus: 'ready',
};

test('completed profiles go Home; missing required fields require Profile and avatar remains optional', () => {
  let emit;
  const session = new SessionViewModel({
    isConfigured: true,
    observeSession: (callback) => {
      emit = callback;
      return () => {};
    },
  });
  session.start();
  emit({ ...complete, birthday: undefined, location: undefined, profileStatus: 'loading' });
  assert.equal(session.getSnapshot().profileRequired, false);
  for (const missing of [{ fullName: '' }, { birthday: undefined }, { location: '  ' }]) {
    emit({ ...complete, ...missing });
    assert.equal(session.getSnapshot().profileRequired, true);
  }
  emit({ ...complete, avatarUrl: null });
  assert.equal(session.getSnapshot().profileRequired, false);
  emit(null);
  assert.equal(session.getSnapshot().profileRequired, false);
  session.stop();
});

test('an uncached missing profile waits for the server result before it is treated as empty', () => {
  const fixture = createFirebaseFixture();
  const updates = [];
  const stop = fixture.repository.observeSession(
    (user) => updates.push(user),
    () => {},
  );
  fixture.authChanged(fixture.user);
  assert.equal(updates.at(-1).profileStatus, 'loading');
  fixture.profileChanged(undefined, { fromCache: true });
  assert.equal(updates.at(-1).profileStatus, 'loading');
  fixture.profileChanged(undefined, { fromCache: false });
  assert.equal(updates.at(-1).profileStatus, 'ready');
  assert.equal(updates.at(-1).birthday, undefined);
  stop();
});

test('profile read failures preserve authentication and are distinct from confirmed empty profiles', () => {
  const fixture = createFirebaseFixture();
  const session = new SessionViewModel(fixture.repository);
  session.start();
  fixture.authChanged(fixture.user);
  fixture.profileError();
  assert.equal(session.getSnapshot().user.id, fixture.user.uid);
  assert.equal(session.getSnapshot().user.profileStatus, 'error');
  assert.equal(session.getSnapshot().profileRequired, false);
  assert.match(session.getSnapshot().error, /profile could not be loaded/);
  session.stop();
});

test('successful Profile save clears the incomplete flag before Home navigation, without waiting for another snapshot', async () => {
  let emit;
  const repository = {
    isConfigured: true,
    observeSession: (callback) => {
      emit = callback;
      return () => {};
    },
    saveProfile: async () => null,
  };
  const dependencies = createAuthDependencies({
    repository,
    avatarPicker: { pick: async () => null },
    cities: { search: async () => [] },
  });
  dependencies.session.start();
  emit({ ...complete, location: '' });
  assert.equal(dependencies.session.getSnapshot().profileRequired, true);
  const profile = dependencies.createProfile(complete);
  profile.setFullName('Updated name');
  await profile.save();
  assert.equal(dependencies.session.getSnapshot().profileRequired, false);
  assert.equal(dependencies.session.getSnapshot().user.fullName, 'Updated name');
  assert.equal(profile.getSnapshot().saveComplete, true);
  profile.dispose();
  dependencies.session.stop();
});
