const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('native received copies survive cache cleanup and save byte-for-byte to the selected Android folder', async () => {
  const data = new Map();
  const path = (...parts) =>
    parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
  let writerClosed = false;
  class File {
    constructor(...parts) {
      this.uri = path(...parts);
    }
    get exists() {
      return data.has(this.uri);
    }
    get size() {
      return data.get(this.uri)?.length ?? 0;
    }
    create() {
      data.set(this.uri, Buffer.alloc(0));
    }
    async write(value) {
      data.set(this.uri, Buffer.from(value));
    }
    async text() {
      return data.get(this.uri).toString();
    }
    delete() {
      data.delete(this.uri);
    }
    async copy(target) {
      assert.equal(writerClosed, true, 'flush before copying');
      data.set(target.uri, Buffer.from(data.get(this.uri)));
    }
    open() {
      const file = this;
      return {
        async writeBytes(bytes) {
          assert.equal(writerClosed, false);
          data.set(file.uri, Buffer.concat([data.get(file.uri), Buffer.from(bytes)]));
        },
        close() {
          writerClosed = true;
        },
      };
    }
  }
  class Directory {
    constructor(...parts) {
      this.uri = path(...parts);
    }
    create() {}
    static async pickDirectoryAsync() {
      return new Directory('content://Downloads');
    }
  }
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === 'expo-document-picker') return {};
    if (request === 'expo-file-system')
      return {
        Directory,
        File,
        FileMode: { WriteOnly: 2 },
        Paths: { cache: { uri: 'cache://' }, document: { uri: 'private://' } },
      };
    if (request === 'expo-sharing') return {};
    if (request === 'react-native') return { Platform: { OS: 'android' } };
    return original.call(this, request, ...args);
  };
  try {
    const adapter = require('../.test-build/shared/platform/directFile.native');
    const info = { name: '../photo.png', mime: 'image/png', size: 4 };
    const id = 'abcdefghijklmnopqrst';
    const sink = await adapter.receiveDirectFile(info);
    await sink.write(Uint8Array.of(1, 2, 3, 4));
    const local = await sink.keep('bob', id);
    sink.close();
    assert.equal(
      [...data.keys()].some((key) => key.startsWith('cache://')),
      false,
    );
    assert.deepEqual(data.get(local.uri), Buffer.from([1, 2, 3, 4]));
    const restored = await adapter.findDirectFile('bob', id);
    assert.equal(restored.uri, local.uri);
    assert.equal(await adapter.findDirectFile('alice', id), undefined);
    await restored.save();
    assert.deepEqual(data.get('content://Downloads/_photo.png'), Buffer.from([1, 2, 3, 4]));
    assert.equal(await adapter.findDirectFile('bob', '../../escape'), undefined);
    data.set(
      'private:///chat-transfers/bob/' + id + '.json',
      Buffer.from(JSON.stringify({ ...info, file: id + '-../../escape' })),
    );
    assert.equal(await adapter.findDirectFile('bob', id), undefined);
  } finally {
    Module._load = original;
  }
});
