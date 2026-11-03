const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthFormViewModel } = require('../.test-build/features/auth/viewmodels/AuthFormViewModel');
const { SessionViewModel } = require('../.test-build/features/auth/viewmodels/SessionViewModel');
const { AuthFailure } = require('../.test-build/features/auth/models/AuthFailure');
const {
  validateAuthForm,
  validateProfile,
} = require('../.test-build/features/auth/models/validation');

function repository(overrides = {}) {
  return {
    isConfigured: true,
    observeSession: () => () => {},
    signIn: async () => {},
    signUp: async () => {},
    signInWithGoogle: async () => {},
    signUpWithGoogle: async () => {},
    resetPassword: async () => {},
    signOut: async () => {},
    ...overrides,
  };
}
function form(mode = 'signin', overrides = {}) {
  const vm = new AuthFormViewModel(mode, repository(overrides));
  vm.setEmail('  person@example.com  ');
  vm.setPassword('password123');
  vm.setConfirm('password123');
  return vm;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('Google sign-in blocks duplicate requests and ignores disposed results', async () => {
  const request = deferred();
  let calls = 0;
  const vm = form('signin', {
    signInWithGoogle: () => {
      calls++;
      return request.promise;
    },
  });
  const pending = vm.continueWithGoogle();
  await vm.continueWithGoogle();
  assert.equal(calls, 1);
  vm.dispose();
  request.reject(new AuthFailure('auth-cancelled'));
  await pending;
  assert.equal(vm.getSnapshot().error, '');
  assert.equal(vm.getSnapshot().googleBusy, false);
});

test('validation distinguishes sign-in, sign-up, and reset requirements', () => {
  const valid = {
    fullName: 'Alex Taylor',
    birthday: '1995-06-15',
    location: 'New York, USA',
    avatar: null,
    email: 'person@example.com',
    password: 'password123',
    confirm: 'password123',
  };
  assert.equal(validateAuthForm('signup', valid), null);
  assert.match(validateAuthForm('signup', { ...valid, email: 'bad' }), /email/);
  assert.match(validateAuthForm('signup', { ...valid, password: 'short' }), /8 characters/);
  assert.match(validateAuthForm('signup', { ...valid, confirm: 'different' }), /do not match/);
  assert.equal(validateAuthForm('signin', { ...valid, password: 'short', confirm: '' }), null);
  assert.equal(validateAuthForm('reset', { ...valid, password: '', confirm: '' }), null);
});

test('missing configuration and invalid input never invoke the repository', async () => {
  let calls = 0;
  const signIn = async () => {
    calls++;
  };
  const unconfigured = form('signin', { isConfigured: false, signIn });
  await unconfigured.submit();
  assert.match(unconfigured.getSnapshot().error, /configuration/);
  const invalid = form('signin', { signIn });
  invalid.setEmail('bad');
  await invalid.submit();
  assert.match(invalid.getSnapshot().error, /email/);
  assert.equal(calls, 0);
});

test('submit trims email, preserves password, blocks duplicate requests, then clears credentials', async () => {
  const request = deferred();
  const calls = [];
  const vm = form('signin', {
    signIn: (...args) => {
      calls.push(args);
      return request.promise;
    },
  });
  vm.setPassword(' password123 ');
  const pending = vm.submit();
  assert.equal(vm.getSnapshot().busy, true);
  vm.setEmail('ignored@example.com');
  await vm.submit();
  assert.deepEqual(calls, [['person@example.com', ' password123 ']]);
  request.resolve();
  await pending;
  assert.equal(vm.getSnapshot().busy, false);
  assert.equal(vm.getSnapshot().password, '');
  assert.equal(vm.getSnapshot().confirm, '');
});

test('signup invokes only signup; errors produce recoverable presentation state', async () => {
  let calls = 0;
  const vm = form('signup', {
    signUp: async () => {
      calls++;
      throw new AuthFailure('email-in-use');
    },
    signIn: async () => assert.fail('wrong command'),
  });
  await vm.submit();
  assert.equal(calls, 1);
  assert.equal(vm.getSnapshot().busy, false);
  assert.match(vm.getSnapshot().error, /already has an account/);
});

test('reset needs no password and returns a neutral account-enumeration message', async () => {
  let email;
  const vm = form('reset', {
    resetPassword: async (value) => {
      email = value;
    },
  });
  vm.setPassword('');
  vm.setConfirm('');
  await vm.submit();
  assert.equal(email, 'person@example.com');
  assert.match(vm.getSnapshot().notice, /If this email has an account/);
  assert.equal(vm.getSnapshot().resetRequested, true);
  vm.dispose();
  assert.equal(vm.getSnapshot().resetRequested, false);
});

test('failed reset requests do not arm navigation on returning from email', async () => {
  const vm = form('reset', {
    resetPassword: async () => {
      throw new AuthFailure('offline');
    },
  });
  await vm.submit();
  assert.equal(vm.getSnapshot().resetRequested, false);
  assert.equal(vm.getSnapshot().notice, '');
});

test('leaving a form clears secrets and ignores late asynchronous results', async () => {
  const request = deferred();
  const vm = form('signin', { signIn: () => request.promise });
  const pending = vm.submit();
  vm.dispose();
  const afterDispose = vm.getSnapshot();
  request.reject(new AuthFailure('offline'));
  await pending;
  assert.equal(vm.getSnapshot(), afterDispose);
  assert.equal(afterDispose.password, '');
  assert.equal(afterDispose.busy, false);
});

test('session restoration maps user state, unsubscribes, and ignores stale observer callbacks', () => {
  let change,
    failure,
    stops = 0;
  const vm = new SessionViewModel(
    repository({
      observeSession: (next, error) => {
        change = next;
        failure = error;
        return () => stops++;
      },
    }),
  );
  vm.start();
  assert.equal(vm.getSnapshot().loading, true);
  change({ id: 'one', email: 'person@example.com' });
  assert.equal(vm.getSnapshot().user.id, 'one');
  assert.equal(vm.getSnapshot().loading, false);
  vm.stop();
  const stopped = vm.getSnapshot();
  change(null);
  failure(new AuthFailure('offline'));
  assert.equal(stops, 1);
  assert.equal(vm.getSnapshot(), stopped);
});

test('observer errors leave loading state and allow a successful retry', () => {
  let next;
  let attempts = 0;
  const vm = new SessionViewModel(
    repository({
      observeSession: (onChange, onError) => {
        attempts++;
        next = onChange;
        if (attempts === 1) onError(new AuthFailure('offline'));
        return () => {};
      },
    }),
  );
  vm.start();
  assert.equal(vm.getSnapshot().loading, false);
  assert.match(vm.getSnapshot().error, /internet/);
  vm.start();
  next(null);
  assert.equal(vm.getSnapshot().error, '');
  assert.equal(vm.getSnapshot().loading, false);
});

test('sign-out waits for the observer, blocks duplicate requests, and reports failures', async () => {
  const request = deferred();
  let change;
  let calls = 0;
  const vm = new SessionViewModel(
    repository({
      observeSession: (next) => {
        change = next;
        return () => {};
      },
      signOut: () => {
        calls++;
        return request.promise;
      },
    }),
  );
  vm.start();
  change({ id: 'one', email: 'person@example.com' });
  const pending = vm.logout();
  await vm.logout();
  assert.equal(calls, 1);
  assert.equal(vm.getSnapshot().busy, true);
  request.reject(new AuthFailure('offline'));
  await pending;
  assert.equal(vm.getSnapshot().user.id, 'one');
  assert.equal(vm.getSnapshot().busy, false);
  assert.match(vm.getSnapshot().error, /internet/);
  change(null);
  assert.equal(vm.getSnapshot().user, null);
});

test('unconfigured session avoids Firebase and snapshots notify only active subscribers', () => {
  const vm = new SessionViewModel(
    repository({ isConfigured: false, observeSession: () => assert.fail('should not observe') }),
  );
  let notifications = 0;
  const unsubscribe = vm.subscribe(() => notifications++);
  vm.start();
  assert.equal(vm.getSnapshot().loading, false);
  assert.equal(notifications, 0, 'an unchanged signed-out snapshot does not re-render');
  vm.beginRegistration();
  assert.equal(notifications, 1);
  assert.ok(Object.isFrozen(vm.getSnapshot()));
  unsubscribe();
  const before = notifications;
  vm.stop();
  assert.equal(notifications, before);
});

test('profile editing requires details and validates real calendar dates without imposing an age limit', () => {
  const valid = {
    fullName: 'Alex Taylor',
    birthday: '2000-02-29',
    location: 'New York',
    avatar: null,
    email: 'person@example.com',
    password: 'password123',
    confirm: 'password123',
  };
  const today = new Date(2026, 9, 30);
  assert.equal(validateProfile(valid, today), null);
  assert.match(validateProfile({ ...valid, fullName: '   ' }, today), /full name/);
  assert.match(validateProfile({ ...valid, location: '  ' }, today), /location/);
  for (const birthday of [
    '2001-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-10-31',
    '1899-12-31',
    '10/30/2000',
  ]) {
    assert.match(validateProfile({ ...valid, birthday }, today), /birthday/);
  }
  assert.equal(validateProfile({ ...valid, birthday: '2026-10-30' }, today), null);
  assert.equal(
    validateAuthForm('signin', { ...valid, fullName: '', birthday: '', location: '' }),
    null,
  );
});

test('registration completion is signaled only after signup succeeds and cannot be submitted twice', async () => {
  const request = deferred();
  let calls = 0;
  const vm = form('signup', {
    signUp: () => {
      calls++;
      return request.promise;
    },
  });
  const pending = vm.submit();
  assert.equal(vm.getSnapshot().registrationComplete, false);
  request.resolve();
  await pending;
  assert.equal(vm.getSnapshot().registrationComplete, true);
  assert.equal(vm.getSnapshot().busy, false);
  assert.equal(vm.getSnapshot().password, '');
  await vm.submit();
  assert.equal(calls, 1);
  vm.dispose();
  assert.equal(vm.getSnapshot().registrationComplete, false);
});

test('failed or disposed registration never signals success navigation', async () => {
  const failed = form('signup', {
    signUp: async () => {
      throw new AuthFailure('profile-permission');
    },
  });
  await failed.submit();
  assert.equal(failed.getSnapshot().registrationComplete, false);
  assert.ok(failed.getSnapshot().error);
  const request = deferred();
  const disposed = form('signup', { signUp: () => request.promise });
  const pending = disposed.submit();
  disposed.dispose();
  request.resolve();
  await pending;
  assert.equal(disposed.getSnapshot().registrationComplete, false);
});
