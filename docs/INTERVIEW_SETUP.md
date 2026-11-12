# In-app interview calls

The camera button in an individual chat opens **Voice interview** or **Video interview**. Accepted contacts and joined group members can call one another privately. This is a one-to-one feature, not a group conference. Incoming calls appear over any signed-in screen. Accept explicitly starts microphone/camera access; Decline does not access either device.

## Activate

1. Publish the rules and incoming-call index from the `mobile` directory:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project map-f9b98
   ```

   `map-f9b98` is this checkout's configured Firebase project. For another environment, replace it with that environment's project ID. Wait until the `interviewCalls` composite index is ready.

2. The WebRTC module is native, so reload alone is insufficient. Rebuild the **development app**, keeping installed account data:

   ```powershell
   cd E:\GoogleMap\mobile
   npx expo prebuild --platform android --no-install
   npx expo run:android --device
   ```

   Select the first emulator, then repeat the last command for the second. These commands install a debug/development application; they do not create a release for distribution. Expo Go cannot run these calls. iOS also needs a new development build on a supported Mac or EAS setup. Camera and microphone permissions are configured through the WebRTC Expo plugin.

3. Start the usual shared development server using `npm run android:dev`. Sign in as different test users and open a private conversation.

## Network setup

Without additional configuration, the app uses Google's public STUN server and a direct, encrypted WebRTC connection. This requires no new account, credit card, or paid calling SDK. Firebase signaling reads/writes still count toward the project's existing quotas. Direct calls can work on a local network but **are not guaranteed across mobile networks, VPNs, or restrictive firewalls**.

For calls across those networks, configure a TURN relay. The repository includes a credential Worker for Metered Open Relay and Cloudflare Realtime TURN. The Worker checks Firebase sign-in before returning relay credentials.

### Set up Metered Open Relay for two emulators

1. Create a free [Metered account](https://dashboard.metered.ca/signup). In the TURN dashboard, create a test app and select **Free Trial · Global** if prompted. The test workspace showed 500 MB at $0 per month and indicated that service pauses at the quota. Confirm the allowance on your dashboard and leave auto-reload off. If signup requires a payment method, stop there.
2. Generate a test TURN credential. From its row choose **Get credential → Show API Key**. Copy the credential API key and the app subdomain from its API example. For `https://example.metered.live`, enter only `example` as the app name. Allow up to two minutes for a new credential to propagate. [Metered credential API](https://www.metered.ca/docs/turn-rest-api/get-credential/)
3. Deploy only the credential Worker on Cloudflare **Workers Free**. This setup does not use the Cloudflare Realtime product. If Wrangler asks for a `workers.dev` subdomain, register one in your Cloudflare account. Enter the existing app's `EXPO_PUBLIC_FIREBASE_API_KEY` at the Firebase prompt, then the Metered subdomain and credential API key at their respective prompts.

   ```powershell
   cd E:\GoogleMap\mobile\services\turn-credentials
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put FIREBASE_API_KEY
   npx wrangler secret put METERED_APP_NAME
   npx wrangler secret put METERED_TURN_API_KEY
   ```

4. Append `/ice` to the printed Worker URL. Opening it in a browser should return HTTP 401 with `Firebase sign-in required`. This verifies the route. A signed-in call verifies Metered credentials.
5. Put the full URL in `EXPO_PUBLIC_CALL_ICE_ENDPOINT` in both app checkouts. Restart each Metro server with `npx expo start --dev-client --clear` and reload the development app. If the other user runs a standalone APK, give them an APK built with the URL configured. Share only the Worker URL with your teammate.
6. Use separate accounts in the same Firebase project and an accepted contact relationship. Test from different networks with both apps open. Measure from **Accept** until both sides can hear each other. Repeat with video and verify both video feeds. After each hang-up, reopen both chat histories and verify the call entry persists.

Metered uses the test credential you generated. Revoke it in the Metered dashboard when testing is over, or generate a replacement and update `METERED_TURN_API_KEY` to rotate it.

