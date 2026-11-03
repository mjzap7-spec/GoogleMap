const assert = require('node:assert/strict');
const Module = require('node:module');

// Scope module replacement to adapter loading; never call a live Firebase project.
function createFirebaseFixture(overrides = {}) {
  const calls = [];
  const mainAuth = { name: 'main' };
  const temporaryAuth = { name: 'registration' };
  const user = {
    uid: 'new-user',
    email: 'person@example.com',
    providerData: [{ providerId: 'password' }],
  };
  mainAuth.currentUser = user;
  const options = overrides.options ?? { storageBucket: 'test-bucket' };
  let authChanged, profileChanged, profileError;
  const mocks = {
    'firebase/app': {
      initializeApp: () => {
        calls.push(['temporary-app']);
        return { options };
      },
      deleteApp: async () => {
        calls.push(['dispose']);
      },
    },
    'firebase/auth': {
      EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
      reauthenticateWithCredential: async (user, credential) => {
        calls.push(['reauthenticate', user.uid, credential]);
      },
      updatePassword: async (user) => {
        calls.push(['update-password', user.uid]);
      },
      GoogleAuthProvider: class {
        setCustomParameters() {}
      },
      getAdditionalUserInfo: () => ({ isNewUser: true }),
      signInWithPopup: async (auth) => {
        calls.push(['google', auth.name]);
        return {
          user: {
            ...user,
            displayName: 'Google User',
            photoURL: 'https://test.invalid/google.jpg',
          },
        };
      },
      initializeAuth: () => temporaryAuth,
      inMemoryPersistence: {},
      onIdTokenChanged: (auth, callback) => {
        authChanged = callback;
        return () => calls.push(['stop-auth']);
      },
      createUserWithEmailAndPassword: async (auth) => {
        assert.equal(auth, mainAuth);
        calls.push(['create']);
        return { user };
      },
      deleteUser: async () => {
        calls.push(['delete-account']);
      },
      updateProfile: async (created, data) => {
        assert.equal(created, user);
        calls.push(['auth-profile', data]);
      },
      signInWithEmailAndPassword: async (auth, email) => {
        assert.equal(auth, mainAuth);
        calls.push(['sign-in', email]);
      },
      sendPasswordResetEmail: async (auth, email) => {
        assert.equal(auth, mainAuth);
        calls.push(['reset-password', email]);
      },
      signOut: async () => {
        calls.push(['sign-out']);
      },
    },
    'firebase/firestore': {
      runTransaction: async (db, callback) =>
        callback({
          get: async () => ({
            exists: () => Boolean(overrides.existingProfile),
            data: () => overrides.existingProfile,
          }),
          set: (path, data) => calls.push(['save-profile', path, data]),
        }),
      getFirestore: () => ({}),
      doc: (db, collection, id) => ({ collection, id }),
      serverTimestamp: () => 'server-time',
      setDoc: async (path, data) => {
        calls.push(['save-profile', path, data]);
      },
      deleteDoc: async () => {
        calls.push(['delete-profile']);
      },
      onSnapshot: (path, options, success, error) => {
        calls.push(['watch-profile', path.id]);
        profileChanged = success;
        profileError = error;
        return () => calls.push(['stop-profile']);
      },
    },
    '../../../config/firebase/client': {
      isFirebaseConfigured: true,
      getFirebaseAuth: () => mainAuth,
      getFirebaseApp: () => ({ options }),
    },
  };
  for (const [name, value] of Object.entries(overrides)) {
    if (name !== 'options') {
      for (const group of Object.values(mocks)) if (name in group) group[name] = value;
    }
  }
  mocks['../../../../config/firebase/client'] = mocks['../../../config/firebase/client'];
  const filename = require.resolve('../../.test-build/features/auth/data/FirebaseAuthRepository');
  for (const cached of Object.keys(require.cache)) {
    if (
      cached === filename ||
      cached.startsWith(
        require('node:path').join(require('node:path').dirname(filename), 'firebase') +
          require('node:path').sep,
      )
    )
      delete require.cache[cached];
  }
  const load = Module._load;
  Module._load = function (request, ...args) {
    return mocks[request] ?? load.call(this, request, ...args);
  };
  let Repository;
  try {
    Repository = require(filename).FirebaseAuthRepository;
  } finally {
    Module._load = load;
  }
  return {
    repository: new Repository(
      overrides.avatarStorage ?? {
        upload: async (avatar) => {
          calls.push(['upload-avatar', avatar]);
          return {
            url: 'https://res.cloudinary.com/test/image/upload/avatar.jpg',
            cleanupToken: 'temporary-token',
          };
        },
        discard: async (upload) => {
          calls.push(['delete-avatar', upload]);
        },
      },
      overrides.profileCache,
    ),
    calls,
    user,
    auth: mainAuth,
    authChanged: (value) => authChanged(value),
    profileChanged: (value, metadata) => profileChanged({ data: () => value, metadata }),
    profileError: () => profileError(new Error('offline')),
  };
}

module.exports = { createFirebaseFixture };
