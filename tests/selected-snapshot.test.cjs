const assert = require('node:assert/strict');
const { test } = require('node:test');
const { selectSnapshot } = require('../.test-build/shared/mvvm/selectSnapshot');

test('live GPS updates preserve list snapshots but membership changes update immediately', () => {
  let state = { groups: [{ id: 'family' }], error: '', latitude: 0 };
  const snapshot = selectSnapshot(
    () => state,
    ({ groups, error }) => ({ groups, error }),
    (a, b) => a.groups === b.groups && a.error === b.error,
  );
  const initial = snapshot();
  for (let index = 1; index <= 500; index++) {
    state = { ...state, latitude: index / 10000 };
    assert.equal(snapshot(), initial);
  }
  state = { ...state, groups: [...state.groups, { id: 'friends' }] };
  assert.notEqual(snapshot(), initial);
  assert.equal(snapshot().groups.length, 2);
  const joined = snapshot();
  state = { ...state, error: 'offline' };
  assert.notEqual(snapshot(), joined);
  assert.equal(snapshot().error, 'offline');
});

test('selection is computed once per source snapshot, including undefined results', () => {
  let state = { id: undefined };
  let calls = 0;
  const snapshot = selectSnapshot(
    () => state,
    (value) => {
      calls++;
      return value.id;
    },
  );
  assert.equal(snapshot(), undefined);
  assert.equal(snapshot(), undefined);
  assert.equal(calls, 1);
  state = { id: 'new-user' };
  assert.equal(snapshot(), 'new-user');
  assert.equal(calls, 2);
});

test('separate subscribers never share a stale selection', () => {
  let state = { count: 1 };
  const first = selectSnapshot(
    () => state,
    (value) => value.count,
  );
  const second = selectSnapshot(
    () => state,
    (value) => value.count * 10,
  );
  assert.equal(first(), 1);
  assert.equal(second(), 10);
  state = { count: 2 };
  assert.equal(second(), 20);
  assert.equal(first(), 2);
});
