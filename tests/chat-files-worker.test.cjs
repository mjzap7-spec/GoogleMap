const { test } = require('node:test');
const assert = require('node:assert/strict');
const token = 'Bearer a.b.c';
const id = '11111111-1111-1111-1111-111111111111';

async function fixture(t, uid = 'bob', context = { requestId: 'r', peerId: 'bob' }) {
  const worker = (await import('../services/chat-files/worker.mjs')).default;
  const stored = new Map([
    [id, { value: new Uint8Array([1, 2]).buffer, metadata: { uid: 'alice', context, size: 2 } }],
  ]);
  const fields = context.groupId
    ? {
        joinedIds: {
          arrayValue: { values: ['alice', 'bob', 'eve'].map((stringValue) => ({ stringValue })) },
        },
      }
    : {
        fromId: { stringValue: 'alice' },
        toId: { stringValue: 'bob' },
        status: { stringValue: 'accepted' },
      };
  t.mock.method(globalThis, 'fetch', async (url) =>
    String(url).includes('accounts:lookup')
      ? Response.json({ users: [{ localId: uid }] })
      : Response.json({ fields }),
  );
  const limit = { limit: async () => ({ success: true }) };
  const env = {
    FIREBASE_API_KEY: 'test',
    FIREBASE_PROJECT_ID: 'test',
    FILE_LIMIT: limit,
    UPLOAD_LIMIT: limit,
    FILES: {
      getWithMetadata: async (key) => stored.get(key) ?? {},
      put: async (key, value, options) => stored.set(key, { value, metadata: options.metadata }),
      delete: async (key) => stored.delete(key),
    },
  };
  const request = (method = 'GET', key = id) =>
    new Request('https://test.example/files/' + key, { method, headers: { Authorization: token } });
  return { worker, env, request, stored, fields };
}
test('private file download requires authentication', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.worker.fetch(new Request('https://test.example/files/' + id), f.env)).status,
    401,
  );
});
test('a direct chat recipient can download, and an outsider cannot', async (t) => {
  const f = await fixture(t);
  const response = await f.worker.fetch(f.request(), f.env);
  assert.equal(response.status, 200);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2]);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
test('a third group member cannot download a private pair attachment', async (t) => {
  const f = await fixture(t, 'eve', { groupId: 'g', memberId: 'bob' });
  assert.equal((await f.worker.fetch(f.request(), f.env)).status, 403);
});
test('removed contact access and expired files are rejected', async (t) => {
  const f = await fixture(t);
  f.fields.status.stringValue = 'removed';
  assert.equal((await f.worker.fetch(f.request(), f.env)).status, 403);
  f.stored.clear();
  assert.equal((await f.worker.fetch(f.request(), f.env)).status, 404);
});
test('recipient cannot delete the uploader file', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.worker.fetch(f.request('DELETE'), f.env)).status, 403);
  assert.equal(f.stored.size, 1);
});

test('an unrelated direct-chat user cannot download a file even with its ID', async (t) => {
  const f = await fixture(t, 'eve');
  assert.equal((await f.worker.fetch(f.request(), f.env)).status, 403);
});

test('uploads are bounded and receive a seven-day expiry', async (t) => {
  const f = await fixture(t, 'alice');
  let ttl;
  const put = f.env.FILES.put;
  f.env.FILES.put = async (key, value, options) => {
    ttl = options.expirationTtl;
    await put(key, value, options);
  };
  const headers = {
    Authorization: token,
    'X-Chat-Context': JSON.stringify({ requestId: 'r', peerId: 'bob' }),
  };
  const response = await f.worker.fetch(
    new Request('https://test.example/files', {
      method: 'POST',
      headers,
      body: new Uint8Array([1, 2, 3]),
    }),
    f.env,
  );
  assert.equal(response.status, 200);
  assert.equal(ttl, 7 * 24 * 60 * 60);
  const large = await f.worker.fetch(
    new Request('https://test.example/files', {
      method: 'POST',
      headers,
      body: new Uint8Array(1024 * 1024 + 1),
    }),
    f.env,
  );
  assert.equal(large.status, 413);
});
