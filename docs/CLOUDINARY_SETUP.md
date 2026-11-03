# Cloudinary avatar setup (Free plan)

Firebase Authentication and Firestore remain on Spark. Avatar files now upload directly to Cloudinary using an unsigned preset. No Cloudinary API key, API secret, Firebase Storage bucket, billing upgrade, or new native library is required.

## 1. Create your Cloudinary account

Sign up for the [Cloudinary Free plan](https://cloudinary.com/pricing). The current free plan requires no credit card and includes a shared monthly credit allowance for storage, transformations, and delivery; check your Console usage as you test.

In the Cloudinary Console, select your product environment and copy its **Cloud name** from the Dashboard/API Keys area. This is not your account email, API key, or API secret.

## 2. Create an unsigned upload preset

Open **Settings → Upload → Upload presets → Add upload preset** (in some Console layouts, **Settings → Upload presets**).

Set these options, then save:

| Setting                       | Value                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| Preset name                   | A unique name you choose, for example `nest_avatars_unsigned`             |
| Signing mode                  | **Unsigned**                                                              |
| Asset folder / folder         | `nest/avatars` (the field name depends on your environment's folder mode) |
| Allowed formats               | `jpg,jpeg,png,webp`                                                       |
| Disallow public ID            | Enable                                                                    |
| Use filename as public ID     | Disable; use generated unique IDs                                         |
| Overwrite                     | Disabled; unsigned uploads cannot overwrite existing assets               |
| Incoming image transformation | Recommended: limit width and height to 512 pixels (`c_limit,w_512,h_512`) |
| Return delete token           | Enable in the preset's advanced options if available                      |

Uploads should use ordinary public image delivery (`upload`), so the returned HTTPS image URL can display in the app. Do not enable paid add-ons, restricted delivery, or video transformations for this avatar preset.

The app checks JPG/PNG/WebP and 5 MB before uploading. **Cloudinary presets do not enforce a per-preset file size limit**; the app's limit can be bypassed outside the app. Format restrictions and incoming resizing must be set in Cloudinary itself. See [Cloudinary's unsigned preset protections](https://cloudinary.com/documentation/upload_presets#protect_unsigned_presets).

## 3. Add the two public settings

Edit your existing `E:\GoogleMap\mobile\.env` and add:

```dotenv
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
```

Keep your existing Firebase and Google OAuth values. `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` is no longer used and can be removed. Never add `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`, service-account credentials, or a Cloudinary API secret to an `EXPO_PUBLIC_` variable.

Cloud names and preset names are bundled into the app. An unsigned preset is not an authorization mechanism: anyone who discovers it can use it. This setup is suitable for initial testing with the free plan. For a public production app, put upload authorization/signing behind a backend that verifies Firebase ID tokens, enforces per-user limits, and keeps the API secret server-side. This does not require Firebase Storage, but the backend is a separate deployment.

## 4. Publish Firestore rules

Firebase Console → **Firestore Database → Rules**: review and publish the project's `firestore.rules`. These allow only the authenticated owner to save/read their profile. No Firebase Storage setup or Storage rules deployment is required. `storage.rules` is retained only for previously uploaded Firebase files and is no longer included in `firebase.json`.

Existing Google or Firebase avatar URLs continue to display. Uploading a new avatar replaces the profile's URL with the Cloudinary URL; existing files are not automatically migrated or deleted.

## 5. Restart and test on Android

Stop the current Metro server with Ctrl+C. From the project folder, run:

```powershell
cd E:\GoogleMap\mobile
npx expo start --clear
```

Open the installed **Nest** app in the emulator (Google sign-in needs Nest, not Expo Go). If you need to install/open it again, use `npm run android` instead. A new native build is not needed just for Cloudinary: this change uses the existing picker and the HTTPS Upload API.

Create account → authenticated **Your profile** → **Add a photo** → choose an image → fill required profile fields → **Save profile**. The image uploads when you save, not when you select it. Confirm that:

1. Saving succeeds and the app opens Home. A failed save stays on Profile with an error.
2. Cloudinary Media Library contains the image under your configured folder.
3. Firestore `users/{uid}.avatarUrl` contains an `https://res.cloudinary.com/...` URL.
4. Signing out and in again loads the saved avatar.

## Errors and cleanup

| Symptom                                               | Check                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Avatar uploads are not configured                     | Exact cloud name and preset name, **Unsigned** mode, allowed formats; restart Metro after `.env` edits                                    |
| Upload failed                                         | Connection, Cloudinary usage limits, public delivery/preset settings                                                                      |
| Profile saving is not allowed                         | Publish the updated Firestore rules in the same Firebase project                                                                          |
| New image exists in Cloudinary but Save failed        | The app attempts cleanup only if the preset returned a valid temporary deletion token; otherwise remove the unused asset in Media Library |
| Remove photo clears the profile but the asset remains | Expected: removing/replacing an old avatar does not delete the stored image; clean up unused assets in Media Library                      |

Deletion tokens expire after 10 minutes and are kept only in memory while saving; they are never stored in Firestore. Cleanup is best effort and can fail offline or without a token. Old/unused images continue to count toward Cloudinary usage until deleted. Avatar delivery URLs are public; anyone with the URL can view the photo, even though the profile document is protected by Firestore rules.

Local tests mock upload requests and Firebase. Live upload requires your own Cloudinary account and preset; no account or preset is created by the code.

References: [Unsigned uploads](https://cloudinary.com/documentation/upload_images#unauthenticated_requests), [upload presets](https://cloudinary.com/documentation/upload_presets), [temporary client-side deletion](https://cloudinary.com/documentation/client_side_uploading#deleting_client_side_uploaded_assets).
