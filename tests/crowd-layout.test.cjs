const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crowdLayoutSource } = require('../.test-build/features/map/models/crowdLayout');
const clusterProjectedPeople = require('node:vm').runInNewContext('(' + crowdLayoutSource + ')');
for (const count of [100, 250, 500]) {
  test(count + ' people stay selectable with at most 32 screen markers', () => {
    const points = Array.from({ length: count }, (_, index) => ({
      id: 'user-' + index,
      x: (index % 20) * 73,
      y: Math.floor(index / 20) * 81,
    }));
    const groups = clusterProjectedPeople(points, 56);
    assert.ok(groups.length <= 32);
    assert.equal(groups.flatMap((group) => group.ids).length, count);
    assert.equal(new Set(groups.flatMap((group) => group.ids)).size, count);
    assert.ok(groups.every((group) => Number.isFinite(group.x) && Number.isFinite(group.y)));
  });
}
test('coincident users produce one exact-count cluster and empty maps stay empty', () => {
  const points = Array.from({ length: 500 }, (_, index) => ({ id: String(index), x: 150, y: 200 }));
  const groups = clusterProjectedPeople(points, 56);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].ids.length, 500);
  assert.equal(clusterProjectedPeople([], 56).length, 0);
});
test('screen-cell boundaries do not separate overlapping people', () => {
  assert.equal(
    clusterProjectedPeople(
      [
        { id: 'a', x: 55, y: 10 },
        { id: 'b', x: 57, y: 10 },
      ],
      56,
    ).length,
    1,
  );
});

test('a partly connected cell retains separate people until a bridging point arrives', () => {
  const points = [
    [1, 1],
    [55, 55],
    [58, 55],
    [57, 54],
  ].map(([x, y], i) => ({ id: String(i), x, y }));
  const groups = clusterProjectedPeople(points, 56);
  assert.deepEqual(
    Array.from(groups, (group) => Array.from(group.ids)),
    [['0'], ['1', '2', '3']],
  );
  points.push({ id: 'bridge', x: 28, y: 28 });
  assert.equal(clusterProjectedPeople(points, 56)[0].ids.length, 5);
});
