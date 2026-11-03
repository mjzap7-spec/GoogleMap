/** Native Google sign-in needs the reversed iOS OAuth client ID as a URL scheme. */
module.exports = ({ config }) => {
  config = {
    ...config,
    plugins: [...(config.plugins ?? []), './plugins/withShortAndroidObjectPaths'],
  };
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId?.endsWith(suffix)) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['@react-native-google-signin/google-signin', { iosUrlScheme }],
    ],
  };
};
