# OwnLift App — Agent Instructions

## Quick start

```bash
npm install --legacy-peer-deps   # required, peer deps are not resolvable otherwise
npm start                         # Expo dev server (development build)
npm run android                   # run on Android device/emulator
```

No iOS support — `npm run ios` is in package.json but `ios/` is gitignored and no iOS build config exists.

## Structure

```
src/
  features/          # feature modules: analytics, auth, friends, homescreen, plan, settings, supplements, tracking, workout
  shared/
    components/      # reusable UI
    context/         # AuthContext, WorkoutContext, ThemeContext, TabBarContext + hooks (sync, session, program ops)
    services/        # apiClient, authenticatedFetch, notifications, dispatchProxy, offlineHelpers
    types.ts         # shared types
  utils/             # format helpers, parsers
tasks/               # expo-task-manager background tasks (supplementLocationTask.tsx)
plugins/             # Expo config plugins (withGradleTuning.js)
```

`App.tsx` is the entrypoint. No `src/app/` directory exists despite the `@app` alias.

## Path aliases

Configured in both `babel.config.js` and `tsconfig.json`:

| Alias | Resolves to |
|---|---|
| `@features/*` | `src/features/*` |
| `@shared/*` | `src/shared/*` |
| `@models/*` | `src/types/*` |
| `@utils/*` | `src/utils/*` |
| `@app/*` | `src/app/*` (unused — directory does not exist) |

## Offline-first architecture

Every service call routes through `dispatchProxy` to either `on/` (server) or `off/` (offline) implementations based on persisted mode (`@app_mode` in AsyncStorage, default `on`). Offline sessions get `local_` IDs; `useSyncManager` replays queued operations on reconnect.

## Native projects

`android/` and `ios/` are **generated** by `npx expo prebuild --platform android --clean`. They are gitignored. Run prebuild before any native build step.

Custom Expo plugin `plugins/withGradleTuning.js` injects aggressive Gradle JVM args during prebuild.

## Release builds

- **EAS:** `eas build --profile preview --platform android` (APK), `--profile production` (AAB)
- **Local:** `release.sh` (Linux, native Gradle) or `release.bat` (Windows, Docker) — both require secrets file and inject signing config into `android/app/build.gradle`
- Secrets: `~/.ownlift-secrets` (Linux) or `%USERPROFILE%\.ownlift-secrets.bat` (Windows)

## Testing

`jest` / `jest-expo` configured in package.json but **no test files exist**. Coverage directory is `coverage/`.

## Key gotchas

- Notifications module is unavailable in Expo Go — wrapped in try/catch in `App.tsx`
- Background location reminders use `expo-task-manager` — registered in `tasks/supplementLocationTask.tsx`
- `expo-dev-client` is installed — dev builds require `eas build --profile development` or `expo run:android`, not Expo Go
- `app-release.apk` is gitignored but committed in repo history — release scripts copy APK to repo root
