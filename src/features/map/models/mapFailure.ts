export const mapConnectionError = 'Could not load the map. Check your connection and retry.';
export const mapClockError =
  'The map connection failed a date/time check. Enable automatic date and time on your device, then reload the map.';
export const mapCertificateError =
  'Could not securely connect to the map service. Please try again later.';

/** Android WebView reports certificate errors for individual map resources separately. */
export function mapResourceFailure(url: string, code: number): string | undefined {
  try {
    const resource = new URL(url);
    const mapResource =
      resource.protocol === 'https:' &&
      (resource.hostname === 'tiles.openfreemap.org' ||
        (resource.hostname === 'unpkg.com' && resource.pathname.startsWith('/maplibre-gl@')));
    if (!mapResource) return;
    // android.net.http.SslError: NOTYETVALID (0), EXPIRED (1), DATE_INVALID (4).
    return [0, 1, 4].includes(code) ? mapClockError : mapCertificateError;
  } catch {
    return;
  }
}
