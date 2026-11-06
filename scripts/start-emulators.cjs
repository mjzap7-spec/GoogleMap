const { spawn } = require('node:child_process');
const path = require('node:path');
const { openEmulators } = require('./open-emulators.cjs');
const { isProjectMetro, isPortAvailable, selectMetroServer } = require('./metro-server.cjs');

const root = path.resolve(__dirname, '..');
async function startMetro(port) {
  // Recheck after discovery in case another launcher finished starting meanwhile.
  if (await isProjectMetro(port, root)) return undefined;
  if (!(await isPortAvailable(port)))
    throw new Error(`Port ${port} became busy. Run npm run android:dev again to select a server.`);
  console.log(`Starting one Metro server on ${port} for both emulators...`);
  const metro = spawn(
    process.execPath,
    [require.resolve('expo/bin/cli'), 'start', '--dev-client', '--port', String(port)],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );
  let failure;
  metro.once('exit', (code, signal) => {
    failure = new Error(`Metro exited (${signal ?? code}). Check the output above and retry.`);
  });
  metro.once('error', (error) => {
    failure = error;
  });
  try {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const ready = await isProjectMetro(port, root);
      if (failure) throw failure;
      if (ready) return metro;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Metro on ${port} did not become ready within 90 seconds. Check its output.`);
  } catch (error) {
    metro.kill();
    throw error;
  }
}

async function main(
  args = process.argv.slice(2),
  {
    select = selectMetroServer,
    start = startMetro,
    open = openEmulators,
    play = (...routeArgs) => require('./play-route.cjs').playRoute(...routeArgs),
    log = console.log,
  } = {},
) {
  const { port, reused } = await select(root);
  let metro;
  try {
    if (reused) log(`Using this project's existing Metro server on ${port}.`);
    else metro = await start(port);
    await open(port, { bootMissing: true });
    log(`Both apps use port ${port}. Keep the Metro terminal open while testing.`);
    if (args[0] === '--route') await play(...args.slice(1));
  } catch (error) {
    // Never stop a server that was already running before this command.
    metro?.kill();
    throw error;
  }
}

module.exports = { main };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
