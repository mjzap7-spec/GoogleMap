const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProfileViewModel } = require('../.test-build/features/auth/viewmodels/ProfileViewModel');
const { AuthFormViewModel } = require('../.test-build/features/auth/viewmodels/AuthFormViewModel');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');
const {
  OpenMeteoCityRepository,
} = require('../.test-build/features/auth/data/OpenMeteoCityRepository');
const { validateProfile } = require('../.test-build/features/auth/models/validation');
const city = {
  id: '1',
  name: 'Orlando',
  state: 'Florida',
  country: 'United States',
  label: 'Orlando, Florida, United States',
};
const user = {
  id: 'one',
  email: 'person@example.com',
  fullName: 'Alex',
  birthday: '2000-01-01',
  location: city.label,
  avatarUrl: 'https://test.invalid/old.jpg',
};
const wait = () => new Promise((resolve) => setTimeout(resolve, 330));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
function vm(
  repository = {},
  cities = { search: async () => [city] },
  picker = { pick: async () => null },
) {
  return new ProfileViewModel(
    { saveProfile: async () => user.avatarUrl, ...repository },
    picker,
    cities,
    user,
  );
}

test('email and Google signup no longer require or submit profile details', async () => {
  const calls = [];
  const repo = {
    isConfigured: true,
    signUp: async (...args) => calls.push(args),
    signUpWithGoogle: async (...args) => calls.push(args),
  };
  const email = new AuthFormViewModel('signup', repo);
  email.setEmail('person@example.com');
  email.setPassword('password123');
  email.setConfirm('password123');
  await email.submit();
  assert.deepEqual(calls[0], ['person@example.com', 'password123']);
  const google = new AuthFormViewModel('signup', repo);
  await google.continueWithGoogle();
  assert.deepEqual(calls[1], []);
  assert.equal(google.getSnapshot().registrationComplete, true);
});

test('registration does not write a profile or need Firestore/Storage', async () => {
  const { repository, calls } = createFirebaseFixture({ options: {} });
  await repository.signUp('person@example.com', 'password123');
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['create'],
  );
});

test('Google registration establishes the primary session without a separate sign-in', async () => {
  const { repository, calls } = createFirebaseFixture({ options: {} });
  await repository.signUpWithGoogle();
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['google'],
  );
});

test('profile save creates the private document and preserves creation time on later edits', async () => {
  const profile = { fullName: 'Alex', birthday: '2000-01-01', location: city.label, avatar: null };
  for (const existingProfile of [undefined, { createdAt: 'original-time' }]) {
    const { repository, calls } = createFirebaseFixture({ existingProfile });
    const url = await repository.saveProfile(profile, null);
    assert.equal(url, null);
    assert.equal(
      calls.find((c) => c[0] === 'save-profile')[2].createdAt,
      existingProfile ? 'original-time' : 'server-time',
    );
    assert.equal(
      calls.some((c) => c[0] === 'create'),
      false,
    );
  }
});

test('failed profile writes clean up only the new avatar and keep the signed-in account', async () => {
  const { repository, calls } = createFirebaseFixture({
    runTransaction: async () => {
      throw { code: 'permission-denied' };
    },
  });
  await assert.rejects(
    repository.saveProfile(
      {
        fullName: 'Alex',
        birthday: '2000-01-01',
        location: city.label,
        avatar: { base64: '/9j/AA==', contentType: 'image/jpeg' },
      },
      user.avatarUrl,
    ),
    { code: 'profile-permission' },
  );
  assert.ok(calls.some((c) => c[0] === 'delete-avatar'));
  assert.equal(
    calls.some((c) => ['delete-account', 'delete-profile', 'sign-out'].includes(c[0])),
    false,
  );
});

test('Cloudinary avatar save persists only the URL, never the cleanup token or image bytes', async () => {
  const { repository, calls } = createFirebaseFixture({ options: {} });
  const url = await repository.saveProfile(
    {
      fullName: 'Alex',
      birthday: '2000-01-01',
      location: city.label,
      avatar: { base64: '/9j/AA==', contentType: 'image/jpeg' },
    },
    user.avatarUrl,
  );
  const saved = calls.find((c) => c[0] === 'save-profile')[2];
  assert.equal(url, 'https://res.cloudinary.com/test/image/upload/avatar.jpg');
  assert.deepEqual(saved, {
    fullName: 'Alex',
    birthday: '2000-01-01',
    location: city.label,
    avatarUrl: url,
    createdAt: 'server-time',
  });
});

test('saving an existing avatar needs no Cloudinary configuration or upload', async () => {
  const { repository } = createFirebaseFixture({
    avatarStorage: {
      upload: async () => assert.fail('No upload expected'),
      discard: async () => assert.fail('No deletion expected'),
    },
  });
  const saved = await repository.saveProfile(
    { fullName: 'Alex', birthday: '2000-01-01', location: city.label, avatar: null },
    user.avatarUrl,
  );
  assert.equal(saved, user.avatarUrl);
});

