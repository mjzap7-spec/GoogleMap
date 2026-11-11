import { getFirebaseAuth } from '../../../config/firebase/client';
import type { IceServer } from './PeerCallMedia';

/** An optional trusted backend returns short-lived TURN credentials; no relay secret belongs in the app. */
export async function callIceServers(): Promise<IceServer[]> {
  const endpoint = process.env.EXPO_PUBLIC_CALL_ICE_ENDPOINT;
  if (!endpoint) return [{ urls: 'stun:stun.l.google.com:19302' }];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error();
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) throw Error();
    const response = await fetch(url.toString(), {
      signal: abort.signal,
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw Error();
    const { iceServers } = await response.json();
    if (
      !Array.isArray(iceServers) ||
      !iceServers.length ||
      iceServers.length > 8 ||
      !iceServers.every((server: IceServer) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return (
          urls.length > 0 &&
          urls.length <= 8 &&
          urls.every(
            (url) => typeof url === 'string' && /^(stun|stuns|turn|turns):[^\s]+$/.test(url),
          ) &&
          (server.username === undefined || typeof server.username === 'string') &&
          (server.credential === undefined || typeof server.credential === 'string')
        );
      })
    )
      throw Error();
    return iceServers;
  } catch {
    throw Error('Could not load the call relay configuration.');
  } finally {
    clearTimeout(timer);
  }
}
