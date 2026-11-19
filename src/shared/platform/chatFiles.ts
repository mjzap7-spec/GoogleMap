import * as DocumentPicker from 'expo-document-picker';

export async function pickChatFile() {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset.file) throw Error('Could not read this file.');
  if (asset.file.size > 1024 * 1024) throw Error('Choose a file smaller than 1 MB.');
  return {
    name: asset.name,
    mime: asset.mimeType ?? 'application/octet-stream',
    bytes: new Uint8Array(await asset.file.arrayBuffer()),
  };
}
export async function saveChatFile(name: string, mime: string, bytes: Uint8Array) {
  const data = new Uint8Array(bytes);
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
