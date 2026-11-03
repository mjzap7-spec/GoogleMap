const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PasswordViewModel } = require('../.test-build/features/auth/viewmodels/PasswordViewModel');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');

function fill(vm) {
  vm.setField('current', 'old-password');
  vm.setField('password', 'new-password');
  vm.setField('confirm', 'new-password');
}
test('password changes validate, prevent duplicate submissions, and clear secrets on success', async () => {
  let finish,
    calls = 0;
  const vm = new PasswordViewModel(
    {
      changePassword: () => {
        calls++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
    'user',
  );
  await vm.save();
  assert.equal(calls, 0);
  fill(vm);
  vm.setField('confirm', 'mismatch');
  await vm.save();
  assert.equal(calls, 0);
  vm.setField('confirm', 'new-password');
  const pending = vm.save();
  await vm.save();
  assert.equal(calls, 1);
  finish();
  await pending;
  assert.equal(vm.getSnapshot().current, '');
  assert.equal(vm.getSnapshot().password, '');
  assert.equal(vm.getSnapshot().confirm, '');
  assert.match(vm.getSnapshot().notice, /updated/);
});
test('disposing password editor clears secrets and ignores late results', async () => {
  let finish;
  const vm = new PasswordViewModel(
    {
      changePassword: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    'user',
  );
  fill(vm);
  const pending = vm.save();
  vm.dispose();
  finish();
  await pending;
  assert.equal(vm.getSnapshot().password, '');
  assert.equal(vm.getSnapshot().notice, '');
});
test('Firebase reauthenticates before password update and rejects wrong passwords without updating', async () => {
  const fixture = createFirebaseFixture();
  await fixture.repository.changePassword(fixture.user.uid, 'old', 'new-password');
  assert.deepEqual(
    fixture.calls.map((call) => call[0]),
    ['reauthenticate', 'update-password'],
  );
  const failure = createFirebaseFixture({
    reauthenticateWithCredential: async () => {
      throw { code: 'auth/wrong-password' };
    },
  });
  await assert.rejects(
    failure.repository.changePassword(failure.user.uid, 'bad', 'new-password'),
    /incorrect/,
  );
  assert.equal(
    failure.calls.some((call) => call[0] === 'update-password'),
    false,
  );
});
test('Firebase password update cannot cross an account switch or change Google-only accounts', async () => {
  let fixture;
  fixture = createFirebaseFixture({
    reauthenticateWithCredential: async () => {
      fixture.auth.currentUser = { uid: 'another' };
    },
  });
  await assert.rejects(
    fixture.repository.changePassword(fixture.user.uid, 'old', 'new-password'),
    /session changed/,
  );
  assert.equal(
    fixture.calls.some((call) => call[0] === 'update-password'),
    false,
  );
  const google = createFirebaseFixture();
  google.user.providerData = [{ providerId: 'google.com' }];
  await assert.rejects(
    google.repository.changePassword(google.user.uid, 'old', 'new-password'),
    /managed by Google/,
  );
  assert.equal(google.calls.length, 0);
});
