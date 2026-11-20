import * as DocumentPicker from 'expo-document-picker';
interface Info {
  name: string;
  mime: string;
  size: number;
}
function download(blob: Blob, info: Info) {
  const uri = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = uri;
  link.download = info.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(uri), 1000);
}
function saved(blob: Blob, info: Info) {
  const uri = URL.createObjectURL(blob);
  return {
    uri,
    async save() {
      download(blob, info);
    },
    release() {
      URL.revokeObjectURL(uri);
    },
  };
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('private-chat-transfers', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function keep(uid: string, id: string, blob: Blob, info: Info) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore('files').put({ blob, info }, JSON.stringify([uid, id]));
    });
  } finally {
    db.close();
  }
  return saved(blob, info);
}
export async function findDirectFile(uid: string, id: string) {
  const db = await database();
  try {
    const value = await new Promise<{ blob: Blob; info: Info } | undefined>((resolve, reject) => {
      const request = db
        .transaction('files')
        .objectStore('files')
        .get(JSON.stringify([uid, id]));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return value && saved(value.blob, value.info);
  } finally {
    db.close();
  }
}
export async function pickDirectFile() {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false });
  if (result.canceled) return;
  const file = result.assets[0].file;
  if (!file || !file.size || file.size > 100 * 1024 * 1024)
    throw Error('Choose a file up to 100 MB.');
  const info = {
    name: file.name.slice(0, 180),
    size: file.size,
    mime: (file.type || 'application/octet-stream').slice(0, 120),
  };
  const previewUri = URL.createObjectURL(file);
  return {
    ...info,
    previewUri,
    keep: (uid: string, id: string) => keep(uid, id, file, info),
    async read(offset: number, length: number) {
      return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
    },
    close() {
      URL.revokeObjectURL(previewUri);
    },
  };
}
export async function receiveDirectFile(info: Info) {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  return {
    async write(bytes: Uint8Array) {
      chunks.push(new Uint8Array(bytes));
    },
    keep: (uid: string, id: string) => keep(uid, id, new Blob(chunks, { type: info.mime }), info),
    async save() {
      download(new Blob(chunks, { type: info.mime }), info);
    },
    close() {
      chunks.length = 0;
    },
  };
}
