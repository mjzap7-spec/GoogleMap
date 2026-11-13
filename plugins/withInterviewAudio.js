const { withMainApplication } = require('expo/config-plugins');

const marker = 'private class InterviewAudioPackage';
function configureInterviewAudio(contents) {
  if (contents.includes(marker)) return contents;
  const registration = 'PackageList(this).packages.apply {';
  if (!contents.includes(registration)) throw new Error('Expected Android package list.');
  return (
    contents.replace(registration, registration + '\n          add(InterviewAudioPackage())') +
    `

private class InterviewAudioPackage : ReactPackage {
  override fun createNativeModules(context: com.facebook.react.bridge.ReactApplicationContext) =
    listOf(InterviewAudioModule(context))

  override fun createViewManagers(context: com.facebook.react.bridge.ReactApplicationContext) =
    emptyList<com.facebook.react.uimanager.ViewManager<*, *>>()
}

@Suppress("DEPRECATION")
private class InterviewAudioModule(
  context: com.facebook.react.bridge.ReactApplicationContext
) : com.facebook.react.bridge.ReactContextBaseJavaModule(context) {
  private val audio = context.getSystemService(android.content.Context.AUDIO_SERVICE)
    as android.media.AudioManager
  private var previousMode: Int? = null
  private var previousSpeaker = false
  private var previousDevice: android.media.AudioDeviceInfo? = null

  override fun getName() = "InterviewAudio"

  @com.facebook.react.bridge.ReactMethod
  fun start(promise: com.facebook.react.bridge.Promise) {
    try {
      if (previousMode == null) {
        previousMode = audio.mode
        previousSpeaker = audio.isSpeakerphoneOn
        if (android.os.Build.VERSION.SDK_INT >= 31) previousDevice = audio.communicationDevice
      }
      audio.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
      if (android.os.Build.VERSION.SDK_INT >= 31) {
        val selected = audio.communicationDevice
        if (selected == null || selected.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
          val speaker = audio.availableCommunicationDevices.firstOrNull {
            it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
          }
          if (speaker != null) audio.setCommunicationDevice(speaker)
        }
      } else if (!audio.isWiredHeadsetOn && !audio.isBluetoothScoOn) {
        audio.isSpeakerphoneOn = true
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("INTERVIEW_AUDIO_ROUTE", error)
    }
  }

  @com.facebook.react.bridge.ReactMethod
  fun stop() {
    val mode = previousMode ?: return
    previousMode = null
    if (android.os.Build.VERSION.SDK_INT >= 31) {
      audio.clearCommunicationDevice()
      val device = previousDevice
      if (device != null && mode == android.media.AudioManager.MODE_IN_COMMUNICATION)
        audio.setCommunicationDevice(device)
      previousDevice = null
    } else {
      audio.isSpeakerphoneOn = previousSpeaker
    }
    audio.mode = mode
  }

  override fun invalidate() {
    stop()
    super.invalidate()
  }
}
`
  );
}

module.exports = (config) =>
  withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Expected Kotlin MainApplication.');
    mod.modResults.contents = configureInterviewAudio(mod.modResults.contents);
    return mod;
  });
