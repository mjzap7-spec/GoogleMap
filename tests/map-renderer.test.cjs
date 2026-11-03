const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { mapDocument } = require('../.test-build/features/map/models/mapDocument');
const {
  isMapAttributionLink,
  isMapDocument,
  mapStyleUrl,
} = require('../.test-build/features/map/models/mapSource');
function fixture({ autoLoad = true, fetchStyle } = {}) {
  const events = {};
  const handlers = {};
  const moves = [];
  const popups = [];
  const markers = [];
  const messages = [];
  const labels = [];
  const sources = {};
  const layers = [];
  const pathUpdates = [];
  const images = new Map();
  const appliedStyles = [];
  const map = {
    hasImage: (id) => images.has(id),
    addImage: (id, image, options) => images.set(id, { image, options }),
    setStyle: (style) => appliedStyles.push(style),
    getSource: (id) => sources[id],
    addSource: (id, source) => {
      sources[id] = { ...source, setData: (data) => pathUpdates.push(data) };
    },
    addLayer: (layer) => layers.push(layer),
    on: (name, fn) => {
      handlers[name] = fn;
    },
    getZoom: () => 12,
    easeTo: (camera) => moves.push(camera),
    getStyle: () => ({
      layers: [
        { id: 'city', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
        { id: 'road-ref', type: 'symbol', layout: { 'text-field': ['get', 'ref'] } },
      ],
    }),
    setLayoutProperty: (...args) => labels.push(args),
    resize() {},
  };
  class Marker {
    constructor(options) {
      this.options = options;
      markers.push(this);
    }
    setLngLat(p) {
      this.position = p;
      return this;
    }
    addTo() {
      return this;
    }
    setPopup(p) {
      popups.push(p);
      return this;
    }
    remove() {
      this.removed = true;
    }
  }
  class Popup {
    setDOMContent(node) {
      this.node = node;
      return this;
    }
  }
  const parent = { postMessage: (value) => messages.push(JSON.parse(value)) };
  const window = {
    parent,
    addEventListener: (name, fn) => {
      events[name] = fn;
    },
  };
  const context = {
    window,
    fetch: fetchStyle,
    document: {
      addEventListener() {},
      createElement: () => ({
        style: {},
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        remove() {
          this.removed = true;
        },
      }),
    },
    maplibregl: {
      Map: function () {
        return map;
      },
      Marker,
      Popup,
    },
    Number,
    JSON,
    Math,
  };
  for (const match of mapDocument.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))
    vm.runInNewContext(match[1], context);
  const load = () => {
    handlers['style.load']();
    handlers.load();
  };
  if (autoLoad) load();
  let id = 0;
  return {
    load,
    appliedStyles,
    images,
    gesture: () => handlers.movestart({ originalEvent: {} }),
    pathUpdates,
    markers,
    layers,
    moves,
    popups,
    labels,
    messages,
    send: (value) => {
      const data = JSON.stringify({ id: ++id, ...value });
      events.message({ data, source: parent });
      return data;
    },
    duplicate: (data) => events.message({ data, source: parent }),
  };
}
test('map needs no Google configuration and attribution navigation stays within known HTTPS sites', () => {
  assert.equal(new URL(mapStyleUrl).hostname, 'tiles.openfreemap.org');
  assert.equal(isMapDocument('about:blank'), true);
  assert.equal(isMapAttributionLink('https://www.openstreetmap.org/copyright'), true);
  for (const url of [
    'javascript:alert(1)',
    'https://www.openstreetmap.org.evil.test/',
    'https://user:pass@openfreemap.org/',
    'file:///tmp',
    'http://openfreemap.org/',
  ])
    assert.equal(isMapAttributionLink(url), false);
  assert.doesNotMatch(mapDocument, /maps.googleapis|apiKey|googleMapId/);
});
test('GPS marker and language changes preserve camera and rapid zoom targets survive interruption', () => {
  const f = fixture();
  assert.equal(f.messages.at(-1).type, 'ready');
  const point = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  f.send({ type: 'state', live: point, language: 'en', reducedMotion: false });
  assert.equal(f.moves.length, 1);
  assert.equal(f.popups[0].node.textContent, 'Your GPS position');
  f.send({ type: 'state', live: point, language: 'es', reducedMotion: false });
  assert.equal(f.moves.length, 1);
  assert.equal(f.labels.at(-1)[0], 'city');
  const first = f.send({ type: 'command', command: 'zoom-in' });
  f.duplicate(first);
  f.send({ type: 'command', command: 'zoom-in' });
  assert.equal(f.moves.at(-1).zoom, 14);
  assert.equal(f.moves.length, 3);
  f.send({ type: 'state', live: point, language: 'es', reducedMotion: true });
  f.send({ type: 'command', command: 'recenter' });
  assert.equal(f.moves.at(-1).duration, 0);
  assert.deepEqual(Array.from(f.moves.at(-1).center), [-81.3, 28.5]);
});

