# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install --legacy-peer-deps   # required — peer deps are not resolvable otherwise
npm start                        # Expo dev server
npm run android                  # run on Android device/emulator (no maintained iOS target)
npm test                         # jest / jest-expo — no test files currently exist in the repo
npm run test:coverage
npx tsc --noEmit                 # typecheck (no separate lint script/ESLint config exists)
```

There is no `ios/` — iOS is configured in `app.json` but not maintained, and `ios/`/`android/` are gitignored, **generated** directories (`npx expo prebuild --platform android --clean`). Run prebuild before any native build step.

### Release builds

- **EAS** (`eas.json` profiles: `development`, `preview` (APK), `production` (AAB)): `eas build --profile preview --platform android`
- **Local** (via `local-expo-build`): `npm run build:android:apk` / `npm run build:android:apk:clean`
- `release.sh` (Linux) / `release.bat` (Windows, Docker) inject signing config into `android/app/build.gradle` and require a secrets file (`~/.ownlift-secrets` or `%USERPROFILE%\.ownlift-secrets.bat`), not present in this checkout.
- `eas.json` has `appVersionSource: "remote"` — app version is managed on EAS, not bumped in `app.json`.

## Architecture

OwnLift is an **offline-first** React Native/Expo fitness tracker. It works with zero backend (local device storage, no login) or can optionally sync against [OwnLift-Server](../OwnLift-Server) (Node/Express/MySQL, a sibling repo) for cross-device sync and social/live features.

### App-mode dispatch (the core pattern)

Every feature's `services/` folder is split into an **`on/`** (server) and **`off/`** (offline) implementation with the same call signature. `src/shared/services/dispatchProxy.tsx` + `appMode.tsx` route each call to the right implementation based on the persisted mode (`appMode` key, values `"online"`/`"offline"`, default `online`). Switching modes in Settings takes effect immediately, no restart. When touching a feature's service layer, check both `on/` and `off/` — a change usually needs to land in both, or the behavior will silently diverge between modes.

All key/value persistence, including `appMode`, goes through `src/shared/services/sqliteStorage.tsx` (`expo-sqlite`, WAL mode) — not `@react-native-async-storage/async-storage`. It replaced AsyncStorage app-wide for performance (one row per record instead of re-serializing a whole JSON array per write) and serializes every call through a single queued connection because `expo-sqlite`'s native binding breaks under concurrent statements on one `openDatabaseSync` connection.

Offline sessions get `local_` IDs. `useSyncManager` (`src/shared/context/hooks/`) queues `startSession`/`recordSet`/`endSession` while offline and replays them on reconnect, remapping local IDs to server IDs; failed ops stay queued.

`friends` is the one feature that doesn't follow the `on`/`off` split — friend requests, sharing, and search are inherently server-mediated, so `services/index.tsx` exports straight from `on/` with no `off/` counterpart.

### Structure

```
src/
  features/          # analytics, auth, friends, homescreen, plan, settings, supplements, tracking, workout
                      # each feature: screen(s), types.ts, services/{on,off}/
  shared/
    components/       # CustomAlert, ModalSheet, ProgressChart, VersionGuard, widgets/
    context/           # AuthContext, WorkoutContext, ThemeContext, TabBarContext
    context/hooks/      # useJointSession, useProgramOperations, useRealtimeSocket, useServerSync,
                         # useSessionOperations, useSyncManager, useTwoFingerPull, useWidgets
    services/          # apiClient, appMode, authenticatedFetch, config, dispatchProxy,
                        # managedState, notifications, offlineHelpers, storage, tokenStorage
    types.ts
  utils/              # format helpers, parsers
tasks/                # expo-task-manager background tasks (supplementLocationTask.tsx)
plugins/              # Expo config plugins (withGradleTuning.js — Gradle JVM tuning during prebuild)
```

`App.tsx` is the entrypoint and imports with relative paths (`./src/...`), not the `@features/@shared/@utils` aliases used everywhere else (configured in `babel.config.js` and `tsconfig.json`).

### Widget system

Each screen (Home, Analytics, Workout, Plan, Friends, and each Tracking sub-tab) has an independent, per-user widget board driven by `useWidgets.tsx`: a registry of available widgets, defaults, and a persisted layout. Widgets are reorderable/resizable/removable via a two-finger pull gesture or the "Edit Widgets" panel.

### Other notable pieces

- **Auth (server mode):** JWT with silent refresh every ~55 min, tokens in `expo-secure-store`. Default server `https://ownlift.superak0s.com`, overridable in Settings (`@server_url`).
- **Real-time:** one persistent, JWT-authenticated WebSocket with exponential backoff (`useRealtimeSocket`), server mode only — powers joint/watch sessions.
- **Smart reminders:** local notifications for time-based reminders; a registered `expo-task-manager` background task (`tasks/supplementLocationTask.tsx`) computes Haversine distance for geofenced location reminders, with configurable battery presets (Low/Medium/High).
- Notifications are unavailable in Expo Go — calls are wrapped in try/catch in `App.tsx`. `expo-dev-client` is installed, so dev builds need `eas build --profile development` or `expo run:android`, not Expo Go.

## Gotchas

- `app-release.apk`, `release.bat`, `release.sh`, `sonarqube/`, `.scannerwork/`, `.sonarlint/` are gitignored but committed in repo history — don't be surprised they show as tracked.
- SonarQube: `npm run sonar:scan` (needs `SONAR_TOKEN`, targets `http://192.168.10.12:8999`).

## Code Comments

Keep comments to an absolute minimum. Code should be self-documenting whenever reasonably possible.

Only add a comment when it conveys something a future developer genuinely needs and cannot get from the code itself:

- A non-obvious **why**
- A non-obvious business or domain rule
- A workaround for a bug, framework limitation, or external constraint
- A compatibility or integration requirement that isn't otherwise visible

### Never comment on

- What the code obviously does, or a restatement of variable/function/component/class names
- Straightforward function calls, loops, conditionals, or JSX
- Implementation steps or a summary of the block immediately below
- Refactoring, extraction, or reorganization — including _why_ code was split, moved, or simplified — unless a genuinely persistent constraint would otherwise be lost
- Old code, prior approaches, or why something didn't work before
- Static-analysis/tooling quirks, unless the workaround must be preserved to prevent the issue from recurring
- The change you just made (comments should describe the code as it is, not narrate the diff)

Do not add comments just to make the code look documented.

### Length

Prefer no comment over a short one, and a short one over a long one. 1–2 short sentences max. If it needs more than that, it probably belongs in documentation, an issue, or commit history instead — not in the code.

### Before adding a comment, ask

> "Does this tell a future developer something important they can't reasonably get from the code itself?"

If no — leave it out. When in doubt, leave it out.
