const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { setMetroHost, parseDevices } = require('./open-emulators.cjs');
const { selectMetroServer } = require('./metro-server.cjs');

function androidBuildEnvironment(
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
) {
  const result = { ...env };
  if (platform !== 'win32') return result;
  const sdk =
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    (env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (sdk && exists(path.join(sdk, 'platform-tools', 'adb.exe'))) {
    result.ANDROID_HOME = sdk;
  }
  if (!result.JAVA_HOME) {
    const java =
      env.ProgramFiles && path.join(env.ProgramFiles, 'Android', 'Android Studio', 'jbr');
    if (java && exists(path.join(java, 'bin', 'java.exe'))) result.JAVA_HOME = java;
  }
  return result;
}

function syncAndroidDebugHosts(env, port, exec = execFileSync) {
  const adb =
    env.ANDROID_HOME &&
    path.join(env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (!adb) return;
  const run = (args, options = {}) =>
    exec(adb, args, { encoding: 'utf8', windowsHide: true, timeout: 8000, ...options });
  const packageName = 'com.anonymous.nestauth';
  const preference = `shared_prefs/${packageName}_preferences.xml`;
  for (const serial of parseDevices(run(['devices']))) {
    if (run(['-s', serial, 'shell', 'getprop', 'sys.boot_completed']).trim() !== '1') continue;
    let xml;
    try {
      xml = run(['-s', serial, 'shell', 'run-as', packageName, 'cat', preference]);
    } catch (error) {
      if (!String(error.stderr ?? '').includes('No such file')) continue;
      xml = '<map></map>';
    }
    const updated = setMetroHost(xml, port);
    run(['-s', serial, 'shell', 'am', 'force-stop', packageName]);
    run(['-s', serial, 'shell', 'run-as', packageName, 'mkdir', '-p', 'shared_prefs']);
    run(['-s', serial, 'shell', `run-as ${packageName} sh -c 'cat > ${preference}'`], {
      input: updated,
    });
    run(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  }
}

async function main(args = process.argv.slice(2)) {
  const root = path.resolve(__dirname, '..');
  const env = androidBuildEnvironment();
  const portIndex = args.indexOf('--port');
  const explicitPort =
    portIndex >= 0 ? args[portIndex + 1] : args.find((arg) => arg.startsWith('--port='))?.slice(7);
  const port =
    explicitPort === undefined ? (await selectMetroServer(root)).port : Number(explicitPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('Specify a valid Metro port.');
  syncAndroidDebugHosts(env, port);
  const child = spawn(
    process.execPath,
    [
      require.resolve('expo/bin/cli'),
      'run:android',
      ...args,
      ...(explicitPort === undefined ? ['--port', String(port)] : []),
    ],
    {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { androidBuildEnvironment, syncAndroidDebugHosts };