### Deploy Cloudflare TURN for Android and iOS

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Realtime** and create a **TURN key**. Keep its key ID and API token available for the next step. See [Cloudflare's TURN setup](https://developers.cloudflare.com/realtime/turn/generate-credentials/) and [pricing FAQ](https://developers.cloudflare.com/realtime/turn/faq/).
2. In PowerShell, deploy the credential Worker and enter each value at the corresponding secret prompt. For `FIREBASE_API_KEY`, use the value of `EXPO_PUBLIC_FIREBASE_API_KEY` from this app's Firebase project.

   ```powershell
   cd E:\GoogleMap\mobile\services\turn-credentials
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put FIREBASE_API_KEY
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_KEY_API_TOKEN
   ```

3. Copy the Worker URL printed by Wrangler, append `/ice`, and add it to `mobile/.env` for both development setups. Use the same Worker URL on both sides.

   ```dotenv
   EXPO_PUBLIC_CALL_ICE_ENDPOINT=https://googlemap-turn-credentials.YOUR-SUBDOMAIN.workers.dev/ice
   ```

4. Restart Metro with `npx expo start --dev-client --clear` and reload both development apps. For a standalone APK, build and distribute a new APK with the endpoint in the build environment.
5. Place one voice call and one video call across two networks with test accounts. Measure from Accept until both sides can hear each other, then hang up and check the call entries in both chat histories. A request to `/ice` without an Authorization header should return HTTP 401. That check confirms the route is reachable. The signed-in calls verify credential issuance and media connectivity.

The bundled Worker supports native apps. If you deploy the app on the web, configure a credential endpoint that supports your web origin.

### Use an existing credential endpoint

Set `EXPO_PUBLIC_CALL_ICE_ENDPOINT` to an HTTPS endpoint you control. The client sends `Authorization: Bearer <Firebase ID token>`. The endpoint must validate this token, rate-limit issuance, and return short-lived relay credentials, for example:

```json
{
  "iceServers": [
    { "urls": "stun:stun.example.com:3478" },
    {
      "urls": [
        "turn:relay.example.com:3478?transport=udp",
        "turns:relay.example.com:5349?transport=tcp"
      ],
      "username": "temporary-user",
      "credential": "temporary-password"
    }
  ]
}
```

Web builds also require that endpoint to allow the app's origin and Authorization header via CORS. Permanent TURN secrets belong on the server. Never put them in `.env` values prefixed with `EXPO_PUBLIC`. Credentials are held only for the current media session. An invalid or unreachable configured endpoint fails visibly rather than silently bypassing the chosen configuration.

## Behavior and resource use

- Both participants must keep the app open. Backgrounding, signing out, navigating away from the application, or stopping the provider ends capture. Moving between app screens keeps the same account-scoped invitation listener.
- No background ringing, push calls, CallKit, or Android ConnectionService is implemented. An invitation expires after 60 seconds. The connection attempt is limited to 30 seconds, disconnected media to 10 seconds, and a call to two hours.
- The WebRTC runtime loads on Start or Accept. Voice requests audio only. Video initially requests 640×480 at 24 fps. Tracks, native streams, connections, listeners and timers are released on every terminal path, including late permission responses.
- Audio/video is neither recorded nor stored in Firestore. The app uses the device's default audio route. Bluetooth and speaker routing should be verified on physical devices before release.
- A call handled on another device closes the obsolete prompt without ending the other device's call. Declined or dismissed calls do not reopen in the current session; cached ringing snapshots are ignored.
- Leaving the shared group or losing the accepted contact relationship terminates the active call when the context change reaches the client.

## Database and MVVM

`interviewCalls/{callId}` stores participants, the authorized chat context, caller display identity, mode, status, SDP offer/answer and deadlines. `candidates/{uid}_{index}` contains at most 64 immutable ICE candidates per participant. Composite index: `toId ASC, status ASC, createdAt DESC`.

Only participants may read a call. Only an authorized contact or joined group member can create it, and only its recipient may accept or decline it. Rules validate state transitions, deadlines, identity and payload size. They deny strangers, expired answers, replayed terminal calls and forged candidates.

`InterviewViewModel` owns the state machine and lifetime. `InterviewRepository` and `CallMedia` are model ports. `FirebaseInterviewRepository` handles signaling and revocation; `DeviceCallMedia` selects native or browser capture. `PeerCallMedia` owns the peer connection. The account-scoped binding and screen connect those ports to presentational views. Views never call Firebase.

Candidate deletion is best effort on termination. Call documents retain signaling metadata, including SDP; no server cleanup job or TTL is installed. Before production, configure a retention policy and a server cleanup job that also removes candidate subcollections. Firestore TTL on the parent alone does not delete subcollections. Rules prevent expired sessions from accepting or sending new signaling even if cleanup is delayed.

## Verification checklist

Use synthetic accounts on the local Firebase emulator for rules tests; do not call real contacts as a test without their agreement.

1. Open both development apps. Start voice from one and confirm an incoming prompt on the other; accepting connects, declining never activates its microphone.
2. Start video, allow permissions, verify both video feeds, mute, camera off/on, camera switch, and hang up from each side.
3. Deny permission, cancel during permission acquisition, leave an invitation unanswered, disconnect a device and background a connected call. Capture must stop and reopening must not replay the prompt.
4. Confirm an outsider cannot read signaling, an unjoined group invitee cannot call, and a removed group member cannot answer.
5. Emulators can compete for the PC microphone/camera. Test final audio, echo cancellation, routing and camera switching using two physical devices. A TURN-enabled cross-network test is required for production reliability.

Automated commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run test:rules`.

References: [React Native WebRTC](https://react-native-webrtc.github.io/handbook/guides/getting-a-call-connected.html), [connection reliability](https://react-native-webrtc.github.io/handbook/guides/improving-call-reliability.html).
