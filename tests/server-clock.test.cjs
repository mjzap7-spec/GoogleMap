const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ServerClock } = require('../.test-build/features/contacts/data/ServerClock');

test('server clock corrects large positive and negative device offsets and converts leases back to local deadlines', async () => {
  const server = Date.UTC(2026, 10, 3, 14);
  for (const skew of [-7 * 3600000, 3 * 3600000]) {
    let local = server + skew;
    const clock = new ServerClock(
      async () => ({ issuedAtTime: new Date(server).toISOString() }),
      () => local,
    );
    await clock.synchronize();
    assert.equal(clock.now(), server);
    assert.equal(clock.localDeadline(server + 120000), local + 120000);
    local += 10000;
    assert.equal(clock.now(), server + 10000);
  }
});
test('server clock deduplicates refreshes, caches briefly and resynchronizes after a backward clock jump', async () => {
  let calls = 0,
    local = 1000000,
    finish;
  const clock = new ServerClock(
    () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    () => local,
  );
  const first = clock.synchronize();
  assert.equal(clock.synchronize(), first);
  finish({ issuedAtTime: new Date(2000000).toISOString() });
  await first;
  await clock.synchronize();
  assert.equal(calls, 1);
  local -= 10000;
  const next = clock.synchronize();
  assert.equal(calls, 2);
  finish({ issuedAtTime: new Date(2010000).toISOString() });
  await next;
  assert.equal(clock.now(), 2010000);
});
test('failed time synchronization does not poison future retries', async () => {
  let fail = true;
  const clock = new ServerClock(
    async () => ({ issuedAtTime: fail ? 'invalid' : new Date(1000000).toISOString() }),
    () => 500000,
  );
  await assert.rejects(clock.synchronize(), /synchronize/);
  fail = false;
  await clock.synchronize();
  assert.equal(clock.now(), 1000000);
});
