# Direct WebRTC file transfers

The chat attachment button stages a local file up to 100 MB above the composer. Picking a file does not create a message or start a network transfer. Remove it with ×, or tap Send to begin the private transfer in a one-to-one chat. It works for accepted contacts and private conversations between two joined group members. Group-room transfers are not supported.

Files receive automatically while the recipient keeps the private chat open. Image files show an inline preview on both devices; other files show their filename. Progress and Cancel remain available during transfer. Tap a received image or filename to save: Android opens a folder picker, and iOS opens its system share sheet. Completed copies remain in app-private storage and reappear when reopening the conversation. Removing app data or uninstalling removes these copies. Files are not uploaded for offline delivery.

## Cost and connection limits

The data channel first attempts available direct paths and uses the same authenticated TURN configuration as calls when needed (`EXPO_PUBLIC_CALL_ICE_ENDPOINT`). No new provider account or payment method is added. Relayed bytes count toward the existing Metered allowance; the free allowance is finite. Firestore signaling also counts toward the Firebase project quotas. File bytes are not stored in Firestore, Cloudinary, or the attachment Worker.

TURN improves connectivity across different networks, but exhausted relay quotas, blocked networks, or offline devices can still prevent delivery. Transfers are limited to 100 MB per file, one active file per conversation, and a 30-minute invitation/session window. This is not unlimited storage or guaranteed offline delivery.

## Set up both apps

The updated signaling rules were published to the existing `map-f9b98` project during implementation. Deploy again if you use another Firebase project or change the rules.

1. Use the same updated source on both computers and run `npm install` in `mobile`.
2. Both environments must point to the same Firebase project. Set `EXPO_PUBLIC_CALL_ICE_ENDPOINT` to the same working credential Worker URL used for calls on both devices. Keep relay secrets in the Worker, not in the app.
3. Deploy the updated rules once, from `mobile`: `npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID`. Sign in with `npx firebase-tools login` if necessary. The project ID is the value of `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, not an API key. Until rules are published, production invitations will be denied.
4. If either development build predates the file-picker/file-system/sharing dependencies, rebuild it with `npm run android`. Expo Go cannot run the native WebRTC module. Start Metro with `npx expo start --dev-client --clear` if it is not already running.
5. Sign in as two different users, accept the contact request, and open the same private chat on both devices. Keep the chat foregrounded throughout the transfer. Each emulator needs Internet access, including Firestore and the configured relay.

## Test with the other user's emulator

1. Make a 5–20 MB test file available in the sending emulator's Downloads folder (Android Studio Device Explorer or drag and drop onto the emulator).
2. Tap **+**, then select the file. Only the sender composer should show its draft filename or image preview. The recipient must see nothing yet. Tap Send and check that the file appears in both histories.
3. Keep the recipient chat open. Receipt should start automatically; both sides should show progress. An image preview should appear on the recipient only after all bytes are stored.
4. Tap the received image or filename, choose a folder on Android (or Save to Files in the iOS share sheet), and verify the saved contents or SHA-256 hash. Leave and reopen the chat: the preview and tap-to-save should still work.
5. Send another file and press Cancel during progress. A partial file must not offer a save action. Then send another file successfully and confirm the earlier completed file can still be saved.
6. Test the reverse direction, picker cancellation, losing connectivity, closing the chat, expired invitations, and files larger than 100 MB. The app must release partial files and let the sender try again.
7. An unrelated third account must not be able to read the transfer document or its network candidates. Removing contact/group access stops the active session through context listeners.

## Architecture and privacy

- `models/directTransfer.ts`: transfer contracts and invitation format `[[direct-file:v1]]<id>`.
- `viewmodels/DirectTransfersViewModel.ts`: automatic receipt, persistent local copies, lifecycle, progress, cancellation, save, and cleanup. Only the sender writes Completed after receiving the recipient's final acknowledgement.
- `data/firebase/FirebaseTransferRepository.ts`: atomically creates a private invitation and chat message; exchanges SDP and ICE candidates through `fileTransfers/{id}`. Transactions prevent accepting an already accepted or finished invitation. No file bytes are stored here.
- `data/webrtc/FileDataChannel.ts`: reliable, ordered, DTLS-encrypted data channel, 16 KB chunks, 256 KB acknowledgement window, throttled progress, and a 30-second inactivity timeout once connection setup starts. Acknowledgements follow successful recipient writes.
- `shared/platform/directFile.native.ts`: native disk reads/writes and the system save sheet. Native file transfers do not load the entire file into JavaScript memory. The browser adapter buffers up to the 100 MB limit before downloading.
- `views/DirectTransferCard.tsx`: inline image previews or filenames, tap-to-save, progress, and cancellation. Chat previews and replies show readable invitation text rather than signaling IDs.
- `firestore.rules`: only the two participants can read signaling. Accepted chat membership is checked when creating/accepting invitations and adding candidates. File size, SDP, candidate count, expiration, and status transitions are bounded. Only the recipient can accept/decline; only the sender can confirm completion. Terminal history cannot be rewritten.

The connection is private to the authenticated chat participants, with no public download URL. Direct peers can learn each other's network address through WebRTC. File metadata and connection details are visible to the Firebase project administrators; recipients can retain or forward a saved copy. This feature does not add client-side encryption to Firestore metadata.

## Automated verification

`tests/direct-file-transfer.test.cjs` checks byte-for-byte transfer, bounded buffers, configured relay propagation, automatic receipt, local restoration, saving only after completion, cancellation, late picker cleanup, and stalled connections. The Firestore emulator tests check unrelated-user denial, size limits, acceptance/completion permissions, immutable candidates, and departed group members. These tests do not replace the two-device network and system save-sheet checks above.
