# Google Drive Setup

This app uses Google OAuth through Expo Auth Session for Drive backup and restore.

## What Works

- Google Drive backup / restore in a development build
- Access token persistence with Expo Secure Store
- Access token refresh using the stored refresh token
- Auto-restore from Google Drive when local app data is empty and valid auth is available

## What Does Not Work

- Expo Go for Google Drive authentication

If you see a message like:

> Google Drive sign-in is not supported in Expo Go

switch to a development build.

## App Identifiers

These values must match your Google OAuth configuration exactly:

- Android package: `com.billiatkachembo.moneymanager`
- iOS bundle ID: `com.billiatkachembo.moneymanager`

These identifiers are defined in `app.json`.

## Required Environment Variables

Add these to `.env.local`:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
# Optional fallback / legacy path only:
# EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your-expo-client-id.apps.googleusercontent.com
```

Restart Metro after changing env vars.

## Google Cloud Console Steps

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable `Google Drive API`.
4. Configure the OAuth consent screen.
5. Add your testing Google accounts as test users if the app is still in testing mode.
6. Create an Android OAuth client.
7. Create an iOS OAuth client.
8. Optionally create a Web OAuth client if you plan to support web flows or fallback refresh configuration.

## Android OAuth Client

Create an Android OAuth client with:

- Package name: `com.billiatkachembo.moneymanager`
- SHA-1: your local debug keystore SHA-1 for development builds

### Generate a Debug Keystore

If `debug.keystore` does not exist yet:

```powershell
keytool -genkeypair -v `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -storepass android `
  -alias androiddebugkey `
  -keypass android `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname "CN=Android Debug,O=Android,C=US"
```

### Read the SHA-1

```powershell
keytool -list -v `
  -alias androiddebugkey `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -storepass android `
  -keypass android
```

Use the reported `SHA1` value in the Android OAuth client configuration.

## iOS OAuth Client

Create an iOS OAuth client with:

- Bundle ID: `com.billiatkachembo.moneymanager`

## Build and Test

Google Drive auth must be tested in a development build, not Expo Go.

Android:

```powershell
npx expo run:android
```

iOS:

```powershell
npx expo run:ios
```

## Runtime Flow

The app currently:

- reads Google client IDs from `.env.local`
- starts Google OAuth with `expo-auth-session`
- requests `https://www.googleapis.com/auth/drive.file`
- stores auth state in Expo Secure Store
- refreshes expired access tokens when a refresh token is present
- creates or reuses a `Money Manager Backups` folder in Google Drive
- uploads backup files as JSON
- restores the latest matching backup file from that folder

## Backup File Details

Drive backups are stored as JSON files with names like:

```text
money-manager-drive-backup-2026-03-26T08-15-00-000Z.json
```

The app also recognizes older compatible backup names such as:

```text
money-manager-backup-...
```

## Common Problems

### `Google client ID is missing`

One or more required env vars are not configured.

### Google sign-in opens, but fails after account selection

Usually one of these is wrong:
- Android package name
- Android SHA-1
- iOS bundle ID
- wrong client ID copied into `.env.local`

### Backup folder was deleted in Google Drive

The app now recreates or re-resolves the folder if the cached folder ID is stale.

### Restore says no backups found

Check that:
- you are signed into the same Google account
- the upload completed successfully
- the backup files are still inside `Money Manager Backups`

## Useful Files

- `app/(tabs)/profile.tsx`
- `lib/google-drive.ts`
- `components/BackupRestoreModal.tsx`
- `store/transaction-store.ts`
