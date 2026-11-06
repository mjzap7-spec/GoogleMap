# Google Map mobile

An Expo / React Native app with a simple dark interface, Firebase authentication, profile registration, and MVVM architecture. Start with this file, then read [the architecture guide](docs/ARCHITECTURE.md) and [developer workflow](CONTRIBUTING.md).

## Run locally

Use **Node.js 24 LTS**. Expo SDK 58 does not support Node 25.

```powershell
cd E:\GoogleMap\mobile
npm ci
npx expo start --clear
```

Scan the QR code with a compatible Expo Go app, press **a** for an Android emulator, or press **w** for the browser. iOS simulators require macOS. Custom development builds must be rebuilt after native dependency or config-plugin changes.

The screens render without Firebase configuration. Authentication actions display a setup message until a project is configured.

### Reopen the two Android development apps

From the mobile directory, run this in one terminal. The launcher starts Pixel_8 and Pixel_8a if needed. Let it start Pixel_8a so it can use the alternate virtual Wi-Fi mode. If an already running Pixel_8a shows **AndroidWifi · Connection failure**, stop that device in Device Manager before running the command.

```powershell
npm run android:dev
```

This reuses this project's running Metro server on ports 8081–8090, or starts one on the first available port, and opens both apps on that same server. A busy server gets up to 15 seconds to respond before the launcher checks for an available port. Keep the Metro terminal open. It restores ADB forwarding and identifies devices by AVD name. App data is preserved; both emulators need the development app installed first and Android Wi-Fi connected for Firebase. No build is required. You do not need to start separate Expo terminals or select a port manually. The older `android:open` command remains available for separate servers on 8081/8082.

### Play a saved emulator route

Open **Map** and tap the center **Start recording** button. From the mobile directory, run `npm run android:route` to play a saved route on Pixel 8a. This reads the route stored by Android Emulator and delivers each GPS fix at its saved time. The app receives the fixes through its normal GPS subscription.

For the specific imported route, run `npm run android:route -- route_2026-11-02_08-12-58 Pixel_8a`. You can also pass a saved `route.json` path. To launch the apps and start playback from one terminal, use `npm run android:dev -- --route`. Tap **Pause** when you finish recording.

## Source map

```text
src/
  app/                     Thin Expo Router route files
  bootstrap/               Providers, dependency creation, root background setup
  navigation/              Route paths and authentication guards
  config/firebase/         Firebase client config and native/web persistence
  shared/
    mvvm/                  Framework-independent observable ViewModel base
    theme/                 Colors, navigation theme, dark browser surfaces
    ui/                    Reusable inputs, buttons, feedback, screen layout
    motion/                Page transitions, reduced-motion support, timing tokens
  features/auth/
    models/                Domain types, repository/picker contracts, validation
    data/                  Firebase repository and Expo avatar picker
      firebase/            Registration, session observer, SDK error translation
    viewmodels/            Form/session snapshots and commands
    bindings/              React subscriptions and ViewModel lifecycle
    screens/               Connect bindings, views, and navigation
    views/                 Separate SignIn, SignUp, ResetPassword, and Home views
      components/          Avatar, profile/credential fields, footer, form layout
```

| I want to change...                     | Start here                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in layout or wording               | [src/features/auth/views/SignInView.tsx](src/features/auth/views/SignInView.tsx)                                               |
| Sign-up layout or wording               | [src/features/auth/views/SignUpView.tsx](src/features/auth/views/SignUpView.tsx)                                               |
| Profile fields / avatar presentation    | [src/features/auth/views/ProfileView.tsx](src/features/auth/views/ProfileView.tsx) and `AvatarField.tsx`                       |
| Input, button, or overall spacing       | [src/shared/ui/](src/shared/ui/)                                                                                               |
| Dark colors                             | [src/shared/theme/colors.ts](src/shared/theme/colors.ts)                                                                       |
| Animation timing                        | [src/shared/motion/tokens.ts](src/shared/motion/tokens.ts)                                                                     |
| Form validation                         | [src/features/auth/models/validation.ts](src/features/auth/models/validation.ts)                                               |
| Submit behavior / loading / feedback    | [src/features/auth/viewmodels/AuthFormViewModel.ts](src/features/auth/viewmodels/AuthFormViewModel.ts)                         |
| Session restoration or sign-out         | [src/features/auth/viewmodels/SessionViewModel.ts](src/features/auth/viewmodels/SessionViewModel.ts)                           |
| Firebase profile saves / avatar cleanup | [src/features/auth/data/firebase/profile.ts](src/features/auth/data/firebase/profile.ts)                                       |
| Profile reads and SDK error translation | [src/features/auth/data/firebase/sessionObserver.ts](src/features/auth/data/firebase/sessionObserver.ts) and `errorMapping.ts` |
| Replace Firebase or photo selection     | [src/bootstrap/createAppDependencies.ts](src/bootstrap/createAppDependencies.ts)                                               |
| Route guards / paths                    | [src/navigation/](src/navigation/)                                                                                             |

