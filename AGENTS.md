# OwnLift App — Agent Instructions

## Quick start

```bash
npm install --legacy-peer-deps   # required, peer deps are not resolvable otherwise
npm start                         # Expo dev server
npm run android                   # run on Android device/emulator
```

Android only — `ios/` is gitignored. `app.json` has iOS config but no iOS build target is maintained.

## Structure

```
src/
  features/          # analytics, auth, friends, homescreen, plan, settings, supplements, tracking, workout
  shared/
    components/      # reusable UI
    context/         # AuthContext, WorkoutContext, ThemeContext, TabBarContext
    context/hooks/   # useJointSession, useProgramOperations, useRealtimeSocket, useServerSync,
                     # useSessionOperations, useSyncManager, useTwoFingerPull, useWidgets
    services/        # apiClient, appMode, authenticatedFetch, config, dispatchProxy,
                     # managedState, notifications, offlineHelpers, storage, tokenStorage
    types.ts         # shared types
  utils/             # format helpers, parsers
tasks/               # expo-task-manager background tasks (supplementLocationTask.tsx)
plugins/             # Expo config plugins (withGradleTuning.js)
```

`App.tsx` is the entrypoint. Imports in `App.tsx` use relative paths (`./src/...`), not aliases.

## Path aliases

`@features/*`, `@shared/*`, `@models/*`, `@utils/*` — configured in `babel.config.js` and `tsconfig.json`.

`@app/*` exists only in `tsconfig.temp.json` (typecheck helper for tracking modals). `src/app/` does not exist.

## Offline-first architecture

Every service call routes through `dispatchProxy` to either `on/` (server) or `off/` (offline) implementations based on persisted mode (`@app_mode` in AsyncStorage, default `on`). Offline sessions get `local_` IDs; `useSyncManager` replays queued operations on reconnect.

## Native projects

`android/` and `ios/` are **generated** by `npx expo prebuild --platform android --clean`. They are gitignored. Run prebuild before any native build step.

Custom Expo plugin `plugins/withGradleTuning.js` injects aggressive Gradle JVM args during prebuild.

## Release builds

- **EAS:** `eas build --profile preview --platform android` (APK), `--profile production` (AAB)
- **Local:** `npm run build:android:apk` or `npm run build:android:apk:clean` (uses `local-expo-build`)
- **Scripts:** `release.sh` (Linux) or `release.bat` (Windows, Docker) — require secrets file, inject signing config into `android/app/build.gradle`
- **Secrets:** `~/.ownlift-secrets` (Linux) or `%USERPROFILE%\.ownlift-secrets.bat` (Windows)

## Testing

`jest` / `jest-expo` configured in package.json but **no test files exist**.

## SonarQube

`sonar-project.properties` present. Run `npm run sonar:scan` (requires `SONAR_TOKEN` env var, targets `http://192.168.10.12:8999`). Analysis output lives in `sonarqube/` and `.scannerwork/` (both gitignored but committed in history).

## Key gotchas

- Notifications module is unavailable in Expo Go — wrapped in try/catch in `App.tsx`
- Background location reminders use `expo-task-manager` — registered in `tasks/supplementLocationTask.tsx`
- `expo-dev-client` is installed — dev builds require `eas build --profile development` or `expo run:android`, not Expo Go
- `app-release.apk`, `release.bat`, `release.sh`, `sonarqube/`, `.scannerwork/`, `.sonarlint/` are gitignored but committed in repo history
- `tsconfig.temp.json` is a typecheck-only config for tracking modals, not used at runtime