test('GPS centers before initial tiles load and unchanged language avoids layout work', () => {
  const f = fixture({ autoLoad: false });
  assert.equal(f.messages[0].type, 'initialized');
  const point = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  f.send({ type: 'state', live: point, language: 'es', reducedMotion: false });
  assert.equal(f.moves.length, 1);
  assert.equal(f.moves[0].zoom, 16);
  assert.equal(f.moves[0].duration, 0);
  assert.equal(f.labels.length, 0);
  f.load();
  assert.equal(f.moves.length, 1, 'loading does not recenter the city a second time');
  assert.equal(f.labels.length, 1);
  f.send({ type: 'state', live: point, language: 'es', reducedMotion: true });
  assert.equal(f.labels.length, 1, 'motion preference changes do not relayout labels');
  assert.equal(f.messages.at(-1).type, 'ready');
});

test('GPS path uses separate segments, updates existing source, and recenter prefers GPS over profile', () => {
  const f = fixture();
  const first = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  const next = { ...first, longitude: -81.301, timestamp: 2000 };
  const afterGap = { ...first, longitude: -81.4, timestamp: 50000 };
  const profile = { latitude: 40, longitude: -75, label: 'Profile city' };
  f.send({
    type: 'state',
    point: profile,
    live: next,
    trail: [[first, next], [afterGap]],
    language: 'en',
    reducedMotion: false,
  });
  assert.equal(f.layers.length, 2);
  assert.equal(f.pathUpdates.at(-1).geometry.type, 'MultiLineString');
  assert.equal(
    f.pathUpdates.at(-1).geometry.coordinates.length,
    1,
    'a gap is not connected to another segment',
  );
  assert.equal(f.moves.length, 1, 'GPS wins automatic centering over profile');
  f.send({ type: 'command', command: 'recenter' });
  assert.deepEqual(Array.from(f.moves.at(-1).center), [-81.301, 28.5]);
  f.send({
    type: 'state',
    point: profile,
    live: null,
    trail: [],
    language: 'en',
    reducedMotion: true,
  });
  assert.equal(f.pathUpdates.at(-1).geometry.coordinates.length, 0);
  assert.equal(f.layers.length, 2, 'clearing updates the existing source');
});

test('profile location never creates a marker or camera fallback; GPS follows until user pans', () => {
  const f = fixture();
  const base = { type: 'state', language: 'en', reducedMotion: false };
  f.send({ ...base, point: { latitude: 0, longitude: 0, label: 'Profile only' }, live: null });
  f.send({ type: 'command', command: 'recenter' });
  assert.equal(f.moves.length, 0);
  assert.equal(f.popups.length, 0);
  const first = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  f.send({ ...base, live: first });
  assert.equal(f.moves.length, 1);
  f.gesture();
  f.send({ ...base, live: { ...first, longitude: -81.31, timestamp: 2000 } });
  assert.equal(f.moves.length, 1, 'manual pan disables automatic following');
  f.send({ type: 'command', command: 'recenter' });
  f.send({ ...base, live: { ...first, longitude: -81.32, timestamp: 3000 } });
  assert.equal(f.moves.length, 3, 'recenter restores GPS following');
});

