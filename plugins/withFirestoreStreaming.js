const { withMainApplication } = require('expo/config-plugins');

const marker = '// Google Map: keep Firestore streams out of the buffering dev inspector.';
const hook = `${marker}
    if (BuildConfig.DEBUG) {
      NetworkingModule.setCustomClientBuilder { builder ->
        val interceptors = builder.networkInterceptors()
        for (index in interceptors.indices) {
          val inspector = interceptors[index]
          if (inspector.javaClass.name == "expo.modules.kotlin.devtools.ExpoNetworkInspectOkHttpNetworkInterceptor") {
            interceptors[index] = okhttp3.Interceptor { chain ->
              if (chain.request().url.host == "firestore.googleapis.com") {
                chain.proceed(chain.request())
              } else {
                inspector.intercept(chain)
              }
            }
          }
        }
      }
    }

    `;

function configureFirestoreStreaming(contents) {
  if (contents.includes(marker)) return contents;
  if (!contents.includes('loadReactNative(this)'))
    throw new Error('Expected loadReactNative(this) in Kotlin MainApplication.');
  const importLine = 'import com.facebook.react.modules.network.NetworkingModule';
  if (!contents.includes(importLine)) {
    contents = contents.replace(/(import android\.app\.Application\r?\n)/, `$1${importLine}\n`);
    if (!contents.includes(importLine)) throw new Error('Expected Application import.');
  }
  return contents.replace('loadReactNative(this)', `${hook}loadReactNative(this)`);
}

module.exports = (config) =>
  withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Expected Kotlin MainApplication.');
    mod.modResults.contents = configureFirestoreStreaming(mod.modResults.contents);
    return mod;
  });
module.exports.configureFirestoreStreaming = configureFirestoreStreaming;
