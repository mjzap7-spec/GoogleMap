function reply(status, body, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  });
}

async function getIceServers(env, useMetered) {
  if (useMetered) {
    const url = new URL(`https://${env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials`);
    url.searchParams.set('apiKey', env.METERED_TURN_API_KEY);
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    return response.ok ? await response.json() : null;
  }

  const keyId = encodeURIComponent(env.TURN_KEY_ID);
  const response = await postJson(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    { ttl: 10800 },
    { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}` },
  );
  return response.ok ? (await response.json()).iceServers : null;
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/ice') {
      return reply(404, { error: 'Endpoint not found' });
    }
    if (request.method !== 'GET') {
      return reply(405, { error: 'Use GET' }, { Allow: 'GET' });
    }

    const authorization = request.headers.get('Authorization') ?? '';
    const idToken = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(authorization)?.[1];
    if (!idToken) return reply(401, { error: 'Firebase sign-in required' });
    const useMetered = Boolean(env.METERED_APP_NAME || env.METERED_TURN_API_KEY);
    const relayConfigured = useMetered
      ? /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(env.METERED_APP_NAME ?? '') &&
        env.METERED_TURN_API_KEY
      : env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN;
    if (!env.FIREBASE_API_KEY || !relayConfigured) {
      return reply(503, { error: 'Relay configuration unavailable' });
    }

    try {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const ipLimit = await env.AUTH_LIMIT.limit({ key: ip });
      if (!ipLimit.success) return reply(429, { error: 'Try again in a minute' });

      const lookup = new URL('https://identitytoolkit.googleapis.com/v1/accounts:lookup');
      lookup.searchParams.set('key', env.FIREBASE_API_KEY);
      const account = await postJson(lookup, { idToken });
      if (!account.ok) {
        const { error } = await account.json();
        const invalidToken = [
          'INVALID_ID_TOKEN',
          'TOKEN_EXPIRED',
          'USER_NOT_FOUND',
          'USER_DISABLED',
        ];
        if (invalidToken.includes(error?.message)) {
          return reply(401, { error: 'Firebase sign-in required' });
        }
        return reply(502, { error: 'Firebase sign-in verification unavailable' });
      }

      const { users } = await account.json();
      const user = users?.[0];
      if (!user?.localId || user.disabled) {
        return reply(401, { error: 'Firebase sign-in required' });
      }
      const userLimit = await env.TURN_LIMIT.limit({ key: user.localId });
      if (!userLimit.success) return reply(429, { error: 'Try again in a minute' });

      const iceServers = await getIceServers(env, useMetered);
      if (!Array.isArray(iceServers)) {
        return reply(502, { error: 'Relay credential service unavailable' });
      }
      const servers = iceServers
        .map(({ urls, username, credential }) => ({
          urls: (Array.isArray(urls) ? urls : [urls]).filter(
            (url) => typeof url === 'string' && !/:53(?:\?|$)/.test(url),
          ),
          username,
          credential,
        }))
        .filter(({ urls }) => urls.length);
      if (
        !servers.some(
          ({ urls, username, credential }) =>
            username && credential && urls.some((url) => /^turns?:/.test(url)),
        )
      ) {
        return reply(502, { error: 'Relay credential service returned no TURN server' });
      }
      return reply(200, { iceServers: servers });
    } catch {
      return reply(502, { error: 'Relay credentials unavailable' });
    }
  },
};
