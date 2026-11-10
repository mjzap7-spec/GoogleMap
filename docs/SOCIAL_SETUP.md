# Nearby users and contact requests

## Activate the backend

These changes add Firestore rules and indexes. Until they are published, the new requests, location sharing, and peer profile reads will fail with setup messages. Use the Firebase project configured in mobile/.env, not the separate Google Maps project.

From mobile, using your authenticated Firebase CLI:

```powershell
firebase deploy --only "firestore:rules,firestore:indexes" --project YOUR_FIREBASE_PROJECT_ID
```

Replace YOUR_FIREBASE_PROJECT_ID with your Firebase project ID. If you have not authenticated the CLI, run firebase login yourself first. Wait for the indexes to finish building in Firebase Console → Firestore Database → Indexes. The collections are created automatically by the app; do not create sample users or public profile documents manually.

This implementation uses Firebase Authentication and standard Firestore operations. It does not require Cloud Functions, Google Maps APIs, or a Blaze upgrade. Firestore's Spark quotas still apply; location sharing is not unlimited storage or bandwidth.

Reload the updated app. No native dependency was added for this feature; it uses the GPS support already installed. Both test accounts must open this updated app at least once with a completed profile so their email lookup records are registered.

## Nearby users

Home has a Show people switch, off by default. It controls discovery for the viewer. People appear nearby when their sharing audience permits nearby visibility, their profile is complete, and the foreground app has GPS permission. They can share while viewing Contacts, Settings, or Help. A saved contact nickname takes precedence over the profile name on your map.

Nearby discovery uses geohash ranges covering about 1 km, filters geographic false positives, excludes yourself, and bounds each query to 200 results and keeps up to 400 nearest loaded users. It refreshes the query center after roughly 250 m of movement. Profile birthdays and emails are not published to nearby markers.

Shared-location writes are throttled while moving and refreshed every 30 seconds while the signed-in app is active. Pausing path recording keeps live GPS and publishing active. Turning Show people off clears peer markers and stops discovery queries; it does not stop publishing the user's own position. Publishing pauses when the app goes to the background, GPS becomes unavailable, or the user signs out. Deletion is queued after any in-flight publish, so a late write cannot undo removal. Sudden disconnection or force-quit cannot guarantee immediate deletion: security rules make old records unreadable after their short lease expires, at most about four minutes from publication.

Failed nearby listeners reconnect automatically with a 2–30 second backoff, including within the same lease bucket. Nearby unavailable · Retry appears if discovery or publishing fails; the feedback message explains the failure. Retry restarts only nearby discovery and republishes the current GPS fix. Results are combined after all geohash ranges respond, so an empty successful range cannot hide another range's error. Both users must have live GPS within 1 km; an emulator's simulated location can differ from the computer's location.

Restoring an old emulator snapshot or running overloaded emulators can leave device clocks minutes or hours behind. Nearby discovery synchronizes with Firebase time using the issued-at time of a freshly refreshed ID token, deduplicates concurrent synchronization, and resynchronizes during sharing. Queries and published lease buckets use server time. Marker deadlines are converted back to device time so the renderer and ViewModel still expire them correctly. Tokens are not logged or stored by this clock. Freshness rules remain unchanged. If synchronization cannot reach Firebase, the app shows a connection error instead of publishing with an incorrect device clock.

The existing travelled path stays on your device in memory. Only the latest shared GPS point is published; the full travelled path is not uploaded.

## Contacts

Contacts → New contact opens a modal with an email field and Send request button. The address is normalized. Self-requests, duplicate pending requests, existing contacts, and simultaneous reverse requests are rejected. Resending a prior request has a one-minute cooldown.

The recipient receives an in-app request notification showing the sender's profile name and email, with Agree and Disagree. Request listeners and dialogs remain mounted across signed-in screens. Requests are also available from the envelope button and Contacts → Notifications. These are in-app notifications; no phone push is sent when the app is closed. Pending requests appear on the next app session.

