import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

interface Info {
  name: string;
  mime: string;
  size: number;
}
const MAX_BYTES = 100 * 1024 * 1024;
const safeName = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .slice(-120) || 'file';
function directory(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('Please sign in again.');
  return new Directory(Paths.document, 'chat-transfers', uid);
}
function localFile(file: File, info: Info) {
  return {
    uri: file.uri,
    async save() {
      if (!file.exists) throw Error('File is no longer available on this device.');
      if (Platform.OS === 'android') {
        let target: Directory;
        try {
          target = await Directory.pickDirectoryAsync();
        } catch (error) {
          if (error instanceof Error && /cancel/i.test(error.message)) return;
          throw error;
        }
        const name = safeName(info.name);
        let destination = new File(target, name);
        if (destination.exists) destination = new File(target, Date.now() + '-' + name);
        await file.copy(destination);
      } else {
        if (!(await Sharing.isAvailableAsync()))
          throw Error('File sharing is unavailable on this device.');
        await Sharing.shareAsync(file.uri, { mimeType: info.mime, dialogTitle: info.name });
      }
    },
  };
}
async function keep(uid: string, id: string, source: File, info: Info) {
  if (!/^[A-Za-z0-9]{20}$/.test(id)) throw Error('Invalid file invitation');
  const folder = directory(uid);
  folder.create({ intermediates: true, idempotent: true });
  const name = id + '-' + safeName(info.name);
  const destination = new File(folder, name);
  if (source.uri !== destination.uri) await source.copy(destination, { overwrite: true });
  const metadata = new File(folder, id + '.json');
  metadata.create({ overwrite: true });
  await metadata.write(JSON.stringify({ ...info, file: name }));
  return localFile(destination, info);
}
export async function findDirectFile(uid: string, id: string) {
  if (!/^[A-Za-z0-9]{20}$/.test(id)) return;
  try {
    const folder = directory(uid),
      metadata = new File(folder, id + '.json');
    if (!metadata.exists) return;
    const value = JSON.parse(await metadata.text());
    if (
      typeof value.file !== 'string' ||
      !value.file.startsWith(id + '-') ||
      /[/\\]/.test(value.file) ||
      typeof value.name !== 'string' ||
      typeof value.mime !== 'string' ||
      value.size <= 0 ||
      value.size > MAX_BYTES
    )
      return;
    const file = new File(folder, value.file);
    if (!file.exists || file.size !== value.size) return;
    return localFile(file, value);
  } catch {
    return;
  }
}
export async function pickDirectFile() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0],
    file = new File(asset.uri);
  const dispose = () => {
    if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  };
  if (!file.size || file.size > MAX_BYTES) {
    dispose();
    throw Error('Choose a file up to 100 MB.');
  }
  const info = {
    name: asset.name.slice(0, 180),
    size: file.size,
    mime: (asset.mimeType || 'application/octet-stream').slice(0, 120),
  };
  const handle = file.open(FileMode.ReadOnly);
  let closed = false;
  return {
    ...info,
    previewUri: file.uri,
    keep: (uid: string, id: string) => keep(uid, id, file, info),
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
export async function receiveDirectFile(info: Info) {
  const file = new File(Paths.cache, 'transfer-' + Date.now() + '-' + safeName(info.name));
  file.create();
  const handle = file.open(FileMode.WriteOnly);
  let finished = false,
    closed = false;
  const finish = async () => {
    if (!finished && !closed) {
      handle.close();
      finished = true;
    }
  };
  return {
    async write(bytes: Uint8Array) {
      if (closed || finished) throw Error('Transfer closed');
      await handle.writeBytes(bytes);
    },
    finish,
    async keep(uid: string, id: string) {
      await finish();
      return keep(uid, id, file, info);
    },
    async save() {
      await finish();
      await localFile(file, info).save();
    },
    close() {
      if (closed) return;
      closed = true;
      if (!finished) handle.close();
      if (file.exists) file.delete();
    },
  };
}
