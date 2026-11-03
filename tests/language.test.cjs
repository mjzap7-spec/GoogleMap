const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LanguageViewModel } = require('../.test-build/shared/i18n/LanguageViewModel');
const { translate } = require('../.test-build/shared/i18n/translate');
const { catalog } = require('../.test-build/shared/i18n/catalog');
const { MapViewModel } = require('../.test-build/features/map/viewmodels/MapViewModel');
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('each supported language covers every catalog phrase and preserves user interpolation', () => {
  for (const [key, values] of Object.entries(catalog)) {
    assert.equal(values.length, 5, key);
    for (const [index, language] of ['es', 'fr', 'de', 'zh', 'ja'].entries()) {
      assert.ok(values[index].trim(), key + ':' + language);
      assert.equal(translate(key, language), values[index]);
    }
  }
  assert.equal(
    translate('Show {name} on map', 'es', { name: 'Map <Eric>' }),
    'Mostrar a Map <Eric> en el mapa',
  );
  assert.equal(translate('Orlando, Florida', 'ja'), 'Orlando, Florida');
  assert.equal(translate('Sign in', 'fr'), 'Se connecter');
});
test('late language restoration never overrides a user choice; persistence writes stay in order', async () => {
  let restore;
  const writes = [];
  const model = new LanguageViewModel({
    readLanguage: () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
    writeLanguage: async (language) => writes.push(language),
  });
  const loading = model.start();
  await model.writeLanguage('fr');
  restore('es');
  await loading;
  assert.equal(model.getSnapshot().language, 'fr');
  await Promise.all([model.writeLanguage('de'), model.writeLanguage('ja')]);
  assert.deepEqual(writes, ['fr', 'de', 'ja']);
  assert.equal(model.getSnapshot().language, 'ja');
  await model.writeLanguage('unsupported');
  assert.equal(model.getSnapshot().language, 'ja');
});
test('open map follows app language changes without restarting device GPS', async () => {
  const language = new LanguageViewModel();
  let watches = 0;
  const map = new MapViewModel(language, {
    watch: async () => {
      watches++;
      return () => {};
    },
  });
  map.start();
  await flush();
  await language.writeLanguage('zh');
  assert.equal(map.getSnapshot().language, 'zh');
  assert.equal(watches, 1);
  map.dispose();
  await language.writeLanguage('fr');
  assert.equal(map.getSnapshot().language, 'zh');
});
test('stored language restores and failed writes retain the current choice with a recoverable message', async () => {
  const model = new LanguageViewModel({
    readLanguage: async () => 'es',
    writeLanguage: async () => {
      throw Error('disk full');
    },
  });
  await model.start();
  assert.equal(model.getSnapshot().language, 'es');
  await model.writeLanguage('fr');
  assert.equal(model.getSnapshot().language, 'fr');
  assert.match(model.getSnapshot().error, /Select it again/);
});
