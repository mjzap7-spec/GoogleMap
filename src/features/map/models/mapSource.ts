export const mapStyleUrl = 'https://tiles.openfreemap.org/styles/dark';
export const mapDocumentBaseUrl = 'https://google-map.local/';
export function isMapDocument(value: string) {
  return value === 'about:blank' || value === 'about:srcdoc' || value === mapDocumentBaseUrl;
}
export function isMapAttributionLink(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        'openfreemap.org',
        'www.openstreetmap.org',
        'www.openmaptiles.org',
        'openmaptiles.org',
        'maplibre.org',
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
