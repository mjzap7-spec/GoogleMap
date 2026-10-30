# Nest mobile

React Native + Expo + TypeScript app with Firebase email/password sign-in, sign-up, password reset, persisted sessions, and a signed-in screen with sign-out.

## Run

Use Node.js 24 LTS (the generated Expo SDK does not support Node 25).

```powershell
cd E:\GoogleMap\mobile
npm install
npm start
```

Scan the QR code with a compatible Expo Go app on Android or iOS. Alternatively, run `npm run android` with an Android emulator, or `npm run web` for a browser preview. iOS simulators require macOS. The screens work without Firebase configuration; authentication explains the required setup until configured.

## Create your Firebase project

1. Open https://console.firebase.google.com/ and choose **Create a project**. Google Analytics is optional for this app.
2. In Project settings → General → Your apps, register a **Web app** using the `</>` button. The Firebase JavaScript SDK uses this configuration on Android and iOS too; Hosting is optional.
3. Copy `.env.example` to `.env` in this directory and paste the matching values from your Firebase web app configuration:

```powershell
Copy-Item .env.example .env
```

4. In Firebase → Authentication → Get started → Sign-in method, enable **Email/Password**.
5. Restart Expo with `npx expo start --clear` after changing `.env`.

For browser testing, add your local hostname (usually `localhost`) under Authentication → Settings → Authorized domains if needed. No service-account key, billing account, Firestore database, or native Firebase config file is required for this authentication flow. EXPO_PUBLIC values are bundled into the app: use the Firebase client config only, never private service-account credentials.

## Validation

TypeScript checking and Android, iOS, and web bundle exports were verified during implementation. Live authentication and device session restoration require your Firebase configuration and remain to be tested. The generated dependency tree reports 12 npm audit advisories (7 high, 5 low); see `dependency-audit.json`. Review these before production release; the audit's suggested Expo/Firebase downgrades conflict with the current SDK requirements.

```powershell
npx tsc --noEmit
npx expo export --platform all
```

After connecting your Firebase project, test on a device:

- Create an account; confirm it appears under Firebase Authentication → Users.
- Close and reopen the app; confirm the signed-in session is restored.
- Sign out, then sign in again with the same credentials.
- Test invalid email, mismatched passwords, incorrect credentials, and network errors.
- Send a password reset email, complete the reset, and sign in with the new password.

Native sessions use AsyncStorage through Firebase's React Native persistence. Browser sessions use Firebase's browser persistence. Passwords are passed to Firebase and cleared from form state after successful authentication. No protected backend or database is included; add Firebase Security Rules when adding data services.

References: [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/) · [Expo auth persistence](https://github.com/expo/fyi/blob/main/firebase-js-auth-setup.md).
