const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MapViewModel } = require('../.test-build/features/map/viewmodels/MapViewModel');
const { createTestUsers } = require('../.test-build/features/map/models/testUsers');
const { distanceBetween } = require('geofire-common');
for (const latitude of [28.5, 89.999, -89.999]) {
  test('test-user fixtures stay within 1 km including latitude ' + latitude, () => {
    const center = { latitude, longitude: 179.999, timestamp: 1000 };
    for (const count of [10, 100, 500]) {
      const users = createTestUsers(center, count, 1000);
      assert.equal(users.length, count);
      assert.equal(new Set(users.map((user) => user.id)).size, count);
      assert.equal(new Set(users.map((user) => user.nickname)).size, count);
      assert.ok(
        users.every((user) => Math.abs(user.latitude) <= 90 && Math.abs(user.longitude) <= 180),
      );
      assert.ok(
        users.every(
          (user) =>
            distanceBetween([latitude, center.longitude], [user.latitude, user.longitude]) <= 1,
        ),
      );
    }
  });
}
test('release configuration rejects test markers and test selection', () => {
  const model = new MapViewModel();
  model.setTestUserCount(500);
  model.selectTestUser('demo-map-user-001');
  assert.equal(model.getSnapshot().testUserCount, 0);
  assert.deepEqual(model.getSnapshot().testUsers, []);
  assert.equal(model.getSnapshot().selectedTestUserId, '');
  model.dispose();
});
test('test users wait for real GPS, remain separate from recording, and clear on stop or sign-out', async () => {
  let update;
  const model = new MapViewModel(
    undefined,
    {
      watch: async (next) => {
        update = next;
        return () => {};
      },
    },
    Date.now,
    true,
  );
  model.setTestUserCount(100);
  assert.deepEqual(model.getSnapshot().testUsers, []);
  model.start();
  await new Promise((resolve) => setImmediate(resolve));
  const point = { latitude: 28.5, longitude: -81.3, timestamp: Date.now(), accuracy: 5 };
  update(point);
  assert.equal(model.getSnapshot().testUsers.length, 100);
  assert.equal(model.getSnapshot().live.latitude, point.latitude);
  assert.equal(model.getSnapshot().recordedPoints, 1);
  assert.deepEqual(model.getSnapshot().trail, [[point]], 'only the real device fix is recorded');
  model.selectTestUser('demo-map-user-001');
  assert.equal(model.getSnapshot().selectedTestUserId, 'demo-map-user-001');
  model.setTestUserCount(20);
  assert.equal(model.getSnapshot().testUserCount, 100);
  model.setTestUserCount(0);
  assert.deepEqual(model.getSnapshot().testUsers, []);
  assert.equal(model.getSnapshot().selectedTestUserId, '');
  model.setTestUserCount(500);
  assert.equal(model.getSnapshot().testUsers.length, 500);
  model.dispose();
  assert.equal(model.getSnapshot().testUserCount, 0);
  assert.deepEqual(model.getSnapshot().testUsers, []);
});
