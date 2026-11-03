const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDateOnly,
  parseDateOnly,
  clampDate,
} = require('../.test-build/shared/utils/dateOnly');

test('calendar values round-trip as local dates without UTC day shifts', () => {
  const local = new Date(1995, 5, 15, 23, 59);
  assert.equal(formatDateOnly(local), '1995-06-15');
  const parsed = parseDateOnly('2000-02-29', local);
  assert.deepEqual([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()], [2000, 1, 29]);
});

test('invalid calendar input falls back without mutating the initial date', () => {
  const fallback = new Date(2000, 0, 1);
  for (const value of ['', '2001-02-29', '2026-13-01', '06/15/1995']) {
    const parsed = parseDateOnly(value, fallback);
    assert.equal(parsed.getTime(), fallback.getTime());
    assert.notEqual(parsed, fallback);
  }
});

test('calendar starting value stays inside the permitted birthday range', () => {
  const minimum = new Date(1900, 0, 1);
  const maximum = new Date(2026, 9, 30);
  assert.equal(formatDateOnly(clampDate(new Date(1800, 0, 1), minimum, maximum)), '1900-01-01');
  assert.equal(formatDateOnly(clampDate(new Date(2030, 0, 1), minimum, maximum)), '2026-10-30');
  assert.equal(formatDateOnly(clampDate(new Date(1995, 5, 15), minimum, maximum)), '1995-06-15');
});
