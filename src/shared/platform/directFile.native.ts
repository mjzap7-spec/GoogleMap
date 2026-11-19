import * as DocumentPicker from 'expo-document-picker';
import { File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const MAX_BYTES = 100 * 1024 * 1024;
export async function pickDirectFile() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  const dispose = () => {
    if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  };
  if (!file.size || file.size > MAX_BYTES) {
    dispose();
    throw Error('Choose a file up to 100 MB.');
  }
  const handle = file.open(FileMode.ReadOnly);
  let closed = false;
  return {
    name: asset.name.slice(0, 180),
    size: file.size,
    mime: (asset.mimeType ?? 'application/octet-stream').slice(0, 120),
    async read(offset: number, length: number) {
      handle.offset = offset;
      return handle.readBytes(length);
    },
    close() {
      if (closed) return;
      closed = true;
      handle.close();
      dispose();
    },
  };
}
export async function receiveDirectFile(info: { name: string; mime: string }) {
  const file = new File(
    Paths.cache,
    'transfer-' + Date.now() + '-' + info.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100),
  );
  file.create();
  const handle = file.open(FileMode.WriteOnly);
  let finished = false;
  let closed = false;
  return {
    async write(bytes: Uint8Array) {
      if (closed || finished) throw Error('Transfer closed');
      await handle.writeBytes(bytes);
    },
    async save() {
      if (closed) throw Error('Transfer closed');
      if (!finished) {
        finished = true;
        handle.close();
      }
      if (!(await Sharing.isAvailableAsync()))
        throw Error('File sharing is unavailable on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: info.mime, dialogTitle: info.name });
    },
    close() {
      if (closed) return;
      closed = true;
      if (!finished) handle.close();
      if (file.exists) file.delete();
    },
  };
}
