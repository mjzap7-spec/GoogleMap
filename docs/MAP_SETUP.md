# OpenStreetMap map

The app uses OpenStreetMap data, free OpenFreeMap vector tiles, and MapLibre GL JS. No API key, account, credit card, or billing setup is needed. Google sign-in and Firebase authentication remain separate and unchanged.

From E:\GoogleMap\mobile run:

```powershell
npx expo start --clear
```

Open the existing installed app and reload. If its native WebView is missing, rebuild once:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npx expo prebuild --platform android --no-install
npx expo run:android
```

Web preview works with npx expo start --web. A network connection and WebGL-capable graphics are required. A failed load displays a retry action. Keep the visible OpenStreetMap/OpenMapTiles attribution; no bulk tile downloads or offline cache have been added.

The blue GPS marker shows your device location, and the blue line shows your travelled path. The map does not use the saved profile city. Until GPS is available, it displays a waiting/permission message.

## Travelled path tracking

With a completed profile and location permission, a new signed-in session starts recording automatically. The center toolbar button pauses or resumes the path. Clear path removes the recorded line and keeps the current GPS marker. The map centers on the first GPS fix and follows movement until a manual pan. Recenter restores following.

Recording continues across signed-in screens while the app is in the foreground. Backgrounding stops the GPS watcher. On return, an active recording starts a new segment and a manual pause remains in effect. The path stays in memory for the session. Explicitly starting trip sharing shares the route from that moment with the selected group.

The tracker requests updates after roughly 5 meters of movement (and a 3-second minimum interval on Android). It rejects readings older than 20 seconds, accuracy worse than 50 meters, invalid coordinates, repeated timestamps, and movements below 5 meters. Gaps over 30 seconds and implausible jumps start separate line segments. Up to 5,000 accepted points are kept per session; recording pauses at that limit until you clear and resume.

The expo-location native module was added. Rebuild once using the commands above; a JavaScript reload cannot install native GPS support. Grant **While using the app** location permission, preferably precise location. If location services are off or permission is denied, the profile map still works and the tracking panel explains how to retry.

For Android emulator testing, use Extended controls → Location to send positions or play a simulated route. A stationary emulator will not generate a travelled line. Use a real device for GPS accuracy and battery testing. Web location requires a secure browser context (HTTPS or localhost) and browser permission. No background location permission or paid API is used.

The map has dark styling, pinch/pan gestures, large animated zoom buttons, a recenter button, and a language picker (with local-name fallback). Camera animation respects reduced motion. Rapid taps retain the intended zoom target and duplicated Android bridge events are ignored.

The old Google Maps environment variables are no longer read. You do not need to complete the Google Cloud billing steps. Removing the Google Maps SDK from an already installed binary takes effect on the next native rebuild; the app no longer calls it after reloading this code.

Resources are pinned to MapLibre GL JS 5.13.0 on unpkg and the OpenFreeMap dark style. Only public map resources and the in-memory GPS path are used by the renderer; account credentials are not passed into the map document.

References: [OpenFreeMap](https://openfreemap.org/), [quick start](https://openfreemap.org/quick_start/), [MapLibre](https://maplibre.org/maplibre-gl-js/docs/).
