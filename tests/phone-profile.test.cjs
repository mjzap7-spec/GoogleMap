const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProfileViewModel } = require('../.test-build/features/auth/viewmodels/ProfileViewModel');
const { SessionViewModel } = require('../.test-build/features/auth/viewmodels/SessionViewModel');
const { validateProfile } = require('../.test-build/features/auth/models/validation');
const { validatePhoneNumber } = require('../.test-build/features/auth/models/phoneNumber');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');
const user = {
  id: 'one',
  email: 'alex@example.com',
  fullName: 'Alex',
  birthday: '2000-01-01',
  location: 'Orlando, Florida, United States',
  profileStatus: 'ready',
};
const profile = { ...user, avatar: null };
function editor(initial = user, save = async () => null, onSaved) {
  return new ProfileViewModel(
    { saveProfile: save },
    { pick: async () => null },
    { search: async () => [] },
    initial,
    onSaved,
  );
}

test('phone is optional; full name, birthday and location remain required', async () => {
  for (const phoneNumber of [undefined, '', '   ', '+1 (202) 555-0123', '020 7946 0958'])
    assert.equal(validateProfile({ ...profile, phoneNumber }), null);
  for (const field of ['fullName', 'birthday', 'location']) {
    const draft = editor({ ...user, [field]: '' }, async () =>
      assert.fail('Incomplete profile saved'),
    );
    draft.setPhoneNumber('+12025550123');
    await draft.save();
    assert.ok(draft.getSnapshot().error);
    assert.equal(draft.getSnapshot().saveComplete, false);
    draft.dispose();
  }
  const saved = [];
  const draft = editor(user, async (value) => {
    saved.push(value);
    return null;
  });
  draft.setFullName('Alex Updated');
  await draft.save();
  assert.equal(saved.length, 1);
  assert.equal('phoneNumber' in saved[0], false);
  assert.equal(draft.getSnapshot().saveComplete, true);
  draft.dispose();
});

test('optional phone rejects malformed input, saves normalized input, and can be cleared', async () => {
  for (const phone of [
    'abc',
    '123',
    '1'.repeat(16),
    '++12025550123',
    '+1/2025550123',
    '+1x2025550123',
  ])
    assert.ok(validatePhoneNumber(phone));
  const saved = [];
  const draft = editor(user, async (value) => {
    saved.push(value);
    return null;
  });
  draft.setPhoneNumber('bad number');
  await draft.save();
  assert.equal(saved.length, 0);
  assert.ok(draft.getSnapshot().error);
  draft.setPhoneNumber('+1 (202) 555-0123');
  await draft.save();
  assert.equal(saved[0].phoneNumber, '+12025550123');
  assert.equal(draft.getSnapshot().phoneNumber, '+12025550123');
  draft.setPhoneNumber('');
  await draft.save();
  assert.equal(saved[1].phoneNumber, '');
  draft.dispose();
});

test('late phone hydration preserves edits and saving another field never clears an unread number', async () => {
  const saved = [];
  const draft = editor(user, async (value) => {
    saved.push(value);
    return null;
  });
  draft.setFullName('Editing name');
  draft.hydrate({ ...user, phoneNumber: '+12025550123' });
  assert.equal(draft.getSnapshot().fullName, 'Editing name');
  assert.equal(draft.getSnapshot().phoneNumber, '+12025550123');
  await draft.save();
  assert.equal('phoneNumber' in saved[0], false);
  draft.setPhoneNumber('+442079460958');
  draft.hydrate({ ...user, phoneNumber: '+12025550123' });
  assert.equal(draft.getSnapshot().phoneNumber, '+442079460958');
  draft.dispose();
});

test('phone changes share the profile transaction but are never stored in the contact-readable document', async () => {
  for (const phoneNumber of [undefined, '', '+1 (202) 555-0123']) {
    const fixture = createFirebaseFixture();
    await fixture.repository.saveProfile({ ...profile, phoneNumber }, null);
    const writes = fixture.calls.filter(([kind]) => kind === 'save-profile');
    assert.equal('phoneNumber' in writes[0][2], false);
    assert.equal(writes.length, phoneNumber === undefined ? 1 : 2);
    if (phoneNumber !== undefined) {
      assert.deepEqual(writes[1][1].children, ['private', 'phone']);
      assert.equal(writes[1][2].phoneNumber, phoneNumber ? '+12025550123' : '');
    }
  }
});

test('phone snapshots merge independently without delaying onboarding or restarting on token refresh', () => {
  const fixture = createFirebaseFixture();
  const session = new SessionViewModel(fixture.repository);
  session.start();
  fixture.authChanged(fixture.user);
  fixture.phoneChanged({ phoneNumber: '+12025550123' });
  assert.equal(session.getSnapshot().user.profileStatus, 'loading');
  fixture.profileChanged(profile);
  assert.equal(session.getSnapshot().user.phoneNumber, '+12025550123');
  assert.equal(session.getSnapshot().profileRequired, false);
  fixture.authChanged({ ...fixture.user });
  assert.equal(fixture.calls.filter(([kind]) => kind === 'watch-phone').length, 1);
  fixture.phoneChanged(undefined, { fromCache: true });
  assert.equal(session.getSnapshot().user.phoneNumber, '+12025550123');
  fixture.phoneChanged(undefined, { fromCache: false });
  assert.equal(session.getSnapshot().user.phoneNumber, '');
  fixture.phoneError();
  assert.equal(session.getSnapshot().error, '');
  fixture.authChanged(null);
  fixture.phoneChanged({ phoneNumber: '+12025550123' });
  assert.equal(session.getSnapshot().user, null);
  assert.ok(fixture.calls.some(([kind]) => kind === 'stop-phone'));
  session.stop();
});

test('profile saved updates phone immediately and unrelated profile edits retain it', () => {
  let emit;
  const session = new SessionViewModel({
    isConfigured: true,
    observeSession: (callback) => {
      emit = callback;
      return () => {};
    },
  });
  session.start();
  emit(user);
  session.profileSaved(user.id, { ...profile, phoneNumber: '+12025550123' }, null);
  assert.equal(session.getSnapshot().user.phoneNumber, '+12025550123');
  session.profileSaved(user.id, profile, null);
  assert.equal(session.getSnapshot().user.phoneNumber, '+12025550123');
  session.profileSaved(user.id, { ...profile, phoneNumber: '' }, null);
  assert.equal(session.getSnapshot().user.phoneNumber, '');
  assert.equal(session.getSnapshot().profileRequired, false);
  session.stop();
});
