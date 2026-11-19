const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AttachmentsViewModel,
} = require('../.test-build/features/chat/viewmodels/AttachmentsViewModel');
const {
  parseAttachment,
  ATTACHMENT_PREFIX,
} = require('../.test-build/features/chat/models/attachments');
const peer = { peerId: 'bob', requestId: 'r' };
const file = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'notes.pdf',
  size: 3,
  mime: 'application/pdf',
};

test('file messages validate their size and retain backward-compatible plain text', () => {
  assert.deepEqual(parseAttachment(ATTACHMENT_PREFIX + JSON.stringify(file)), file);
  assert.equal(parseAttachment('ordinary text'), undefined);
  assert.equal(parseAttachment(ATTACHMENT_PREFIX + '{"id":null}'), undefined);
  assert.equal(
    parseAttachment(ATTACHMENT_PREFIX + JSON.stringify({ ...file, size: 1048577 })),
    undefined,
  );
});
test('a cancelled file picker sends no message and duplicate taps open one picker', async () => {
  let finish,
    picks = 0,
    messages = 0;
  const model = new AttachmentsViewModel(
    {
      pick: () => {
        picks++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
    {
      send: async () => {
        messages++;
      },
    },
    'alice',
    peer,
  );
  const pending = model.send();
  await model.send();
  finish(undefined);
  await pending;
  assert.equal(picks, 1);
  assert.equal(messages, 0);
  assert.equal(model.getSnapshot().sending, false);
});
test('leaving during upload discards the orphan and sends no message', async () => {
  let complete,
    removed,
    sent = 0;
  const files = {
    pick: async () => ({ bytes: new Uint8Array([1]), name: 'notes.pdf' }),
    upload: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
    discard: async (id) => {
      removed = id;
    },
  };
  const model = new AttachmentsViewModel(
    files,
    {
      send: async () => {
        sent++;
      },
    },
    'alice',
    peer,
  );
  const pending = model.send();
  await new Promise(setImmediate);
  model.stop();
  complete(file);
  await pending;
  assert.equal(removed, file.id);
  assert.equal(sent, 0);
});
test('an uncertain message write keeps its uploaded file available until expiry', async () => {
  let removed = false;
  const files = {
    pick: async () => ({}),
    upload: async () => file,
    discard: async () => {
      removed = true;
    },
  };
  const model = new AttachmentsViewModel(
    files,
    {
      send: async () => {
        throw Error('offline');
      },
    },
    'alice',
    peer,
  );
  await model.send();
  assert.equal(removed, false);
  assert.equal(model.getSnapshot().error, 'offline');
});
