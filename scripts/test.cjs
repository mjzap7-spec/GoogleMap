const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '.test-build');
// Delete only this project's generated test output; never a user-supplied path.
if (path.dirname(output) !== root || path.basename(output) !== '.test-build') {
  throw new Error('Unexpected test output directory');
}
fs.rmSync(output, { recursive: true, force: true });

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.test.json']);
const tests = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((file) => file.endsWith('.test.cjs'))
  .sort()
  .map((file) => path.join('tests', file));
run(['--test', ...tests]);