test('nearby avatar labels are text-safe and contact selection focuses without reloading or following own GPS', () => {
  const f = fixture();
  const user = {
    id: 'friend',
    nickname: '<img onerror=alert(1)>',
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
    latitude: 28.51,
    longitude: -81.31,
    expiresAt: Date.now() + 60000,
  };
  const live = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  f.send({
    type: 'state',
    language: 'en',
    live,
    users: [user],
    focus: { ...user, revision: 1 },
    reducedMotion: false,
  });
  assert.deepEqual(Array.from(f.moves.at(-1).center), [-81.31, 28.51]);
  const marker = f.markers.find((item) => item.options.element);
  assert.equal(marker.options.element.children[1].textContent, user.nickname);
  const moves = f.moves.length;
  f.send({
    type: 'state',
    language: 'en',
    live: { ...live, longitude: -81.4, timestamp: 2000 },
    users: [user],
    focus: { ...user, revision: 1 },
    reducedMotion: false,
  });
  assert.equal(f.moves.length, moves);
  f.send({ type: 'state', language: 'en', live, users: [], focus: null, reducedMotion: false });
  assert.equal(marker.removed, true);
});

test('style downloads alongside the engine and failed prefetch falls back to the provider URL', async () => {
  let finish;
  let requests = 0;
  const f = fixture({
    autoLoad: false,
    fetchStyle: () => {
      requests++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  assert.equal(requests, 1);
  assert.equal(f.messages[0].type, 'initialized');
  assert.equal(f.appliedStyles.length, 0);
  const style = { version: 8, sources: {}, layers: [] };
  finish({ ok: true, json: async () => style });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.appliedStyles[0], style);
  const failed = fixture({
    autoLoad: false,
    fetchStyle: async () => {
      throw new Error('offline');
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed.appliedStyles[0], mapStyleUrl);
});

test('direction arrows follow ordered path segments without changing the recorded route or adding downloads', () => {
  const f = fixture();
  const arrow = f.layers.find((layer) => layer.id === 'travelled-path-directions');
  assert.equal(arrow.source, 'travelled-path');
  assert.equal(arrow.layout['symbol-placement'], 'line');
  assert.equal(arrow.layout['icon-rotation-alignment'], 'map');
  assert.equal(
    arrow.layout['icon-keep-upright'],
    false,
    'westbound arrows must not flip to face east',
  );
  const image = f.images.get('travel-direction');
  assert.equal(image.options.pixelRatio, 2);
  assert.equal(image.image.data.length, 32 * 32 * 4);
  assert.ok(image.image.data.some((value) => value > 0));
  const east = { latitude: 28, longitude: -81, timestamp: 1000 };
  const west = { latitude: 28, longitude: -81.01, timestamp: 2000 };
  const reverse = { ...east, timestamp: 3000 };
  f.send({ type: 'state', language: 'en', live: reverse, trail: [[east, west, reverse]] });
  const coordinates = f.pathUpdates.at(-1).geometry.coordinates;
  assert.deepEqual(
    Array.from(coordinates[0], (pair) => Array.from(pair)),
    [
      [-81, 28],
      [-81.01, 28],
      [-81, 28],
    ],
  );
  assert.equal(f.images.size, 1);
  assert.equal(f.layers.filter((layer) => layer.id === arrow.id).length, 1);
  f.send({ type: 'state', language: 'en', live: reverse, trail: [] });
  assert.equal(
    f.pathUpdates.at(-1).geometry.coordinates.length,
    0,
    'Clear path clears both line and arrows through their shared source',
  );
});
test('map avatar click and keyboard activation emit only the selected identity, and GPS-only payloads preserve the trail', () => {
  const f = fixture();
  const point = { latitude: 28, longitude: -81, timestamp: 1000 };
  const next = { ...point, longitude: -81.01, timestamp: 2000 };
  const user = {
    id: 'friend',
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.01,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  f.send({ type: 'state', language: 'en', live: next, trail: [[point, next]], users: [user] });
  const root = f.markers.find((marker) => marker.options.element).options.element;
  root.onclick({ stopPropagation() {} });
  assert.equal(f.messages.at(-1).type, 'select-user');
  assert.equal(f.messages.at(-1).userId, 'friend');
  assert.equal(Object.keys(f.messages.at(-1)).length, 2);
  root.onkeydown({ key: 'Enter', preventDefault() {} });
  assert.equal(f.messages.at(-1).userId, 'friend');
  const updates = f.pathUpdates.length;
  f.send({ type: 'state', language: 'en', live: { ...next, timestamp: 3000 }, users: [user] });
  assert.equal(
    f.pathUpdates.length,
    updates,
    'an unchanged trail is neither transferred nor redrawn for GPS-only movement',
  );
  f.send({ type: 'state', language: 'en', live: next, trail: [], users: [user] });
  assert.equal(f.pathUpdates.at(-1).geometry.coordinates.length, 0);
});
