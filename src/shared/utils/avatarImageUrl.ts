/** Small public Cloudinary avatars use a few reusable thumbnail sizes; other URLs stay intact. */
export function avatarImageUrl(uri: string, pixels = 96): string {
  const match = uri.match(/^https:\/\/res(?:-\d+)?\.cloudinary\.com\/[\w-]+\/image\/upload\//);
  if (!match || uri.includes('?') || uri.includes('#')) return uri;
  const path = uri.slice(match[0].length);
  // Preserve signed and already transformed URLs, which cannot safely be rewritten.
  if (!path || path.startsWith('s--') || /(?:^|,)[a-z]{1,3}_/.test(path.split('/')[0])) return uri;
  const size = pixels <= 96 ? 96 : pixels <= 160 ? 160 : 256;
  return match[0] + 'c_fill,w_' + size + ',h_' + size + ',q_auto,f_auto/' + path;
}
// Hermes does not retain function source. Keep the WebView version as literal source,
// with parity tests against the native function (as for the crowd-layout renderer).
export const avatarImageUrlSource = String.raw`function avatarImageUrl(uri, pixels = 96) {
  const match = uri.match(/^https:\/\/res(?:-\d+)?\.cloudinary\.com\/[\w-]+\/image\/upload\//);
  if (!match || uri.includes('?') || uri.includes('#')) return uri;
  const path = uri.slice(match[0].length);
  if (!path || path.startsWith('s--') || /(?:^|,)[a-z]{1,3}_/.test(path.split('/')[0])) return uri;
  const size = pixels <= 96 ? 96 : pixels <= 160 ? 160 : 256;
  return match[0] + 'c_fill,w_' + size + ',h_' + size + ',q_auto,f_auto/' + path;
}`;
