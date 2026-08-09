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

Every feature's `services/` folder is split into an **`on/`** (server) and **`off/`** (offline) implementation with the same call signature. `src/shared/services/dispatchProxy.tsx` + `appMode.tsx` route each call to the right implementation based on the persisted mode (`@app_mode` in AsyncStorage, default `on`). Switching modes in Settings takes effect immediately, no restart. When touching a feature's service layer, check both `on/` and `off/` — a change usually needs to land in both, or the behavior will silently diverge between modes.

Offline sessions get `local_` IDs. `useSyncManager` (`src/shared/context/hooks/`) queues `startSession`/`recordSet`/`endSession` while offline and replays them on reconnect, remapping local IDs to server IDs; failed ops stay queued.

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

- `tsconfig.temp.json` (currently deleted in the working tree, see `git status`) was a typecheck-only helper for tracking modals with an `@app/*` alias — not used at runtime and `src/app/` doesn't exist.
- `app-release.apk`, `release.bat`, `release.sh`, `sonarqube/`, `.scannerwork/`, `.sonarlint/` are gitignored but committed in repo history — don't be surprised they show as tracked.
- SonarQube: `npm run sonar:scan` (needs `SONAR_TOKEN`, targets `http://192.168.10.12:8999`).

## Code Comments

Keep comments to an absolute minimum. Code should be self-documenting whenever reasonably possible. Avoid referencing the old code and why it didn't work.

Only add a comment when it provides important information that cannot be clearly expressed through the code itself, such as:

- A non-obvious **why** that a future developer genuinely needs to know
- A non-obvious business or domain rule
- A workaround for a bug, framework limitation, or external constraint
- Important compatibility or integration requirements

Never add comments that:

- Describe what the code obviously does
- Restate variable, function, component, or class names
- Explain straightforward function calls, loops, conditionals, or JSX
- Narrate implementation steps
- Explain code that is already clear from its naming and structure
- Document a refactoring or code organization change unless the reason is critical and would otherwise be lost
- Explain why code was moved, extracted, split, or reorganized when the resulting code is already understandable
- Describe static-analysis/tooling issues unless the workaround must be preserved to prevent the issue from returning
- Summarize a block of code immediately above that block
- Add multi-line explanatory blocks merely to make the code appear more documented
- Write comments as an explanation of the changes you just made

### Comment length

Prefer a short comment over a long comment.

Do not write paragraph-length comments. Do not write comments containing several sentences explaining implementation history, refactoring details, or the reasoning behind an otherwise understandable structure.

If a comment would require more than 1–2 short sentences, first determine whether the information belongs in documentation, an issue, commit history, or the code itself.

### Refactoring

When extracting, splitting, simplifying, or reorganizing code, do NOT add a comment explaining the refactoring.

For example, do not add comments like:

```ts
// These were previously inlined inside PlanScreen's renderWidgetContent...
// Pulling each block out into its own component reduces cognitive complexity...
```

The extracted components and their structure should speak for themselves.

Only mention the reason in a comment if it represents a persistent, non-obvious constraint that a future developer could accidentally remove and thereby reintroduce a real problem.

### Before adding a comment

Ask:

> "Does this comment tell a future developer something important that they cannot reasonably determine from the code?"

If the answer is no, do not add it.

When in doubt, leave the comment out.
