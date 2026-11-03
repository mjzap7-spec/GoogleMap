const { withMainApplication } = require('expo/config-plugins');

function configureDevSupport(contents) {
  const factory = /ExpoReactHostFactory\.getDefaultReactHost\(\s*/;
  if (!factory.test(contents)) throw new Error('Expected ExpoReactHostFactory in MainApplication.');
  if (/useDevSupport\s*=/.test(contents)) return contents;
  // The app's build type controls Metro access, not the prebuilt RN library's build type.
  return contents.replace(factory, '$&useDevSupport = BuildConfig.DEBUG,\n      ');
}

module.exports = (config) =>
  withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Expected Kotlin MainApplication.');
    mod.modResults.contents = configureDevSupport(mod.modResults.contents);
    return mod;
  });

module.exports.configureDevSupport = configureDevSupport;
