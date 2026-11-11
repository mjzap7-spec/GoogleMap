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

For reliable connectivity across those networks, provide a TURN relay. This implementation does not include or provision a relay. Self-hosting coturn requires a reachable server and bandwidth; managed services have their own plans. Do not advertise universal free calling without accounting for that infrastructure.

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
