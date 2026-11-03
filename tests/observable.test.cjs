const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ObservableViewModel } = require('../.test-build/shared/mvvm/ObservableViewModel');
class Model extends ObservableViewModel {
  constructor() {
    super({ count: 0, message: '', result: NaN });
  }
  change(patch) {
    this.update(patch);
  }
}
test('unchanged updates retain snapshot identity and do not notify UI subscribers', () => {
  const model = new Model();
  let notifications = 0;
  const stop = model.subscribe(() => notifications++);
  const initial = model.getSnapshot();
  model.change({});
  model.change({ count: 0, result: NaN });
  assert.equal(model.getSnapshot(), initial);
  assert.equal(notifications, 0);
  model.change({ count: 1, message: 'saved' });
  assert.notEqual(model.getSnapshot(), initial);
  assert.equal(notifications, 1);
  assert.equal(model.getSnapshot().message, 'saved');
  assert.ok(Object.isFrozen(model.getSnapshot()));
  model.change({ count: 1 });
  assert.equal(notifications, 1);
  stop();
  model.change({ count: 2 });
  assert.equal(notifications, 1);
});
