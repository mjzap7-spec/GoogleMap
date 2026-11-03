const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthDependencies } = require('../.test-build/features/auth/bindings/dependencies');

function services() {
  const avatar = { uri: 'file:///sample.jpg', base64: '/9j/AA==', contentType: 'image/jpeg' };
  let subscriptions = 0;
  let unsubscriptions = 0;
  return {
    repository: {
      isConfigured: true,
      observeSession: (next) => {
        subscriptions++;
        next(null);
        return () => unsubscriptions++;
      },
      signIn: async () => {},
      signUp: async () => {},
      signInWithGoogle: async () => {},
      signUpWithGoogle: async () => {},
      saveProfile: async () => null,
      resetPassword: async () => {},
      signOut: async () => {},
    },
    avatarPicker: { pick: async () => avatar },
    cities: { search: async () => [] },
    avatar,
    counts: () => ({ subscriptions, unsubscriptions }),
  };
}

test('dependency factory injects a replaceable avatar picker without platform dependencies', async () => {
  const fake = services();
  const dependencies = createAuthDependencies(fake);
  const signup = dependencies.createProfile({ id: 'one', email: 'person@example.com' });
  await signup.pickAvatar();
  assert.deepEqual(signup.getSnapshot().avatar, fake.avatar);
});

test('route forms have independent state and disposal does not clear another form', () => {
  const dependencies = createAuthDependencies(services());
  const signin = dependencies.createForm('signin');
  const signup = dependencies.createForm('signup');
  signin.setEmail('first@example.com');
  signup.setEmail('second@example.com');
  signin.dispose();
  assert.equal(signup.getSnapshot().email, 'second@example.com');
  assert.equal(signin.getSnapshot().email, 'first@example.com');
});

test('session lifecycle uses the injected repository and releases subscriptions', () => {
  const fake = services();
  const dependencies = createAuthDependencies(fake);
  dependencies.session.start();
  assert.equal(dependencies.session.getSnapshot().loading, false);
  dependencies.session.stop();
  assert.deepEqual(fake.counts(), { subscriptions: 1, unsubscriptions: 1 });
});
