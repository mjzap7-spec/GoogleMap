const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthDependencies } = require('../.test-build/features/auth/bindings/dependencies');
const { ProfileViewModel } = require('../.test-build/features/auth/viewmodels/ProfileViewModel');
const { AuthFailure } = require('../.test-build/features/auth/models/AuthFailure');
const user = {
  id: 'one',
  email: 'person@example.com',
  fullName: 'Alex',
  birthday: '2000-01-01',
  location: 'Orlando, Florida, United States',
};

function setup(action) {
  let change;
  const repo = {
    isConfigured: true,
    observeSession: (callback) => {
      change = callback;
      callback(null);
      return () => {};
    },
    signUp: () => action(() => change(user)),
    signUpWithGoogle: () => action(() => change(user)),
    signIn: async () => change(user),
    signInWithGoogle: async () => change(user),
    saveProfile: async () => null,
    signOut: async () => change(null),
  };
  const dependencies = createAuthDependencies({
    repository: repo,
    avatarPicker: { pick: async () => null },
    cities: { search: async () => [] },
  });
  dependencies.session.start();
  const form = dependencies.createForm('signup');
  form.setEmail(user.email);
  form.setPassword('password123');
  form.setConfirm('password123');
  return { ...dependencies, form, change: (value) => change(value) };
}

test('registration marks the Profile destination before an early Firebase sign-in event', async () => {
  for (const google of [false, true]) {
    const flow = setup(async (emit) => emit());
    if (google) await flow.form.continueWithGoogle();
    else await flow.form.submit();
    assert.equal(flow.session.getSnapshot().user.id, user.id);
    assert.equal(flow.session.getSnapshot().registrationProfilePending, true);
    flow.session.acknowledgeRegistrationLanding();
    assert.equal(flow.session.getSnapshot().registrationProfilePending, false);
    flow.session.stop();
  }
});

test('registration keeps its Profile destination when the SDK session event arrives late', async () => {
  const flow = setup(async () => {});
  await flow.form.submit();
  assert.equal(flow.session.getSnapshot().user, null);
  assert.equal(flow.session.getSnapshot().registrationProfilePending, true);
  flow.change(user);
  assert.equal(flow.session.getSnapshot().registrationProfilePending, true);
  flow.session.stop();
});

test('failed registration clears the Profile destination so a later sign-in goes Home', async () => {
  const flow = setup(async () => {
    throw new AuthFailure('email-in-use');
  });
  await flow.form.submit();
  assert.equal(flow.session.getSnapshot().registrationProfilePending, false);
  const signin = flow.createForm('signin');
  signin.setEmail(user.email);
  signin.setPassword('password123');
  await signin.submit();
  assert.equal(flow.session.getSnapshot().user.id, user.id);
  assert.equal(flow.session.getSnapshot().registrationProfilePending, false);
  flow.session.stop();
});

test('normal Google sign-in and session restoration do not request Profile', async () => {
  const flow = setup(async () => {});
  await flow.createForm('signin').continueWithGoogle();
  assert.equal(flow.session.getSnapshot().user.id, user.id);
  assert.equal(flow.session.getSnapshot().registrationProfilePending, false);
  flow.session.stop();
  flow.session.start();
  flow.change(user);
  assert.equal(flow.session.getSnapshot().registrationProfilePending, false);
  flow.session.stop();
});

test('Profile signals Home navigation only after successful save, never on validation or backend failure', async () => {
  for (const failed of [true, false]) {
    const model = new ProfileViewModel(
      {
        saveProfile: async () => {
          if (failed) throw new AuthFailure('profile-permission');
          return null;
        },
      },
      { pick: async () => null },
      { search: async () => [] },
      user,
    );
    model.setFullName('');
    await model.save();
    assert.equal(model.getSnapshot().saveComplete, false);
    model.setFullName('Updated name');
    await model.save();
    assert.equal(model.getSnapshot().saveComplete, !failed);
    model.dispose();
  }
});
