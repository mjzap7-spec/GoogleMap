// Backfill searchable group summaries from authoritative group and profile records.
// Run with the project's Firebase CLI account. Default is read-only.
const path = require('node:path');
async function main() {
  const [project, ...flags] = process.argv.slice(2);
  if (
    !/^[a-z][a-z0-9-]+$/.test(project ?? '') ||
    flags.some((flag) => !['--apply', '--members'].includes(flag))
  )
    throw Error('Usage: node scripts/backfill-group-directory.cjs PROJECT [--members] [--apply]');
  const apply = flags.includes('--apply');
  const lib =
    process.env.FIREBASE_CLI_LIB ||
    path.join(process.env.APPDATA ?? '', 'npm/node_modules/firebase-tools/lib');
  const auth = require(path.join(lib, 'auth'));
  const opts = { project, projectDir: process.cwd() };
  const account = auth.getProjectDefaultAccount(process.cwd()) || auth.getGlobalDefaultAccount();
  if (!account) throw Error('Sign in with the Firebase CLI first.');
  auth.setActiveAccount(opts, account);
  await require(path.join(lib, 'requireAuth')).requireAuth(opts);
  const { Client } = require(path.join(lib, 'apiv2'));
  const api = new Client({
    urlPrefix: 'https://firestore.googleapis.com',
    apiVersion: 'v1',
    auth: true,
  });
  const root = 'projects/' + project + '/databases/(default)/documents';
  const post = async (suffix, body) =>
    (await api.post('/' + root + suffix, body, { skipLog: { resBody: true, reqBody: true } })).body;
  const list = async (collectionId, fieldPaths) =>
    (
      await post(':runQuery', {
        structuredQuery: {
          from: [{ collectionId }],
          select: { fields: fieldPaths.map((fieldPath) => ({ fieldPath })) },
        },
      })
    ).flatMap((row) => (row.document ? [row.document] : []));
  const groups = await list('privateGroups', ['joinedIds']);
  if (flags.includes('--members')) return backfillMembers(post, root, groups, apply);
  const entries = await list('groupDirectory', [
    'active',
    'createdAt',
    'creatorName',
    'memberCount',
  ]);
  const existing = new Map(entries.map((entry) => [entry.name, entry.fields]));
  const destination = (group) => group.replace('/privateGroups/', '/groupDirectory/');
  const count = (group) => group.fields.joinedIds.arrayValue.values.length;
  function needsUpdate(group, entry) {
    if (entry?.active?.booleanValue === false) return false;
    return (
      !entry?.createdAt?.timestampValue ||
      !entry?.creatorName ||
      Number(entry?.memberCount?.integerValue) !== count(group)
    );
  }
  const missing = groups.filter((g) => needsUpdate(g, existing.get(destination(g.name))));
  console.log(missing.length + ' existing groups need directory metadata in ' + project + '.');
  if (!apply) return;
  let created = 0;
  for (const { name: group } of missing) {
    const dest = destination(group);
    const { transaction } = await post(':beginTransaction', { options: { readWrite: {} } });
    try {
      const docs = await post(':batchGet', {
        documents: [group, dest],
        transaction,
        mask: {
          fieldPaths: [
            'name',
            'active',
            'joinedIds',
            'ownerId',
            'createdAt',
            'creatorName',
            'memberCount',
          ],
        },
      });
      const source = docs.find((r) => r.found?.name === group)?.found;
      const entry = docs.find((r) => r.found?.name === dest)?.found;
      if (!source || !needsUpdate(source, entry?.fields)) {
        await post(':rollback', { transaction });
        continue;
      }
      const profilePath = root + '/users/' + source.fields.ownerId.stringValue;
      const profile = await post(':batchGet', {
        documents: [profilePath],
        transaction,
        mask: { fieldPaths: ['fullName'] },
      });
      const creatorName = entry?.fields?.creatorName ??
        profile[0]?.found?.fields?.fullName ?? { nullValue: null };
      await post(':commit', {
        transaction,
        writes: [
          {
            update: {
              name: dest,
              fields: {
                name: source.fields.name,
                active: { booleanValue: true },
                createdAt: entry?.fields?.createdAt ?? { timestampValue: source.createTime },
                creatorName,
                memberCount: { integerValue: String(count(source)) },
              },
            },
            currentDocument: entry ? { updateTime: entry.updateTime } : { exists: false },
          },
        ],
      });
      created++;
    } catch (e) {
      await post(':rollback', { transaction }).catch(() => {});
      throw e;
    }
  }
  console.log('Updated ' + created + ' group summaries.');
}
async function backfillMembers(post, root, groups, apply) {
  let missing = 0,
    written = 0,
    unavailable = 0;
  for (const group of groups) {
    const { transaction } = await post(':beginTransaction', {
      options: apply ? { readWrite: {} } : { readOnly: {} },
    });
    try {
      const [current] = await post(':batchGet', {
        documents: [group.name],
        mask: { fieldPaths: ['joinedIds'] },
        transaction,
      });
      const ids = (current.found?.fields.joinedIds.arrayValue.values ?? []).map(
        (v) => v.stringValue,
      );
      const cards = ids.length
        ? await post(':batchGet', {
            documents: ids.map((id) => group.name + '/members/' + id),
            mask: { fieldPaths: ['name'] },
            transaction,
          })
        : [];
      const absent = cards
        .filter((card) => card.missing)
        .map((card) => card.missing.split('/').pop());
      missing += absent.length;
      if (!apply || !absent.length) {
        await post(':rollback', { transaction });
        continue;
      }
      const profiles = await post(':batchGet', {
        documents: absent.map((id) => root + '/users/' + id),
        mask: { fieldPaths: ['fullName', 'avatarUrl'] },
        transaction,
      });
      const writes = profiles.flatMap(({ found }) => {
        if (!found?.fields?.fullName?.stringValue) {
          unavailable++;
          return [];
        }
        const id = found.name.split('/').pop();
        return [
          {
            update: {
              name: group.name + '/members/' + id,
              fields: {
                name: found.fields.fullName,
                avatarUrl: found.fields.avatarUrl ?? { nullValue: null },
              },
            },
            currentDocument: { exists: false },
          },
        ];
      });
      if (writes.length) await post(':commit', { transaction, writes });
      else await post(':rollback', { transaction });
      written += writes.length;
    } catch (error) {
      await post(':rollback', { transaction }).catch(() => {});
      throw error;
    }
  }
  console.log('Missing group member cards: ' + missing + '.');
  if (apply)
    console.log('Created ' + written + ' cards. Unavailable profiles: ' + unavailable + '.');
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
