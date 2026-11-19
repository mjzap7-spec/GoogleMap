import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function pickChatFile() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (file.size > 1024 * 1024) throw Error('Choose a file smaller than 1 MB.');
    return {
      name: asset.name,
      mime: asset.mimeType ?? 'application/octet-stream',
      bytes: await file.bytes(),
    };
  } finally {
    if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  }
}
export async function saveChatFile(name: string, mime: string, bytes: Uint8Array) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error('File sharing is unavailable on this device.');
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'attachment';
  const file = new File(Paths.cache, Date.now() + '-' + safe);
  try {
    file.create();
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
  } finally {
    if (file.exists) file.delete();
  }
}
