const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  avatarImageUrl,
  avatarImageUrlSource,
} = require('../.test-build/shared/utils/avatarImageUrl');

test('public Cloudinary avatars use bounded reusable thumbnail variants', () => {
  const uri = 'https://res.cloudinary.com/my-cloud/image/upload/v123/avatars/alice.jpg';
  assert.equal(
    avatarImageUrl(uri, 80),
    'https://res.cloudinary.com/my-cloud/image/upload/c_fill,w_96,h_96,q_auto,f_auto/v123/avatars/alice.jpg',
  );
  assert.equal(avatarImageUrl(uri, 90), avatarImageUrl(uri, 80));
  assert.match(avatarImageUrl(uri, 120), /w_160,h_160/);
  assert.match(avatarImageUrl(uri, 1000), /w_256,h_256/);
});

test('signed URLs, existing transformations, local photos, and other providers stay intact', () => {
  for (const uri of [
    'https://res.cloudinary.com/demo/image/upload/s--signed--/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/c_fill,w_50/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/t_profile/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/v123/alice.jpg?token=abc',
    'https://res.cloudinary.com.evil.test/demo/image/upload/alice.jpg',
    'https://example.com/photo.jpg',
    'file:///photo.jpg',
    'content://photo.jpg',
  ])
    assert.equal(avatarImageUrl(uri), uri);
});

test('WebView thumbnail policy matches native without depending on runtime function source', () => {
  const webAvatar = vm.runInNewContext('(' + avatarImageUrlSource + ')');
  for (const uri of [
    'https://res.cloudinary.com/demo/image/upload/v123/avatars/alice.jpg',
    'https://res-1.cloudinary.com/demo/image/upload/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/s--signed--/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/c_fill,w_50/v123/alice.jpg',
    'https://res.cloudinary.com/demo/image/upload/v123/alice.jpg?token=abc',
    'file:///photo.jpg',
    'https://example.com/photo.jpg',
  ])
    for (const size of [undefined, 80, 120, 1000])
      assert.equal(webAvatar(uri, size), avatarImageUrl(uri, size));
});
