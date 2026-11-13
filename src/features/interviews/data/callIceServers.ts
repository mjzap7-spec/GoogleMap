import { getFirebaseAuth } from '../../../config/firebase/client';
import type { IceServer } from './PeerCallMedia';

let cachedRelay:
  { uid: string; endpoint: string; expiresAt: number; servers: IceServer[] } | undefined;
let pendingRelay: { uid: string; endpoint: string; request: Promise<IceServer[]> } | undefined;

/** An optional trusted backend returns short-lived TURN credentials; no relay secret belongs in the app. */
export async function callIceServers(): Promise<IceServer[]> {
  const endpoint = process.env.EXPO_PUBLIC_CALL_ICE_ENDPOINT;
  if (!endpoint) return [{ urls: 'stun:stun.l.google.com:19302' }];
  const user = getFirebaseAuth().currentUser;
  if (!user) throw Error('Could not load the call relay configuration.');
  if (
    cachedRelay?.uid === user.uid &&
    cachedRelay.endpoint === endpoint &&
    cachedRelay.expiresAt > Date.now()
  )
    return cachedRelay.servers;
  if (pendingRelay?.uid === user.uid && pendingRelay.endpoint === endpoint)
    return pendingRelay.request;
  const request = fetchRelay(endpoint, user);
  pendingRelay = { uid: user.uid, endpoint, request };
  try {
    return await request;
  } finally {
    if (pendingRelay?.request === request) pendingRelay = undefined;
  }
}

async function fetchRelay(
  endpoint: string,
  user: NonNullable<ReturnType<typeof getFirebaseAuth>['currentUser']>,
): Promise<IceServer[]> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error();
    const token = await user.getIdToken();
    if (!token) throw Error();
    const options: RequestInit = {
      signal: abort.signal,
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + token },
    };
    let response = await fetch(url.toString(), options).catch(() => undefined);
    if (!abort.signal.aborted && (!response || response.status >= 500)) {
      response = await fetch(url.toString(), options);
    }
    if (!response) throw Error('Credential endpoint unreachable');
    if (!response.ok) throw Error(`Credential endpoint returned HTTP ${response.status}`);
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
    if (getFirebaseAuth().currentUser === user)
      cachedRelay = {
        uid: user.uid,
        endpoint,
        expiresAt: Date.now() + 60_000,
        servers: iceServers,
      };
    return iceServers;
  } catch (error) {
    if (process.env.NODE_ENV === 'development')
      console.info(
        '[Interview] Relay request failed:',
        error instanceof Error && /^Credential endpoint returned HTTP \d+$/.test(error.message)
          ? error.message
          : error instanceof Error
            ? error.name
            : 'UnknownError',
      );
    throw Error('Could not load the call relay configuration.');
  } finally {
    clearTimeout(timer);
  }
}
