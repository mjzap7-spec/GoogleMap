const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
// Main typechecking verifies React Native types; this fixture exercises the shared listener.
const source = ts.transpileModule(
  fs.readFileSync(require.resolve('../src/shared/motion/useReducedMotion.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const reads = [];
  const events = [];
  let removed = 0;
  const context = {
    exports: {},
    require: (name) => {
      if (name === 'react')
        return { useSyncExternalStore: (subscribe, getSnapshot) => ({ subscribe, getSnapshot }) };
      if (name === 'react-native')
        return {
          AccessibilityInfo: {
            addEventListener: (_name, callback) => {
              events.push(callback);
              return { remove: () => removed++ };
            },
            isReduceMotionEnabled: () => new Promise((resolve) => reads.push(resolve)),
          },
        };
      throw new Error(name);
    },
  };
  vm.runInNewContext(source, context);
  return { hook: context.exports.useReducedMotion, reads, events, removed: () => removed };
}
test('motion consumers share a native subscription and a late read cannot override a live preference', async () => {
  const f = fixture();
  const first = f.hook();
  const second = f.hook();
  let notified = 0;
  const stop1 = first.subscribe(() => notified++);
  const stop2 = second.subscribe(() => notified++);
  assert.equal(f.reads.length, 1);
  assert.equal(f.events.length, 1);
  assert.equal(first.getSnapshot(), null);
  f.events[0](true);
  assert.equal(first.getSnapshot(), true);
  assert.equal(notified, 2);
  f.reads[0](false);
  await flush();
  assert.equal(first.getSnapshot(), true);
  stop1();
  assert.equal(f.removed(), 0);
  stop2();
  assert.equal(f.removed(), 1);
});
test('unmounted motion reads are ignored and a new subscriber refreshes the cached preference', async () => {
  const f = fixture();
  const state = f.hook();
  const stop = state.subscribe(() => {});
  stop();
  const stopAgain = state.subscribe(() => {});
  f.reads[0](true);
  await flush();
  assert.equal(state.getSnapshot(), null);
  f.reads[1](false);
  await flush();
  assert.equal(state.getSnapshot(), false);
  f.events[1](true);
  assert.equal(state.getSnapshot(), true);
  stopAgain();
});
