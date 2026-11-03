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

Home has a Show Nearby Users switch, off by default. It controls discovery and marker visibility for the viewer only. Signed-in users with complete profiles publish their GPS position, profile name, and avatar automatically while the app is active and device location permission is granted. The other person does not need to enable Show Nearby Users. Location remains active on Contacts, Settings, and Help as well as Home. Default public display names use the profile full name. Each person's saved contact nickname overrides that display name locally for you. Help explains automatic foreground location visibility.

Nearby discovery uses geohash ranges covering about 5 km, filters geographic false positives, excludes yourself, and bounds each query to 50 results. It refreshes the query center after roughly 250 m of movement. Profile birthdays and emails are not published to nearby markers.

Shared-location writes are throttled while moving and refreshed every 30 seconds while the signed-in app is active. Pausing path recording keeps live GPS and publishing active. Turning Show Nearby Users off clears peer markers and stops discovery queries; it does not stop publishing the user's own position. Publishing pauses when the app goes to the background, GPS becomes unavailable, or the user signs out. Deletion is queued after any in-flight publish, so a late write cannot undo removal. Sudden disconnection or force-quit cannot guarantee immediate deletion: security rules make old records unreadable after their short lease expires, at most about four minutes from publication.

Failed nearby listeners reconnect automatically with a 2–30 second backoff, including within the same lease bucket. Nearby unavailable · Retry appears if discovery or publishing fails; the feedback message explains the failure. Retry restarts only nearby discovery and republishes the current GPS fix. Results are combined after all geohash ranges respond, so an empty successful range cannot hide another range's error. Both users must have live GPS within 5 km; an emulator's simulated location can differ from the computer's location.

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
3. Turn on Show Nearby Users only on A. A's map should show B's avatar and name even while B's switch is off. Enable it on B to see A as well. Move B to Settings or Help and verify A still sees B; background B's app and verify its presence is removed or expires.
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
