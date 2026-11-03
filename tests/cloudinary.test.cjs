const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CloudinaryAvatarStorage,
} = require('../.test-build/features/auth/data/CloudinaryAvatarStorage');
const config = { cloudName: 'test-cloud', uploadPreset: 'avatar-preset' };
const avatar = { uri: 'file:///photo.jpg', base64: '/9j/AA==', contentType: 'image/jpeg' };
const url = 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatar.jpg';
const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

test('unsigned Cloudinary upload sends only a data URI and public preset and returns HTTPS image URL', async () => {
  let request;
  const storage = new CloudinaryAvatarStorage(config, async (...args) => {
    request = args;
    return response({ secure_url: url, delete_token: 'cleanup' });
  });
  const result = await storage.upload(avatar);
  assert.equal(request[0], 'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
  assert.equal(request[1].method, 'POST');
  assert.deepEqual(
    [...request[1].body.entries()],
    [
      ['file', 'data:image/jpeg;base64,/9j/AA=='],
      ['upload_preset', 'avatar-preset'],
    ],
  );
  assert.equal(request[1].headers, undefined);
  assert.deepEqual(result, { url, cleanupToken: 'cleanup' });
});

test('missing configuration and invalid avatars fail before any network request', async () => {
  const never = async () => assert.fail('Must not upload');
  await assert.rejects(
    new CloudinaryAvatarStorage({ cloudName: '', uploadPreset: '' }, never).upload(avatar),
    { code: 'cloudinary-not-configured' },
  );
  for (const invalid of [
    { ...avatar, contentType: 'image/svg+xml' },
    { ...avatar, base64: '' },
    { ...avatar, base64: 'A'.repeat(7 * 1024 * 1024) },
  ])
    await assert.rejects(new CloudinaryAvatarStorage(config, never).upload(invalid), {
      code: 'avatar-invalid',
    });
});

test('Cloudinary failures are mapped to actionable errors and no untrusted delivery URL is accepted', async () => {
  for (const [status, code] of [
    [400, 'cloudinary-not-configured'],
    [401, 'cloudinary-not-configured'],
    [413, 'avatar-invalid'],
    [429, 'rate-limited'],
    [500, 'avatar-upload'],
  ]) {
    await assert.rejects(
      new CloudinaryAvatarStorage(config, async () => response({}, status)).upload(avatar),
      { code },
    );
  }
  for (const data of [
    {},
    { secure_url: 'http://res.cloudinary.com/test-cloud/image/upload/a.jpg' },
    { secure_url: 'https://evil.invalid/avatar.jpg' },
    { secure_url: 'https://res.cloudinary.com/other-cloud/image/upload/a.jpg' },
    { secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/a.mp4' },
  ])
    await assert.rejects(
      new CloudinaryAvatarStorage(config, async () => response(data)).upload(avatar),
      { code: 'avatar-upload' },
    );
  await assert.rejects(
    new CloudinaryAvatarStorage(config, async () => {
      throw new TypeError('network');
    }).upload(avatar),
    { code: 'avatar-upload' },
  );
});

test('cleanup uses only the short-lived token and is skipped when none is returned', async () => {
  const calls = [];
  const storage = new CloudinaryAvatarStorage(config, async (...args) => {
    calls.push(args);
    return response({ result: 'ok' });
  });
  await storage.discard({ url });
  assert.equal(calls.length, 0);
  await storage.discard({ url, cleanupToken: 'temporary' });
  assert.equal(calls[0][0], 'https://api.cloudinary.com/v1_1/test-cloud/delete_by_token');
  assert.deepEqual([...calls[0][1].body.entries()], [['token', 'temporary']]);
});
