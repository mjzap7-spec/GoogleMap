const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');

test('Google sign-in authenticates the primary session', async () => {
  const { repository, calls } = createFirebaseFixture();
  await repository.signInWithGoogle();
  assert.deepEqual(calls, [['google', 'main']]);
});

test('Google popup cancellation is surfaced without creating an account', async () => {
  const { repository, calls } = createFirebaseFixture({
    signInWithPopup: async () => {
      throw { code: 'auth/popup-closed-by-user' };
    },
  });
  await assert.rejects(repository.signInWithGoogle(), { code: 'auth-cancelled' });
  assert.deepEqual(calls, []);
});

test('Google registration never modifies or removes an existing account', async () => {
  const { repository, calls } = createFirebaseFixture({
    getAdditionalUserInfo: () => ({ isNewUser: false }),
  });
  await repository.signUpWithGoogle();
  assert.equal(
    calls.some((call) =>
      ['save-profile', 'auth-profile', 'delete-account', 'delete-profile'].includes(call[0]),
    ),
    false,
  );
  assert.deepEqual(calls, [['google', 'main']]);
});

test('password reset sends the address to the primary Firebase Auth instance', async () => {
  const { repository, calls } = createFirebaseFixture();
  await repository.resetPassword('person@example.com');
  assert.deepEqual(calls, [['reset-password', 'person@example.com']]);
});

test('password reset preserves neutral results for missing accounts', async () => {
  const { repository } = createFirebaseFixture({
    sendPasswordResetEmail: async () => {
      throw { code: 'auth/user-not-found' };
    },
  });
  await assert.doesNotReject(repository.resetPassword('missing@example.com'));
});

test('password reset surfaces delivery failures instead of reporting success', async () => {
  for (const [firebaseCode, domainCode] of [
    ['auth/network-request-failed', 'offline'],
    ['auth/too-many-requests', 'rate-limited'],
    ['auth/quota-exceeded', 'email-quota'],
    ['auth/invalid-message-payload', 'email-configuration'],
    ['auth/invalid-sender', 'email-configuration'],
    ['auth/operation-not-allowed', 'provider-disabled'],
    ['auth/invalid-api-key', 'auth-configuration'],
  ]) {
    const { repository } = createFirebaseFixture({
      sendPasswordResetEmail: async () => {
        throw { code: firebaseCode };
      },
    });
    await assert.rejects(repository.resetPassword('person@example.com'), { code: domainCode });
  }
});

test('profile subscriptions map domain fields, preserve auth on profile failure, and stop stale callbacks', () => {
  const fixture = createFirebaseFixture();
  const updates = [],
    errors = [];
  const stop = fixture.repository.observeSession(
    (value) => updates.push(value),
    (error) => errors.push(error),
  );
  fixture.authChanged({ ...fixture.user, displayName: 'Alex', photoURL: null });
  fixture.profileChanged({
    fullName: 'Alex Taylor',
    birthday: '1995-06-15',
    location: 'New York',
    avatarUrl: 'https://test.invalid/avatar.jpg',
  });
  assert.equal(updates.at(-1).birthday, '1995-06-15');
  fixture.profileError();
  assert.equal(errors.at(-1).code, 'profile-unavailable');
  assert.equal(updates.at(-1).id, 'new-user');
  stop();
  const before = updates.length;
  fixture.profileChanged({ fullName: 'stale' });
  assert.equal(updates.length, before);
  assert.ok(fixture.calls.some((call) => call[0] === 'stop-profile'));
  assert.ok(fixture.calls.some((call) => call[0] === 'stop-auth'));
});

test('successful signup never calls the primary sign-in service', async () => {
  const { repository, calls } = createFirebaseFixture({
    signInWithEmailAndPassword: async () => assert.fail('Sign-up must not sign in automatically'),
  });
  await repository.signUp('person@example.com', 'password123');
  assert.equal(
    calls.some((call) => call[0] === 'sign-in'),
    false,
  );
  assert.equal(
    calls.some((call) => call[0].startsWith('delete-')),
    false,
  );
});
