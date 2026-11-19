const { withMainApplication } = require('expo/config-plugins');

const marker = '// Google Map: emulator microphone capture.';
const configuration = `
    ${marker}
    val emulatorAudio = android.os.Build.HARDWARE in listOf("ranchu", "goldfish") ||
      android.os.Build.MODEL.startsWith("sdk_gphone")
    if (emulatorAudio) {
      val builder = org.webrtc.audio.JavaAudioDeviceModule.builder(this)
        .setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
        .setUseHardwareAcousticEchoCanceler(false)
        .setUseHardwareNoiseSuppressor(false)
        .setEnableVolumeLogger(false)
      if (BuildConfig.DEBUG) {
        var lastAudioReport = android.os.SystemClock.elapsedRealtime()
        var capturePeak = 0
        builder.setSamplesReadyCallback { samples ->
          // Report amplitude only. Never retain, log, or upload microphone samples.
          if (samples.audioFormat == android.media.AudioFormat.ENCODING_PCM_16BIT) {
            val bytes = samples.data
            var index = 0
            while (index + 1 < bytes.size) {
              val value = ((bytes[index].toInt() and 255) or
                (bytes[index + 1].toInt() shl 8)).toShort().toInt()
              capturePeak = maxOf(capturePeak, kotlin.math.abs(value))
              index += 2
            }
          }
          val now = android.os.SystemClock.elapsedRealtime()
          if (now - lastAudioReport >= 3000) {
            android.util.Log.i("InterviewCapture", "Emulator raw microphone peak=" + capturePeak)
            capturePeak = 0
            lastAudioReport = now
          }
        }
      }
      com.oney.WebRTCModule.WebRTCModuleOptions.getInstance().audioDeviceModule =
        builder.createAudioDeviceModule()
      android.util.Log.i("InterviewCapture", "Using emulator MIC source; hardware voice effects disabled")
    }
`;

function configureEmulatorCallAudio(contents) {
  if (contents.includes(marker)) return contents;
  const anchor = '    loadReactNative(this)';
  if (!contents.includes(anchor))
    throw Error('Expected React Native initialization in Kotlin MainApplication.');
  return contents.replace(anchor, configuration + '\n' + anchor);
}
module.exports = (config) =>
  withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw Error('Expected Kotlin MainApplication.');
    mod.modResults.contents = configureEmulatorCallAudio(mod.modResults.contents);
    return mod;
  });
module.exports.configureEmulatorCallAudio = configureEmulatorCallAudio;