Agree atomically records acceptance and adds both users to each other's contacts. This shares their name, email, birthday, and profile location with each other. Disagree adds no contact and grants no profile access.

Each contact row shows its private nickname and an Edit button. Clicking the nickname centers the map on that user's fresh shared GPS position, including if they are outside the nearby radius. If they are not sharing, the app explains that their location is unavailable. It does not substitute their profile city. Edit opens the protected contact screen: the nickname can be changed; name, email, birthday, and profile location are read-only. Save changes only your nickname for the user. Delete removes both contact links and revokes both users' future private profile access.

Existing name-only contacts remain private legacy records. They can be renamed or deleted but have no linked account or GPS location. Send a real email request to connect to that person.

## Data and permissions

- users/{uid}: private profile; readable by its owner and mutually accepted contacts, writable only by its owner.
- users/{uid}/private/phone: optional phone number, readable and writable only by its owner. It is never copied to contact, group, chat, or map documents. Publish the updated rules before saving a phone number; leaving it blank on first setup does not create this document.
- users/{uid}/contacts/{peerId}: nickname and relationship metadata. New linked contacts can only be created by the recipient as part of atomic acceptance; updates change only the owner's nickname; removal requires both links to be removed.
- contactDirectory/{normalizedEmail}: exact email lookup containing UID, display name, and avatar. Authenticated direct lookups are allowed; directory scans are denied.
- contactRequests/{senderUid}_{recipientUid}: participants-only request, with the sender's Auth email and profile name validated by rules. Acceptance requires both contacts in the same transaction.
- sharedLocations/{uid}: opt-in public-in-app position, avatar, nickname, geohash, lease bucket, and server timestamp. Only the owner writes it. Reads require authentication, a fresh lease, and bounded queries.

Map avatar requests address a fresh, visible user by UID. The recipient email stays empty while pending and is filled from the recipient’s authenticated account on acceptance. Private profiles remain protected until both contact links exist.

The toolbar order is Home, Contacts, Start/Pause recording, Settings, Help. Tapping a contact focuses its fresh, already-loaded position immediately, or fetches its current position if needed. Selecting the same contact again centers it again. Edit changes only the private nickname. Existing contacts show no request button in the map user card.

New users must use the updated app. There is no Admin SDK credential, private key, background GPS service, or custom server in the client.

## Two-account verification

1. Publish rules and indexes; use two different signed-in app instances (two emulators, or an emulator and a phone).
2. Complete both profiles and open Home. Enable precise device GPS. Use nearby simulated coordinates when testing with emulators.
3. Turn on Show people only on A. A's map should show B's avatar and name even while B's switch is off. Enable it on B to see A as well. Move B to Settings or Help and verify A still sees B; background B's app and verify its presence is removed or expires.
4. Tap B’s avatar on A’s map and send a request from the user card, or request B’s email from New contact. B should see A's name/email in Contact requests. Disagree once and check that no contact is added; wait a minute before sending again.
5. Accept the next request. Both dropdowns should list the other user. Rename A's private nickname for B and verify B's account/profile is unchanged.
6. Select B's nickname and verify the map centers on B's shared position. Stop B's sharing, then select again and verify the unavailable-location message.
7. Delete a contact and confirm both links disappear and profile details can no longer be fetched.

## Firestore connection timeout on Android/iOS

The native app initializes Firestore with long polling and a five-second poll timeout before starting profile, contact, or location listeners. Web keeps the default browser transport. Some emulator networks and Expo's native network inspector buffer responses until they close; the shorter poll timeout lets those responses complete before Firestore's ten-second initial connection deadline.

Android development builds also bypass Expo's response-body inspector specifically for `firestore.googleapis.com`, so its WebChannel streams can be consumed immediately. Other hosts retain inspection, and release builds do not install this hook. The `withFirestoreStreaming` config plugin preserves it through prebuild. Rebuild/reinstall the development app when this native hook changes. The development console logs `[Firebase] Profile server connection ready` once a server-backed profile snapshot arrives; it contains no profile data or credentials.