## MVVM at a glance

Views render a snapshot and invoke a typed command interface. ViewModels are plain TypeScript classes that own state, validation/submission flow, and asynchronous commands. They depend on Model contracts, not Firebase or React. Data adapters implement those contracts. React bindings observe the ViewModels and clean them up; screens handle navigation. Bootstrap selects concrete dependencies once.

UI-only state, such as input focus and animation progress, stays in reusable UI components. Authentication state never lives in a View. ESLint enforces these import boundaries. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the dependency diagram and extension guide.

## Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a **Web app** in Project settings. Its Firebase JavaScript SDK config is also used on Android and iOS.
3. Copy `.env.example` to `.env` **only if you do not already have `.env`**, then fill in the Firebase client values.
4. Enable **Authentication → Email/Password**.
5. Create the default **Cloud Firestore** database and publish the supplied `firestore.rules`.
6. For avatar uploads, follow [Cloudinary Free setup](docs/CLOUDINARY_SETUP.md). Add the cloud name and unsigned upload preset to `.env`. Firebase Storage and Blaze are not required.
7. Restart Metro with `npx expo start --clear` after environment changes.

For browser testing, add `localhost` under Authentication → Settings → Authorized domains if needed. Use only Firebase **client** configuration in `EXPO_PUBLIC_` variables: they are bundled into the app. Never put service-account credentials there.

If you use the Firebase CLI, the rules can be published with:

