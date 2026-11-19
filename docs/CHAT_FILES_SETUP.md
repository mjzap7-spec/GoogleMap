# Private chat files

The small-file upload option has been removed from the chat composer. Tap **+** to select a direct WebRTC file instead. Existing uploaded-file messages can still be downloaded. The following describes the legacy upload service.

Previously, the chat composer offered two file modes. **Send directly** transfers up to 100 MB privately using WebRTC while both people keep the chat open; see [Direct file transfers](DIRECT_FILE_TRANSFERS.md). **Upload small file** supports files up to 1 MB with later download. The attachment Worker stores these small file bytes in Workers KV for seven days. Each upload and download verifies a Firebase ID token and current access to the original chat. Group private attachments are restricted to the uploader and the selected recipient. Group-room files are available to current group members.

Cloudflare Workers and KV have free usage allowances. On the Workers Free plan, KV includes 1 GB of storage, 100,000 reads per day, and 1,000 writes per day. Exceeding a free allowance can make transfers fail. The app limits individual file size to 1 MB. Review the account's active plan and KV dashboard before larger-scale use.

## Existing deployment

The configured Worker is at `https://googlemap-chat-files.googlemap-interview-test.workers.dev`. Set `EXPO_PUBLIC_CHAT_FILES_ENDPOINT` to this base URL in both app environments. Provider credentials belong in Worker secrets.

The Worker configuration includes the KV namespace ID for this account. For a different Cloudflare account, create a namespace with `npx wrangler kv namespace create FILES` and replace its ID before deploying.

From `services/chat-files`, run `npx wrangler deploy`. Set `FIREBASE_API_KEY` and `FIREBASE_PROJECT_ID` through `npx wrangler secret put`. Use the same Firebase project as the two apps.

## Rebuild and test

1. Install dependencies, run `npx expo prebuild --platform android --no-install`, and rebuild with `npm run android`. File picking and saving use native Expo modules.
2. Sign in on both devices with different users and open an accepted direct chat or private group member chat.
3. Tap the plus button, choose **Upload small file**, select a small test file, and wait for its chat entry. Tap the entry on the other device to download and save or share it.
4. Cancel the picker and verify no message is sent. Tap outside the emoji picker and confirm it closes.
5. Remove chat access and confirm the file can no longer be downloaded. Verify that an unrelated account is denied.

KV changes can take time to propagate to another region. A recipient may need to retry an attachment that has just been uploaded. File expiry is shown in the composer. Saving a downloaded copy creates a separate file managed by the recipient.

## Protocol

- POST `/files` accepts raw bytes with a Firebase Bearer token and a JSON `X-Chat-Context` header.
- GET `/files/{id}` authenticates the user and checks current chat access before returning bytes.
- DELETE `/files/{id}` requires the original uploader and current chat access.
- Messages store attachment metadata with a `[[file:v1]]` prefix. Existing text and call messages retain their formats.

The browser download adapter is included. The current native Worker has no CORS configuration, so browser attachment requests need a deployment that explicitly allows the web app origin.

References

- [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