After changing this configuration, fully reload the development app on both emulators (Expo terminal → r, or emulator developer menu → Reload). Fast Refresh alone can retain a Firestore instance with its old settings. No native rebuild is required. The existing standalone APK does not receive source changes from Metro.

If the connection timeout continues after a full reload, check internet access inside the emulator, not just on the PC. Open a website in the emulator's browser and verify that its date/time is correct. A blocked or disconnected network must be restored before Firestore can load live users.

## Automated checks

```powershell
npm run check
```

Local security integration tests use only demo-google-map-social and localhost:8085, never your production Firebase project. They require Firebase CLI and Java 21+. On this Windows setup Android Studio supplies Java 21:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run test:rules
```

Rules tests verify identity validation, request privacy, atomic acceptance, read-only peer profiles, nickname-only edits, mutual revocation, and expiration/bounds of public location queries. Unit tests cover late results after disposal, request duplicate protection, sharing revocation during a pending write, and safe marker rendering. Live two-device behavior still needs verification after backend activation.

## Contact change notifications

Accepting or declining a request and removing a mutual contact atomically create a private notification for the other user in `users/{uid}/contactEvents`. Notifications appear in the contact inbox on any authenticated screen, including after reopening the app, and remain until dismissed. The inbox badge includes both incoming requests and contact changes. No phone push notifications are sent. Existing changes made before this feature was installed are not reconstructed.

Publish `firestore.rules` before using the updated clients. No additional composite index or native rebuild is required. Rules permit event creation only alongside the matching acceptance or mutual removal, and only the recipient can read or dismiss an event. Older app builds do not produce these events; update both clients for two-user testing.

## Private groups and trip sharing

In Contacts → Private groups, signed-in users see group names as they are created and can join or rejoin. A group has 10 places, including outstanding invitations. Joining gives access to group messages and live locations. Location publishing still requires the user's sharing preference or an active trip.

| Firestore path                                                          | Purpose and access                                                                                                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupDirectory/{groupId}`                                              | Signed-in users can see the name, creator display name at creation, server creation time and joined-member count. Membership and count update atomically. Retired IDs cannot be reused. |
| `privateGroups/{groupId}`                                               | Owner, invitations and joined IDs. Only invited/joined users can read this document. Self-join adds only the caller.                                                                    |
| `privateGroups/{groupId}/messages/{id}`                                 | Immutable, server-timestamped messages. Only joined members can read or send.                                                                                                           |
| `privateGroups/{groupId}/live/{uid}`                                    | Member locations and trips. Leaving removes the member’s location.                                                                                                                      |
| `users/{uid}/formerGroups/{groupId}`                                    | Personal leave history. Rejoining clears the entry.                                                                                                                                     |
| `contactRequests/{id}/messages/{id}` and `users/{uid}/chatInbox/{peer}` | Direct conversations and per-user previews. Sending requires an accepted mutual contact.                                                                                                |
| `users/{uid}/chatReads/{threadKey}`                                     | Private read position for a conversation. Only the account owner can advance it, using a confirmed message timestamp.                                                                   |

Unread badges count incoming messages newer than the account’s read position in each accessible chat. The toolbar combines distinct conversations; sender avatars show their chat’s count. Badges display **99+** above 99. Opening the chat list preserves these counts. Viewing messages advances the visible conversation’s read position across the user’s devices. Conversations from before read tracking have no saved position until opened. The unread listener uses the `messages` collection index on `createdAt` and `fromId` in ascending order.

Outgoing messages show **one check** once Firestore confirms the write and **two checks** when another participant has read through that message. Pending writes keep “Sending…”. In group chats, two checks mean at least one other member has read the message. Read positions use confirmed Firestore timestamps, including nanoseconds; merely opening the chat list never marks a message read.