test('account changes during an upload cannot write a profile for the previous session', async () => {
  let fixture;
  fixture = createFirebaseFixture({
    avatarStorage: {
      upload: async () => {
        fixture.auth.currentUser = { uid: 'different-user' };
        return { url: 'https://res.cloudinary.com/test/image/upload/new.jpg' };
      },
      discard: async () => {},
    },
  });
  await assert.rejects(
    fixture.repository.saveProfile(
      {
        fullName: 'Alex',
        birthday: '2000-01-01',
        location: city.label,
        avatar: { base64: '/9j/AA==', contentType: 'image/jpeg' },
      },
      null,
    ),
    { code: 'invalid-credentials' },
  );
  assert.equal(
    fixture.calls.some((c) => c[0] === 'save-profile'),
    false,
  );
});

test('city selection populates state/country and editing invalidates the previous selection', async () => {
  const model = vm();
  model.setCityQuery('Orl');
  await wait();
  model.selectCity(model.getSnapshot().suggestions[0]);
  assert.equal(model.getSnapshot().location, city.label);
  assert.deepEqual(model.getSnapshot().suggestions, []);
  assert.equal(model.getSnapshot().searched, false);
  assert.equal(model.getSnapshot().selectedCity.country, 'United States');
  model.setCityQuery('London');
  assert.equal(model.getSnapshot().location, '');
  assert.equal(model.getSnapshot().selectedCity, null);
  await model.save();
  assert.match(model.getSnapshot().error, /Choose your city/);
  model.dispose();
});

test('late city results cannot replace a newer query or revive disposed state', async () => {
  const old = deferred();
  const latest = deferred();
  const model = vm({}, { search: (query) => (query === 'Orl' ? old.promise : latest.promise) });
  model.setCityQuery('Orl');
  await wait();
  model.setCityQuery('London');
  await wait();
  old.resolve([city]);
  await Promise.resolve();
  assert.deepEqual(model.getSnapshot().suggestions, []);
  model.dispose();
  latest.resolve([city]);
  await Promise.resolve();
  assert.deepEqual(model.getSnapshot().suggestions, []);
});

test('profile observer hydration does not overwrite unsaved edits', () => {
  const model = vm();
  model.hydrate({ ...user, fullName: 'Saved' });
  assert.equal(model.getSnapshot().fullName, 'Saved');
  model.setFullName('Editing');
  model.hydrate(user);
  assert.equal(model.getSnapshot().fullName, 'Editing');
  model.dispose();
});

test('city adapter maps real API fields and ignores non-city or malformed results', async () => {
  const previous = global.fetch;
  let url;
  global.fetch = async (requested) => {
    url = requested;
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            name: 'Orlando',
            admin1: 'Florida',
            country: 'United States',
            feature_code: 'PPLA2',
          },
          { id: 2, name: 'Lake', country: 'United States', feature_code: 'LK' },
          null,
        ],
      }),
    };
  };
  try {
    const result = await new OpenMeteoCityRepository().search('Orlando, FL');
    assert.equal(result[0].label, city.label);
    assert.equal(result.length, 1);
    assert.match(url, /Orlando%2C%20FL/);
  } finally {
    global.fetch = previous;
  }
});

test('avatar cancellation, removal, size validation and late results are handled in the profile', async () => {
  const picked = { uri: 'file:///avatar.jpg', base64: '/9j/AA==', contentType: 'image/jpeg' };
  const model = vm({}, undefined, { pick: async () => picked });
  await model.pickAvatar();
  assert.deepEqual(model.getSnapshot().avatar, picked);
  model.removeAvatar();
  assert.equal(model.getSnapshot().avatarUrl, null);
  assert.equal(model.getSnapshot().avatar, null);
  assert.match(
    validateProfile({
      ...model.getSnapshot(),
      avatar: { ...picked, base64: 'A'.repeat(7 * 1024 * 1024) },
    }),
    /5 MB/,
  );
  const pending = deferred();
  const late = vm({}, undefined, { pick: () => pending.promise });
  const selecting = late.pickAvatar();
  late.dispose();
  pending.resolve(picked);
  await selecting;
  assert.equal(late.getSnapshot().avatar, null);
  model.dispose();
});

test('city search failures show a recoverable error instead of a fake location', async () => {
  const model = vm(
    {},
    {
      search: async () => {
        throw new Error('offline');
      },
    },
  );
  model.setCityQuery('Orl');
  await wait();
  assert.equal(model.getSnapshot().location, '');
  assert.match(model.getSnapshot().locationError, /connection/);
  model.dispose();
});

test('profile saving blocks duplicates, clears pending avatar and ignores disposed results', async () => {
  const pending = deferred();
  let calls = 0;
  const model = vm({
    saveProfile: () => {
      calls++;
      return pending.promise;
    },
  });
  model.setFullName('Updated name');
  const saving = model.save();
  await model.save();
  assert.equal(calls, 1);
  model.dispose();
  pending.resolve(null);
  await saving;
  assert.equal(model.getSnapshot().notice, '');
});
