# Direct WebRTC file transfers

The chat attachment button opens the file picker for direct transfers up to 100 MB in one-to-one chats. It works for accepted contacts and private conversations between two joined group members. Group-room transfers are not supported.

The recipient sees an invitation with the file name and size, and chooses **Accept** or **Decline**. Both sides see progress and **Cancel** while transferring. After all bytes have been written, the recipient sees **Save file**. Android/iOS opens the system share/save sheet; choose a file manager or save destination. **Dismiss** removes the temporary received copy. Save before leaving the conversation, because received files are not uploaded or retained for later download. Dismissing the system sheet keeps Save available so it can be tried again.

## Cost and connection limits

This mode uses STUN-only WebRTC data channels. It does not use the call TURN endpoint, Metered traffic, Cloudinary, Cloudflare file storage, or Firebase Storage. No new provider account, API key, payment method, or paid relay is needed. Firebase Authentication and Firestore still handle authenticated signaling and remain subject to the existing project's quotas and plan. Ordinary Internet/data charges can still apply.

Direct connections are not guaranteed across restrictive firewalls or NATs. When no direct path exists, the app reports a connection failure rather than silently switching to a paid relay. Try both devices on the same Wi-Fi, or use physical Android phones. Transfers are limited to 100 MB per file, one active file per conversation, and a 30-minute invitation/session window. This is not unlimited storage or guaranteed delivery while offline.

## Set up both apps

The updated signaling rules were published to the existing `map-f9b98` project during implementation. Deploy again if you use another Firebase project or change the rules.

1. Use the same updated source on both computers and run `npm install` in `mobile`.
2. Both environments must point to the same Firebase project. No extra environment variables are required for direct transfers.
3. Deploy the updated rules once, from `mobile`: `npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID`. Sign in with `npx firebase-tools login` if necessary. The project ID is the value of `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, not an API key. Until rules are published, production invitations will be denied.
4. If either development build predates the file-picker/file-system/sharing dependencies, rebuild it with `npm run android`. Expo Go cannot run the native WebRTC module. Start Metro with `npx expo start --dev-client --clear` if it is not already running.
5. Sign in as two different users, accept the contact request, and open the same private chat on both devices. Keep the chat foregrounded throughout the transfer. Each emulator needs Internet access, including Firestore and STUN connectivity.

## Test with the other user's emulator

1. Make a 5–20 MB test file available in the sending emulator's Downloads folder (Android Studio Device Explorer or drag and drop onto the emulator).
2. Tap **+**, then select the file. Check that the recipient sees its name and size.
3. Before accepting, confirm no file data is received. Tap **Accept** on the other emulator. Both sides should show progress.
4. After completion, tap **Save file** on the recipient and select a save destination. Compare the saved file's size and contents, or its SHA-256 hash, with the original.
5. Send another file and press **Decline**. Both histories should show the declined result. Repeat and press **Cancel** during progress. No Save action should be offered for the partial file.
6. Test the reverse direction, picker cancellation, losing connectivity, closing the chat, expired invitations, and files larger than 100 MB. The app must release partial files and let the sender try again.
7. An unrelated third account must not be able to read the transfer document or its network candidates. Removing contact/group access stops the active session through context listeners.

## Architecture and privacy

- `models/directTransfer.ts`: transfer contracts and invitation format `[[direct-file:v1]]<id>`.
- `viewmodels/DirectTransfersViewModel.ts`: consent, lifecycle, progress, cancellation, save, and cleanup. Only the sender writes Completed after receiving the recipient's final acknowledgement.
- `data/firebase/FirebaseTransferRepository.ts`: atomically creates a private invitation and chat message; exchanges SDP and ICE candidates through `fileTransfers/{id}`. Transactions prevent accepting an already accepted or finished invitation. No file bytes are stored here.
- `data/webrtc/FileDataChannel.ts`: reliable, ordered, DTLS-encrypted data channel, 16 KB chunks, 256 KB acknowledgement window, throttled progress, and a 30-second inactivity timeout once connection setup starts. Acknowledgements follow successful recipient writes.
- `shared/platform/directFile.native.ts`: native disk reads/writes and the system save sheet. Native file transfers do not load the entire file into JavaScript memory. The browser adapter buffers up to the 100 MB limit before downloading.
- `views/DirectTransferCard.tsx`: inline invitation, progress, and controls. Chat previews and replies show readable invitation text rather than signaling IDs.
- `firestore.rules`: only the two participants can read signaling. Accepted chat membership is checked when creating/accepting invitations and adding candidates. File size, SDP, candidate count, expiration, and status transitions are bounded. Only the recipient can accept/decline; only the sender can confirm completion. Terminal history cannot be rewritten.

The connection is private to the authenticated chat participants, with no public download URL. Direct peers can learn each other's network address through WebRTC. File metadata and connection details are visible to the Firebase project administrators; recipients can retain or forward a saved copy. This feature does not add client-side encryption to Firestore metadata.

## Automated verification

`tests/direct-file-transfer.test.cjs` checks byte-for-byte transfer, bounded buffers, no TURN configuration, consent, saving only after completion, cancellation, late picker cleanup, and stalled connections. The Firestore emulator tests check unrelated-user denial, size limits, acceptance/completion permissions, immutable candidates, and departed group members. These tests do not replace the two-device network and system save-sheet checks above.