```powershell
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Review and merge these starter rules with any existing project rules first. They allow owner-only profile creation/reads/updates/deletes; unrelated paths are denied. Avatar delivery is managed by Cloudinary. No cloud services, billing changes, or security-rule deployments are performed by local project checks.

## Google (Gmail) sign-up and sign-in

For Android Google testing, use `npm run android` to build/install/open **Google Map**. This command runs `expo run:android`; opening the project in Expo Go does not load the Google native module. If you use a separate Metro terminal, open the installed Google Map app from the emulator's app launcher.

Sign in and Create account include **Continue with Google**. Sign-up creates/authenticates the Firebase identity in the primary persisted session and opens Profile. Saving Profile opens Home, with no Sign in screen in between. After login, the app opens Home, which shows the interactive OpenStreetMap map, Map/Contacts tabs, and a bottom navigation shell. Sign out is available from the center menu. Profile editing is the protected /profile route used immediately after Create account. Existing Google accounts are never overwritten or deleted by registration. Google accounts do not need an app password.

1. In Firebase Authentication → Sign-in method, enable **Google**, choose a support email, and save. Web uses Firebase's popup; authorize your web domain (and `localhost` for local testing) under Authentication → Settings → Authorized domains.
2. In the same Google Cloud project, find the **Web application OAuth client ID**, and put it in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`. This is an OAuth client ID ending in `.apps.googleusercontent.com`, not the Firebase app ID or API key.
3. For Android, choose your app's `android.package` in `app.json`, register that exact Android application in Firebase, and register the development/release signing SHA-1 fingerprints. Ensure the Android OAuth client matches that package and certificate.
4. For iOS, choose `ios.bundleIdentifier` in `app.json`, register the same iOS app in Firebase, and add its iOS OAuth client ID as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.js` derives the reversed URL scheme and enables the native Google plugin when this value is present. App identifiers and OAuth credentials are project-specific; they are not invented by the app.
5. Restart Metro after editing environment values. Build a new native development app with `npx expo run:android` / `npx expo run:ios` or an EAS development build. **Google sign-in does not work in Expo Go**; email/password remains available there. iOS local builds require macOS.

Only basic Google identity is requested, with no Gmail inbox access. See [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/) and [native Google setup](https://react-native-google-signin.github.io/docs/setting-up/expo). The free native library uses the legacy Android Google Sign-In SDK; evaluate migration to Credential Manager before production. OAuth requires real client IDs, native signing/build configuration, and live device/browser verification; local tests do not contact Google.

## Password reset troubleshooting

The app awaits Firebase `sendPasswordResetEmail` using the primary Auth instance. Firebase's email enumeration protection may return success for an address without an account, without sending mail. The notice confirms a request, not inbox delivery; check Spam/Junk too.

After a successful request, switching away to Gmail/browser and returning to the reset screen takes the user to Sign in with the existing transition. Native uses a background-to-active event; web uses tab visibility. Failed requests do not enable this behavior. Returning does not confirm that the password was changed, so no password-change success message is shown. This requires no hosted return URL and does not automatically launch the app from Gmail.

If the email does not arrive, open the same Firebase project's **Authentication → Users** and confirm the address exists with the Email/Password provider. A failed registration may have rolled the account back. Confirm **Authentication → Sign-in method → Email/Password** is enabled. Under **Authentication → Templates → Password reset**, check the sender and action URL; a custom action URL must point to a working reset handler. Try the console's password reset action for that user to distinguish app behavior from project/email delivery issues. Check [Firebase email quotas](https://firebase.google.com/docs/auth/limits) if requests are being limited. Restart Metro after changing the app's Firebase environment configuration.

Do not disable enumeration protection or add a public account lookup to diagnose delivery. Local automated tests mock Firebase; real inbox delivery requires testing with the configured project and an existing account.

## Registration and profile behavior

Sign-up contains email/password/confirmation and Google authentication only. Registration establishes the primary persisted Auth session without writing a Firestore profile or uploading an avatar. Success opens Profile; a successful profile save opens Home. Failed profile saves remain on Profile. Successful login opens Home (interactive OpenStreetMap map) after the saved profile is checked; missing required profile fields open Profile instead. The profile editor remains available at the protected /profile route; Home has Map/Contacts tabs and placeholder bottom controls. Existing profiles load automatically, with Google name/photo as defaults for new Google users.

The profile editor requires full name, birthday, and a selected city before Save profile; avatar is optional (JPG/PNG/WebP up to 5 MB). Birthday opens the calendar. City suggestions begin after 3 characters and a 150 ms pause, with a bounded five-minute cache for repeated queries. The field label is Location. Selecting a result fills city, state/region, and country in that input only; the suggestion list and provider footer close, and no repeated state/country fields or info icon remain. Changing the query invalidates that selection. Ambiguous city names remain selectable rather than silently choosing the wrong city. Existing saved location strings remain usable. Failed/empty searches show guidance, and stale responses cannot overwrite a newer query. No GPS permission is requested. Saving an unchanged profile skips the backend write.

City autocomplete uses the Open-Meteo geocoding API (GeoNames data) with visible attribution. Only the typed city search is sent, not email, birthday, name, or GPS coordinates. The public API is for non-commercial use; before commercial deployment replace the injected CityRepository with a commercially licensed service or configure an appropriate backend. See [Open-Meteo API](https://open-meteo.com/en/docs/geocoding-api).

Profiles are stored in users/{uid} as { fullName, birthday, location, avatarUrl, createdAt }. The combined location label contains city/state/country. Saving uses a transaction to preserve createdAt on edits. Avatar uploads use Cloudinary unsigned image uploads; a failed profile write attempts cleanup of only its new upload when Cloudinary returned a temporary deletion token. The signed-in account and previous avatar files are retained. Passwords are never written to Firestore.

**Publish the updated firestore.rules before testing profile saves.** The rules allow only the authenticated owner to create/read/update/delete their profile. Cloudinary stores avatar files; Firebase Storage is no longer used. Profile updates preserve createdAt; unrelated paths remain denied. This code change does not deploy Firebase rules. Review existing project rules before publishing these files.

## Checks

On Windows, `plugins/withShortAndroidObjectPaths.js` sets `CMAKE_OBJECT_PATH_MAX=250` on the app's CMake build so generated C++ object paths are shortened before Ninja hits its filename-length limit. The plugin runs during Expo prebuild; the same setting must be present in an existing `android/app/build.gradle`. It does not change the Android package name, Firebase setup, or architecture. See [CMake object path limits](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html).

```powershell
npm run check
npx expo export --platform all
```

`check` runs formatting verification, ESLint, TypeScript, and local tests. `npm run format` applies formatting. Tests use injected fakes and mocked Firebase SDK calls; they never create real accounts or upload to a live project. The test runner clears only generated `.test-build` output before compiling tests.

Live Firebase sign-up, deployed security rules, device photo permissions, session restoration, and native transitions still need testing against your configured project/device. Existing dependency advisories are recorded in `dependency-audit.json`; review them before a production release.

References: [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/) · [Auth persistence](https://github.com/expo/fyi/blob/main/firebase-js-auth-setup.md).

## Cloudinary avatars

Follow [the complete Free plan setup](docs/CLOUDINARY_SETUP.md) to create an unsigned preset and set `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. No API secret belongs in the app. `CloudinaryAvatarStorage` implements the `AvatarStorage` model contract; bootstrap injects it into `FirebaseAuthRepository`. Uploads use HTTPS FormData and existing base64 picker data across Android/iOS/web, so no additional native dependency is needed. Only the final HTTPS URL is saved in Firestore. Existing avatar URLs remain supported.

