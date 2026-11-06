const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { mapDocument } = require('../.test-build/features/map/models/mapDocument');
const {
  isMapAttributionLink,
  isMapDocument,
  mapStyleUrl,
} = require('../.test-build/features/map/models/mapSource');
function fixture({
  autoLoad = true,
  fetchStyle,
  projectPeople = false,
  animateMarkers = false,
} = {}) {
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
  const sharedPathUpdates = [];
  const images = new Map();
  const appliedStyles = [];
  const timers = new Set();
  const frames = new Set();
  let frameTime = 0;
  let zoom = 12;
  let projections = 0;
  const map = {
    ...(projectPeople
      ? {
          project: ([x, y]) => {
            projections++;
            return { x: x * Math.pow(2, zoom), y: y * Math.pow(2, zoom) };
          },
        }
      : {}),
    hasImage: (id) => images.has(id),
    addImage: (id, image, options) => images.set(id, { image, options }),
    setStyle: (style) => appliedStyles.push(style),
    getSource: (id) => sources[id],
    addSource: (id, source) => {
      sources[id] = {
        ...source,
        setData: (data) => {
          if (id === 'travelled-path') pathUpdates.push(data);
          if (id === 'shared-trip') sharedPathUpdates.push(data);
        },
      };
    },
    addLayer: (layer) => layers.push(layer),
    on: (name, fn) => {
      handlers[name] = fn;
    },
    getZoom: () => zoom,
    easeTo: (camera) => moves.push(camera),
    fitBounds: (bounds, options) => moves.push({ bounds, ...options }),
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
    ...(animateMarkers
      ? {
          performance: { now: () => frameTime },
          requestAnimationFrame(callback) {
            frames.add(callback);
            return callback;
          },
          cancelAnimationFrame(callback) {
            frames.delete(callback);
          },
        }
      : {}),
    setTimeout(callback) {
      timers.add(callback);
      return callback;
    },
    clearTimeout: (callback) => timers.delete(callback),
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
    projections: () => projections,
    advanceFrame(ms) {
      frameTime += ms;
      const callbacks = [...frames];
      frames.clear();
      callbacks.forEach((fn) => fn(frameTime));
    },
    timers,
    reconnect: () => events.online(),
    setZoom: (value) => {
      zoom = value;
      handlers.zoomend();
    },
    appliedStyles,
    images,
    gesture: () => handlers.movestart({ originalEvent: {} }),
    pathUpdates,
    sharedPathUpdates,
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

test('zoom works before tiles load and a GPS fix preserves the requested zoom', () => {
  const f = fixture({ autoLoad: false, projectPeople: true });
  const state = { type: 'state', language: 'en', reducedMotion: false };
  const live = { latitude: 28, longitude: -81, timestamp: 10 };
  const person = {
    ...live,
    id: 'a',
    nickname: 'A',
    avatarUrl: null,
    expiresAt: Date.now() + 60000,
  };
  f.send({ ...state, live, users: [person] });
  f.send({ type: 'command', command: 'zoom-in' });
  f.send({ type: 'command', command: 'zoom-in' });
  assert.equal(f.moves.at(-1).zoom, 14);
  const projections = f.projections();
  f.send({ ...state, live: { ...live, latitude: 28.001, timestamp: 20 } });
  assert.deepEqual([...f.moves.at(-1).center], [-81, 28.001]);
  assert.equal(f.moves.at(-1).zoom, 14);
  assert.equal(f.projections(), projections, 'a GPS packet does not reproject an unchanged crowd');
  f.setZoom(14);
  assert.ok(f.projections() > projections, 'camera movement updates the clusters');
});

test('a followed trip animates between confirmed positions, keeps the zoom, and releases the camera after a pan', () => {
  const f = fixture({ animateMarkers: true });
  const person = {
    id: 'bob',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    trip: true,
    expiresAt: Date.now() + 60000,
  };
  const show = (latitude, revision = 1, reducedMotion = false) => {
    const user = { ...person, latitude };
    f.send({
      type: 'state',
      users: [user],
      focus: { ...user, revision },
      language: 'en',
      reducedMotion,
    });
  };
  show(28);
  assert.equal(f.moves.at(-1).zoom, 16);
  show(28.001);
  assert.equal(f.moves.at(-1).zoom, undefined);
  assert.deepEqual([...f.moves.at(-1).center], [-81, 28.001]);
  f.advanceFrame(225);
  assert.ok(Math.abs(f.markers[0].position[1] - 28.0005) < 0.000001);
  f.advanceFrame(225);
  assert.equal(f.markers[0].position[1], 28.001);
  const count = f.moves.length;
  show(28.001);
  f.gesture();
  show(28.002);
  assert.equal(f.moves.length, count);
  show(28.002, 2, true);
  assert.equal(f.moves.at(-1).duration, 0);
  assert.equal(f.markers[0].position[1], 28.002);
  f.advanceFrame(450);
  assert.equal(f.markers[0].position[1], 28.002);
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
  const marker = f.markers.find((marker) => marker.options.element);
  const root = marker.options.element;
  root.onclick({ stopPropagation() {} });
  assert.equal(f.messages.at(-1).type, 'select-user');
  assert.equal(f.messages.at(-1).userId, 'friend');
  assert.equal(Object.keys(f.messages.at(-1)).length, 2);
  root.onkeydown({ key: 'Enter', preventDefault() {} });
  assert.equal(f.messages.at(-1).userId, 'friend');
  const updates = f.pathUpdates.length;
  f.send({ type: 'state', language: 'en', live: { ...next, timestamp: 3000 } });
  assert.ok(!marker.removed, 'GPS-only updates keep existing people on the map');
  assert.equal(
    f.pathUpdates.length,
    updates,
    'an unchanged trail is neither transferred nor redrawn for GPS-only movement',
  );
  f.send({ type: 'state', language: 'en', live: next, trail: [], users: [] });
  assert.ok(marker.removed, 'an explicitly empty snapshot removes the marker');
  assert.equal(f.pathUpdates.at(-1).geometry.coordinates.length, 0);
});

test('crowded markers cluster, expose individual identities, and adapt size to zoom', () => {
  const f = fixture({ projectPeople: true });
  const users = ['Alice', 'Bob'].map((nickname, index) => ({
    id: nickname,
    nickname,
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3 + index * 0.001,
    expiresAt: Date.now() + 60000,
  }));
  f.send({ type: 'state', language: 'en', users });
  const cluster = f.markers.find((marker) => marker.options.element);
  assert.equal(cluster.options.element.children[0].children[0].textContent, '2');
  cluster.options.element.onclick({ stopPropagation() {} });
  assert.deepEqual(f.messages.at(-1).userIds, ['Alice', 'Bob']);
  assert.equal(f.messages.at(-1).type, 'select-users');
  f.setZoom(18);
  assert.equal(cluster.removed, true);
  const active = f.markers.filter((marker) => marker.options.element && !marker.removed);
  assert.equal(active.length, 2);
  assert.equal(active[0].options.element.children[0].style.width, '44px');
  f.setZoom(10);
  const compact = f.markers.filter((marker) => marker.options.element && !marker.removed).at(-1);
  assert.equal(compact.options.element.children[0].style.width, '40px');
});

test('unchanged shared trips survive position-only updates without repainting and clear explicitly', () => {
  const f = fixture();
  const a = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  const b = { ...a, longitude: -81.31, timestamp: 2000 };
  f.send({ type: 'state', language: 'en', sharedTrail: [[a, b]] });
  assert.equal(f.sharedPathUpdates.length, 1);
  f.send({ type: 'state', language: 'en', live: a });
  assert.equal(f.sharedPathUpdates.length, 1);
  f.send({ type: 'state', language: 'en', sharedTrail: [[a, b]] });
  assert.equal(f.sharedPathUpdates.length, 1);
  f.send({ type: 'state', language: 'en', sharedTrail: [] });
  assert.equal(f.sharedPathUpdates.length, 2);
  assert.equal(f.sharedPathUpdates.at(-1).geometry.coordinates.length, 0);
});

test('individual users become small points at low zoom and progressively reveal avatars and labels', () => {
  const f = fixture({ projectPeople: true });
  const user = {
    id: 'alice',
    nickname: 'Alice',
    avatarUrl: 'https://example.com/alice.png',
    latitude: 28.5,
    longitude: -81.3,
    expiresAt: Date.now() + 60000,
  };
  f.send({ type: 'state', language: 'en', users: [user], reducedMotion: false });
  const root = f.markers.find((marker) => marker.options.element).options.element;
  const avatar = root.children[0];
  assert.equal(avatar.style.width, '10px');
  assert.equal(avatar.children[0].style.opacity, '0');
  assert.equal(root.children[1].style.opacity, '0');
  f.setZoom(14);
  assert.equal(avatar.style.width, '19px');
  assert.equal(avatar.children[0].style.opacity, '0');
  f.setZoom(17);
  assert.equal(avatar.style.width, '44px');
  assert.equal(root.children[1].style.opacity, '1');
  assert.match(avatar.style.transition, /140ms/);
  f.send({ type: 'state', language: 'en', users: [user], reducedMotion: true });
  assert.equal(avatar.style.transition, 'none');
  root.onclick({ stopPropagation() {} });
  assert.equal(f.messages.at(-1).userId, 'alice');
});

test('a failed Cloudinary marker uses its alternate HTTPS address and keeps the loaded photo on map updates', () => {
  const f = fixture();
  const user = {
    id: 'friend',
    nickname: 'Jo',
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v9/profile.jpg',
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const send = (users) => f.send({ type: 'state', language: 'en', users });
  send([user]);
  const avatar = f.markers[0].options.element.children[0];
  assert.equal(avatar.children.length, 1, 'no image request for a low-zoom point');
  f.setZoom(16);
  const image = avatar.children[1];
  assert.equal(image.src, user.avatarUrl);
  assert.equal(image.style.visibility, 'hidden');
  image.onerror();
  assert.equal(image.src, 'https://res-1.cloudinary.com/demo/image/upload/v9/profile.jpg');
  image.onload();
  send([{ ...user, longitude: -80.9 }]);
  assert.equal(image.style.visibility, 'visible');
  assert.equal(avatar.children.length, 2);
  assert.equal(f.timers.size, 0);
  f.setZoom(10);
  send([{ ...user, avatarUrl: null }]);
  assert.equal(image.removed, true);
  assert.equal(avatar.children[0].textContent, 'J');
});

test('failed photos retry once and on reconnect, and a removed marker cancels pending work', () => {
  const f = fixture();
  f.setZoom(16);
  const user = {
    id: 'friend',
    nickname: 'Jo',
    avatarUrl: 'https://example.org/photo.jpg',
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const send = (users) => f.send({ type: 'state', language: 'en', users });
  send([user]);
  const avatar = f.markers[0].options.element.children[0];
  const image = avatar.children[1];
  image.onerror();
  assert.equal(image.src, user.avatarUrl, 'other providers use their own URL');
  const [retry] = f.timers;
  f.timers.delete(retry);
  retry();
  const previousHandler = image.onerror;
  image.onerror();
  send([user]);
  assert.equal(f.timers.size, 0);
  assert.equal(image.onerror, previousHandler, 'GPS updates do not restart failed downloads');
  f.reconnect();
  assert.notEqual(image.onerror, previousHandler);
  send([{ ...user, avatarUrl: 'https://example.org/new.jpg' }]);
  const replacement = avatar.children[2];
  previousHandler();
  assert.equal(image.removed, true);
  replacement.onerror();
  assert.equal(f.timers.size, 1);
  send([]);
  assert.equal(f.timers.size, 0);
  assert.equal(replacement.onerror, null);
});

test('500 colocated users render one count badge and preserve all selectable identities', () => {
  const f = fixture({ projectPeople: true });
  const users = Array.from({ length: 500 }, (_, index) => ({
    id: 'user-' + index,
    nickname: 'User ' + index,
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3,
    expiresAt: Date.now() + 60000,
  }));
  f.send({ type: 'state', language: 'en', users });
  const markers = f.markers.filter((marker) => marker.options.element && !marker.removed);
  assert.equal(markers.length, 1);
  const root = markers[0].options.element;
  assert.equal(root.children[0].children[0].textContent, '500');
  root.onclick({ stopPropagation() {} });
  assert.equal(f.messages.at(-1).userIds.length, 500);
});

test('close zoom limits name labels even when many individuals fit on screen', () => {
  const f = fixture({ projectPeople: true });
  f.setZoom(18);
  const users = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    nickname: 'Person with a long nickname ' + index,
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3 + index * 0.01,
    expiresAt: Date.now() + 60000,
  }));
  f.send({ type: 'state', language: 'en', users });
  const roots = f.markers
    .filter((marker) => marker.options.element && !marker.removed)
    .map((marker) => marker.options.element);
  assert.equal(roots.length, 20);
  assert.equal(roots.filter((root) => root.children[1].style.opacity === '1').length, 8);
});

test('test-mode camera fits the demo crowd once and stop restores GPS following', () => {
  const f = fixture();
  const live = { latitude: 28.5, longitude: -81.3, timestamp: 1000 };
  const user = {
    id: 'demo-map-user-001',
    nickname: 'Alex 001',
    avatarUrl: null,
    latitude: 28.501,
    longitude: -81.301,
    expiresAt: Date.now() + 60000,
  };
  f.send({ type: 'state', language: 'en', testUserCount: 10, live, users: [user] });
  assert.equal(f.moves.filter((move) => move.bounds).length, 1);
  f.send({ type: 'state', language: 'en', testUserCount: 10, live, users: [user] });
  assert.equal(f.moves.filter((move) => move.bounds).length, 1);
  f.send({ type: 'state', language: 'en', testUserCount: 0, live, users: [] });
  assert.deepEqual(Array.from(f.moves.at(-1).center), [live.longitude, live.latitude]);
});
