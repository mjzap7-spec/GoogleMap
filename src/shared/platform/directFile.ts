import * as DocumentPicker from 'expo-document-picker';

export async function pickDirectFile() {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false });
  if (result.canceled) return;
  const file = result.assets[0].file;
  if (!file || !file.size || file.size > 100 * 1024 * 1024)
    throw Error('Choose a file up to 100 MB.');
  return {
    name: file.name.slice(0, 180),
    size: file.size,
    mime: (file.type || 'application/octet-stream').slice(0, 120),
    async read(offset: number, length: number) {
      return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
    },
    close() {},
  };
}
export async function receiveDirectFile(info: { name: string; mime: string }) {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  return {
    async write(bytes: Uint8Array) {
      chunks.push(new Uint8Array(bytes));
    },
    async save() {
      const url = URL.createObjectURL(new Blob(chunks, { type: info.mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = info.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    close() {
      chunks.length = 0;
    },
  };
}
