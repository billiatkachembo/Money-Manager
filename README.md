# Money Manager

Money Manager is an Expo + React Native personal finance app for tracking transactions, accounts, budgets, goals, debt, notes, analytics, and backups from a single mobile workspace.

## Overview

The app is built around a ledger-first data model. Transactions update account balances, debt state, analytics, financial health, and planning surfaces from the same shared store.

Core user areas include:
- Home dashboard with net worth, cash flow, debt, and recent activity
- Add / edit transaction flows for expense, income, transfer, and debt
- Accounts with grouped balances and account management
- Analytics with trends, milestones, forecasts, and smart insights
- Planning for goals, budgets, and calculators
- Notes, calendar, backup / restore, and profile settings

## Stack

- Expo SDK 54
- React 19
- React Native 0.81
- Expo Router
- Zustand
- Gorhom Bottom Sheet
- Victory Native charts
- Expo Auth Session for Google OAuth
- Expo Secure Store for Drive auth persistence

## Project Structure

```text
app/                    Expo Router entrypoints and tab screens
components/             UI building blocks, sheets, modals, and section components
constants/              Currencies, languages, categories, account types
lib/                    Google Drive, CSV helpers, and utility integrations
src/domain/             Ledger, analytics, financial intelligence, budgeting logic
src/storage/            Local persistence helpers
store/                  Global state for transactions, theme, tooltips, and navigation
types/                  Shared TypeScript model definitions
utils/                  Formatting and general helpers
```

Important files:
- `app/_layout.tsx`: app shell, theme, tooltip host, notification plumbing
- `app/(tabs)/_layout.tsx`: two-level tab navigation layout
- `store/transaction-store.ts`: main ledger, persistence, analytics, backup, and restore state
- `components/AddTransactionModal.tsx`: transaction entry UI
- `app/(tabs)/profile.tsx`: settings, import/export, Google Drive backup UI
- `lib/google-drive.ts`: Google Drive auth persistence and Drive API helpers

## Requirements

- Node.js 20+
- npm
- Android Studio + Android SDK for Android builds
- Xcode for iOS builds
- Java / `keytool` if you are configuring Google OAuth on Android

## Install

```powershell
npm install
```

## Environment Variables

Create `.env.local` in the project root. Use `.env.example` as the template.

Current public env vars used by the app:
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_WEB_APP_URL` (optional, used by the `PC Manager` quick action to open your deployed web app)
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` (optional fallback / legacy path only)

Notes:
- `.expo/.env` is not the source of truth for project configuration.
- Use `.env.local` for local development.
- Restart Metro after changing env vars.

## Running the App

Start the Expo dev server:

```powershell
npx expo start
```

Run a native development build on Android:

```powershell
npx expo run:android
```

Run a native development build on iOS:

```powershell
npx expo run:ios
```

Run the app in a browser:

```powershell
npm run web
```

Export a production web bundle:

```powershell
npm run export:web
```

Run the main project quality checks:

```powershell
npm run quality
```

Run focused finance-domain correctness tests:

```powershell
npm run test:domain
```

Validate Expo config:

```powershell
npm run check:expo-config
npx expo-doctor --verbose
```

## Google Drive Backup Setup

Google Drive backup uses OAuth through `expo-auth-session` and requires a development build.

Important:
- Google Drive backup does not work in Expo Go.
- Android and iOS need platform-specific Google OAuth client IDs.
- The app currently reads those IDs from `.env.local`.

See the full guide in [docs/GOOGLE_DRIVE_SETUP.md](./docs/GOOGLE_DRIVE_SETUP.md).

### Quick Summary

1. Enable Google Drive API in Google Cloud Console.
2. Configure the OAuth consent screen.
3. Create an Android OAuth client for package `com.billiatkachembo.moneymanager`.
4. Create an iOS OAuth client for bundle ID `com.billiatkachembo.moneymanager`.
5. Add the returned client IDs to `.env.local`.
6. Rebuild the app with `npx expo run:android` or `npx expo run:ios`.

## Backup and Restore

The app supports:
- Local full backup JSON export / import
- Transactions CSV export / import
- Google Drive backup / restore
- Auto-restore from Google Drive when local data is empty and valid auth exists

Google Drive backups are uploaded into a `Money Manager Backups` folder and stored as JSON snapshots.

## Theming and Localization

- Theme supports `System`, `Light`, and `Dark`
- The app follows system appearance when `System` is selected
- Currency and language are managed from Settings
- Shared translation strings live in `src/i18n/index.ts`

## Notes for Contributors

- Prefer `rg` for search and `rg --files` for file discovery
- Main ledger/business logic belongs in `src/domain/` and `store/transaction-store.ts`
- UI-only state should stay close to the component that uses it
- `.expo/` is generated local state and should not be treated as project config

## Validation

Good local checks for this repo:

```powershell
npm run typecheck
npm run test:domain
npm run check:expo-config
npm run check:web-export
npx expo-doctor --verbose
```

There is also a combined quality gate:

```powershell
npm run quality
```

The repo now includes a GitHub Actions workflow at `.github/workflows/quality.yml` that runs the same baseline automatically on pushes and pull requests.

## Web Notes

The app now exports cleanly for web with Expo Router and React Native Web.

Current browser behavior:
- Core tabs, analytics, planning, accounts, calendar, notes, and transaction flows bundle for web.
- Use `npm run web` for local browser access, or deploy the generated `dist/` folder to any static host.
- Android-only quick-add notifications and reminder notifications are intentionally disabled on web.
- Some device-specific capabilities such as camera-heavy flows, native sharing targets, and certain Google Drive backup paths may still behave differently in browsers.

## Troubleshooting

### Google Drive says it is unavailable

Common reasons:
- You are testing in Expo Go instead of a development build
- The relevant `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` variable is missing
- The Android package name or SHA-1 does not match the Google OAuth client
- The iOS bundle ID does not match the Google OAuth client

### `myapp://` should not appear in Google auth

This app uses the app-owned Expo schemes from `app.json`, not the old placeholder scheme.

### Android build fails because of the NDK

Make sure Android Studio has the NDK version required by the project installed. If Gradle points to a broken NDK folder, update the local Android SDK installation or the project NDK version accordingly.

## License / Ownership

Project branding and identifiers are configured for `com.billiatkachembo.moneymanager`.