Shared receipts are separate from private unread-badge records. Each conversation stores `reads/{readerUid}` beside its `messages` collection: under `contactRequests/{requestId}`, `privateGroups/{groupId}`, or `privateGroups/{groupId}/memberChats/{firstUid}/with/{secondUid}`. Only eligible conversation participants can read these receipts, and each reader can advance only their own timestamp. Removed contacts and departed group members lose access. The active conversation listens in real time; duplicate read writes are skipped and rapid advances are combined.

Publish `firestore.rules` to activate shared receipts; no new index or native build is required. Both devices must run the updated app. Earlier messages acquire shared read evidence when the recipient opens the conversation again, even if their private unread count was already zero.

Closing the inbox records `ackFor` on each displayed request/event. It identifies that occurrence by its server timestamp, so a dismissed request stays quiet across sessions while a later request can still notify. The envelope opens the inbox manually.

Group member cards at `privateGroups/{groupId}/members/{uid}` carry only a display name and avatar. The app writes a card when someone creates or joins a group and removes it on leave. For existing groups, preview the migration with `node scripts/backfill-group-directory.cjs PROJECT --members` and add `--apply` to populate missing cards.

The group conversation is visible to joined members. Selecting a member opens a separate conversation under `privateGroups/{groupId}/memberChats/{firstUid}/with/{secondUid}/messages`. The UIDs are sorted so both participants reach the same history. Only that pair can read or send, and both must still be joined. The contact inbox continues to use the accepted contact relationship for its separate direct chat.

For an existing project, run `node scripts/backfill-group-directory.cjs PROJECT` to count incomplete summaries. Add `--apply` to backfill each in a transaction. Older records use the original Firestore document creation time and the creator’s available profile name at migration. Pending invitations do not count as members. The migration uses the installed Firebase CLI login.

In Settings → Location sharing, **Who can see me** selects No one, Nearby users (within 1 km), or My groups (joined members only). Choosing My groups removes the public marker in the same Firestore batch. **Stop all sharing** and **No one** stop this device’s publishing immediately, end its active trip, and remove public and joined-group locations, including trip documents. Failed removal stays pending and can be retried; it never restores the old audience locally. Existing opt-outs stay off. **Record my path** and **Show people on my map** are independent controls: neither changes the sharing audience.

In a joined group, tap **Share my trip**. The app shares the latest GPS fix with that group while the app is open. After about 5 m of movement, the sender publishes the newest fix at most once every two seconds. GPS reception and internet access affect delivery. While stationary, the app periodically requests a fresh fix. It shares up to 500 recorded points from the trip and preserves gaps in GPS coverage.

On another member’s map, turn on **Show people**. The traveler’s marker appears as soon as the first live update arrives, and the route appears after two recorded points. Tap **Follow** beside the traveler’s name, or choose a traveler under **Live trips**. Drag the map to stop following. Tapping **Stop** on the sender’s map removes the shared route. Ordinary group location sharing follows the sender’s separate preference. If the sender disconnects, the last confirmed update expires after two minutes.

Map avatars adapt to zoom. People whose markers overlap are grouped into a count marker. Tapping a count opens an individual selection list, including for identical GPS positions. Zooming in separates markers when their positions allow it.

The added rules protect privateGroups membership, live locations, and users/{uid}/preferences/sharing. Deploy the rules before reloading both clients. No new composite index or native module is required.

Crowded maps render at most 32 markers at once. Screen-space clustering combines overlapping people and adapts to the visible area. Only eight non-overlapping names appear at close zoom. Tap a count badge and search its virtualized people list to select an individual. Tests cover 100, 250, and 500 simulated people. Query limits count loaded results rather than every registered user in the area.

## Local crowd testing

Development builds include Settings → Developer testing. Enable Show test users, choose 10, 100, or 500, and tap View test map. The map fits the simulated users around the first available GPS fix. Test mode replaces the people shown on that device so the selected crowd size is exact. It uses named initial avatars and includes both close clusters and separated positions within 1 km.

