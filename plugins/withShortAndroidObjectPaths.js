const { withAppBuildGradle } = require('expo/config-plugins');

const marker = '// Nest: shorten native object paths for Windows Ninja builds.';
const configuration = `
${marker}
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=250"
            }
        }
    }
}
`;

function shortenObjectPaths(contents) {
  // 240 leaves too little space for CMake's hash plus long codegen basenames.
  // 250 allows hashing while keeping object and dependency files below 260.
  return contents.includes(marker)
    ? contents.replace(/-DCMAKE_OBJECT_PATH_MAX=\d+/g, '-DCMAKE_OBJECT_PATH_MAX=250')
    : `${contents.trimEnd()}\n${configuration}`;
}

module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy')
      throw new Error('Short Android object paths require a Groovy app/build.gradle.');
    mod.modResults.contents = shortenObjectPaths(mod.modResults.contents);
    return mod;
  });

module.exports.shortenObjectPaths = shortenObjectPaths;
