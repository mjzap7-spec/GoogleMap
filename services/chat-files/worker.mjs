const MAX_BYTES = 1024 * 1024;
const LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const reply = (status, error) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const identifier = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');

async function permitted(context, uid, token, env) {
  const group = context?.groupId;
  if (group && !identifier(group)) return false;
  const requestId = context?.requestId;
  if (!group && !identifier(requestId)) return false;
  const path = group
    ? 'privateGroups/' + encodeURIComponent(group)
    : 'contactRequests/' + encodeURIComponent(requestId);
  const response = await fetch(
    'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(env.FIREBASE_PROJECT_ID) +
      '/databases/(default)/documents/' +
      path,
    {
      headers: { Authorization: 'Bearer ' + token },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) return false;
  const { fields } = await response.json();
  if (group) {
    const members = fields?.joinedIds?.arrayValue?.values?.map((value) => value.stringValue) ?? [];
    return (
      members.includes(uid) &&
      (!context.memberId || (identifier(context.memberId) && members.includes(context.memberId)))
    );
  }
  const participants = [fields?.fromId?.stringValue, fields?.toId?.stringValue];
  return (
    fields?.status?.stringValue === 'accepted' &&
    participants.includes(uid) &&
    identifier(context.peerId) &&
    participants.includes(context.peerId) &&
    context.peerId !== uid
  );
}

export default {
  async fetch(request, env) {
    const match = /^\/files(?:\/([a-f0-9-]{36}))?$/.exec(new URL(request.url).pathname);
    if (!match) return reply(404, 'File not found');
    if (!env.FILES || !env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID)
      return reply(503, 'File service setup required');
    const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(
      request.headers.get('Authorization') ?? '',
    )?.[1];
    if (!token) return reply(401, 'Sign in required');
    try {
      if (
        !(await env.FILE_LIMIT.limit({ key: 'ip:' + request.headers.get('CF-Connecting-IP') }))
          .success
      )
        return reply(429, 'Try again later');
      const auth = await fetch(
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
          encodeURIComponent(env.FIREBASE_API_KEY),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!auth.ok) return reply(401, 'Sign in required');
      const account = (await auth.json()).users?.[0];
      const uid = account?.localId;
      if (!uid || account.disabled) return reply(401, 'Sign in required');
      const id = match[1];
      if (!id && request.method === 'POST') {
        if (!(await env.UPLOAD_LIMIT.limit({ key: uid })).success)
          return reply(429, 'Try again later');
        const context = JSON.parse(request.headers.get('X-Chat-Context') ?? 'null');
        if (!context || typeof context !== 'object' || !(await permitted(context, uid, token, env)))
          return reply(403, 'Chat access required');
        const reader = request.body?.getReader();
        if (!reader) return reply(400, 'Choose a file');
        const chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            return reply(413, 'Maximum file size is 1 MB');
          }
          chunks.push(value);
        }
        if (!size) return reply(400, 'Empty file');
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const fileId = crypto.randomUUID();
        await env.FILES.put(fileId, bytes.buffer, {
          expirationTtl: LIFETIME_SECONDS,
          metadata: { uid, context, size },
        });
        return Response.json({ id: fileId }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (id && ['GET', 'DELETE'].includes(request.method)) {
        const file = await env.FILES.getWithMetadata(id, { type: 'arrayBuffer' });
        if (!file.value || !file.metadata) return reply(404, 'File expired or removed');
        const owner = file.metadata.uid === uid;
        const context = file.metadata.context;
        const privatePair =
          !context.memberId || [context.memberId, file.metadata.uid].includes(uid);
        const directPair = !context.peerId || [context.peerId, file.metadata.uid].includes(uid);
        if (
          !privatePair ||
          !directPair ||
          !(await permitted(
            context.peerId && !owner ? { ...context, peerId: file.metadata.uid } : context,
            uid,
            token,
            env,
          ))
        )
          return reply(403, 'Chat access required');
        if (request.method === 'DELETE') {
          if (!owner) return reply(403, 'Uploader required');
          await env.FILES.delete(id);
          return new Response(null, { status: 204 });
        }
        return new Response(file.value, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      return reply(405, 'Method unavailable');
    } catch {
      return reply(502, 'File service unavailable');
    }
  },
};