## Persistent sign-in and Home

Firebase Auth owns ID tokens, refresh tokens, and session restoration. Android/iOS initialize Auth with AsyncStorage persistence; web explicitly uses IndexedDB with local-storage fallback. The primary default Auth instance is cached and shared by registration, sign-in, and restoration. The navigator waits for the first SDK session result before mounting auth routes, so returning signed-in users do not flash Sign in. Token events use onIdTokenChanged; unchanged users retain their profile listener. Sign-in success and normal signed-in app launch land at /, showing the interactive OpenStreetMap map with Map/Contacts tabs and Sign out in the center menu. /profile is separately protected. Invalidated/cleared sessions return to Sign in; the app never treats a custom local boolean as authentication.

To verify on a device, sign in once, close/force-stop Google Map, and reopen it without clearing app data or uninstalling. Home should appear after session restoration. Check the profile route separately when navigation UI is added. SDK/token-expiry/network and real device restoration still need live testing; local tests exercise startup gates, token events, listener lifecycle, and initialization reuse with mocked SDKs.

## Create account, Profile, and Home

Create account (email or Google) → authenticated Profile → Save profile → Home. Sign in (email or Google) or a restored session → load saved profile → Home when complete, or Profile when name/birthday/location is missing. Avatar is optional. No registration-success notice or redirect to Sign in remains. Registration does not depend on Firestore/Cloudinary until the user saves their profile. Google authentication may also sign in an existing Google user without overwriting their profile.

Profile loading is explicit: the Home route waits for Firestore rather than mistaking the initial Auth-only user for an empty profile. A missing cache entry waits for the server; profile read errors/timeouts preserve authentication and display an error rather than pretending the document is empty. Successful profile writes update session profile state before Home navigation, avoiding a redirect loop while the Firestore listener catches up.

## Contacts and nearby users

Home can show nearby users who opt in to GPS sharing, with avatar/name markers. Contacts supports email requests, in-app Agree/Disagree notifications, nickname-only editing, read-only peer profile details, contact deletion, and focusing a user's shared location on the map.

**Publish the new Firestore rules and indexes before testing.** See [social setup and two-account verification](docs/SOCIAL_SETUP.md). Sharing is off by default; no full travelled path is uploaded. Existing private name-only contacts remain supported as legacy records.

## Launch screen and profile loading

The display name is Google Map. The existing Android package and URL scheme are retained so Firebase/Google sign-in configuration continues to match. The native splash screen uses assets/brand/google-maps.png on the app dark background and fades as soon as the React navigator mounts, handing off to a branded loading view during Firebase restoration; no artificial splash delay is added. Rebuild after changing native branding: npx expo prebuild --platform android --no-install, then npx expo run:android. Verify the final splash appearance in a release build, since Expo development builds do not reproduce every launch-screen property.

Complete profiles are cached per Firebase UID for up to seven days, used only after Firebase authenticates that same UID, and refreshed by the existing Firestore listener. Invalid/incomplete/expired cache data is ignored. Cache failures never block network loading. Settings waits for valid profile data and offers Retry after a read failure instead of showing an editable empty form. Returning Home does not reload an already active Home screen.

## Map tab

The map uses OpenStreetMap data through free OpenFreeMap vector tiles and MapLibre GL. No API key, credit card, billing account, or registration is required. Android/iOS render the map in the existing WebView; web renders the same document in a sandboxed iframe.

The dark map keeps smooth gestures, animated large zoom/recenter buttons, and the device GPS marker with a travelled-path line. Language changes preserve the camera; local names appear when translations are unavailable. Reduced-motion settings are respected. Attribution remains visible. Internet and WebGL-capable graphics are required.

See [map setup](docs/MAP_SETUP.md) for running and troubleshooting.
