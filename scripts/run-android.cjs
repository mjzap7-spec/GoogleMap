const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

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

if (require.main === module) {
  const child = spawn(
    process.execPath,
    [require.resolve('expo/bin/cli'), 'run:android', ...process.argv.slice(2)],
    {
      cwd: path.resolve(__dirname, '..'),
      env: androidBuildEnvironment(),
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
module.exports = { androidBuildEnvironment };