Tap markers or count badges to exercise selection and search. Simulated-user cards cannot send requests. Stop on the map, switch off Show test users, or sign out to clear the fixtures. These markers remain in memory and are never written to Firebase. Normal account, contact, GPS recording, and sharing services keep using real data. Use your two real accounts to test requests and group sharing. The controls and commands are disabled in release configuration.

## Map status and responsive chats

Map filters (All, Contacts, Groups, Nearby) filter authorized location feeds already loaded by the client. They do not broaden Firestore access or change sharing preferences. Location timestamps use the existing server `updatedAt` field converted to device time; unknown timestamps are explicitly labelled. Markers fade after one minute and disappear when their lease expires. Person cards show update age, not an inferred online status.

Below 640 dp, Chats opens a full-width conversation list; selecting a row opens a full-width thread. Back returns to the list, and the group disclosure button expands or collapses members without opening the thread. Larger screens keep the two-pane layout. Returning to the list preserves the open thread’s draft and suspends its message listener/read receipts until it is visible again.

## Message actions

Long-press a message to select it and reveal the toolbar above the conversation. One selection offers Reply, Edit for your own confirmed message, and Delete. Multiple selections offer Delete only. Editing opens the composer with the original text; the check saves it and × cancels it, restoring any unsent draft. The trash button immediately deletes selected messages on this device without confirmation or a Firestore write. Clearing the selection hides the toolbar and checkboxes and restores the composer. Messages update in real time for every authorized participant in direct, group, and group-member chats.

Messages may contain `replyTo` (another message ID in the same conversation) and `editedAt` (a server timestamp). Replies resolve the original document instead of storing a copy of its text. Their quoted preview follows edits and becomes unavailable if the original is deleted. References outside the loaded message window have individual listeners, removed when no longer needed or when conversation access is lost. Existing messages need no migration.

Rules permit only the original sender to change `text` and `editedAt`, or delete a message, while still eligible to access the conversation. Sender, creation time, and reply target cannot be rewritten. Edits preserve read positions and conversation order; deletion also removes the message from unread counts. Direct-chat preview updates are transactional so changing an older message cannot overwrite a newer arrival.

Publish `firestore.rules` before using message editing and shared read receipts on a live project. No additional index, dependency, or native rebuild is required.

### Device-only message deletion

**Delete for me** is available for sent and received messages. Long-press selects a message immediately, revealing checkboxes and the action toolbar. **Select all messages** includes older history beyond the loaded page. It requests the complete set of visible message IDs, respects local hidden history, and unsubscribes after the first server result. Cancelling or leaving cancels the request; failure keeps the previous selection. New arrivals after selection remain unselected. Tapping the trash button removes the selected messages locally without opening a modal. The chat header's three-dot menu offers **Clear chat on this device**, including history older than the loaded page; clearing the entire history still asks for confirmation.

`StoredChatHistory` persists message IDs and a server-timestamp cutoff in AsyncStorage, scoped by account and conversation. It never stores message bodies or writes to Firestore. `DeviceChatRepository` applies that visibility policy to transcripts, quoted originals, inbox previews, group activity, and unread counts. `ChatViewModel` owns selection and local-deletion commands; Views only present and invoke those commands. Storage must load before a transcript appears, so hidden history does not flash on reopening. A storage failure preserves the current selection and exposes a retryable error.

Clear captures the newest known message timestamp when confirmation opens. It excludes older history directly in the Firestore read query without fetching every older message or relying on the device clock. Messages arriving after that cutoff remain visible. Local deletion survives app restarts and sign-out/sign-in on that device, but clearing app data or reinstalling resets it. Other accounts, other devices, server documents, and participants' read receipts are not changed by either local-deletion command. No Firebase deployment or native rebuild is needed for these local features.
