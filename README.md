# OwnLift

**Your entire gym life in one app — and it works completely offline, no account or server required.**

OwnLift is a fitness tracking app that puts you in control. Log your workouts, track your body, manage your supplements, and analyze your progress — all from your phone. Unlike most fitness apps, OwnLift doesn't force you into the cloud: you can run it **100% offline** with everything stored privately on your device, or optionally connect to a server (the official one or your own self-hosted instance) to sync and unlock social features.

---

## What you can do

### 🏋️ Track your workouts
- **Bring your own program.** Upload your workout plan straight from a spreadsheet (`.ods`, `.xlsx`, `.xls`) — the app parses your days, exercises, muscle groups, and even multi-person split columns automatically.
- **Log sets as you lift** — weight, reps, notes, and warm-up flags, set by set.
- **Rest timer & smart time estimates** — see how long you've rested and get an estimated finish time for your session based on your pace.
- **Add exercises or extra sets on the fly** mid-workout, with fuzzy exercise-name matching so nothing gets duplicated.
- **Day locking & weekly reset** — completed days lock until your week resets, keeping you on schedule (with manual unlock overrides when you need them).

### 📊 See your progress
- **Per-exercise analytics** with charts for volume, weight, and rep trends over time.
- **Session history** and **personal bests** at a glance.
- Overlay your body weight against your lifting numbers to see the full picture.

### 📈 Track your body
- **Weight** — daily weigh-ins in your preferred unit (kg/lb).
- **Progress photos** — capture and store photos privately to watch your transformation.
- **Macros** — log protein, carbs, fat, and calories against your goals.
- **Body fat** — track body-fat measurements over time.
- A universal calendar lets you jump to any date for any metric.

### 💊 Never miss a supplement
- Track your supplements and doses with fast quick-logging.
- **Smart reminders** that actually fit your life:
  - **Time-based** — get pinged at the times you set.
  - **Location-based** — geofenced reminders that fire when you arrive somewhere (like your kitchen or the gym).
  - **Combined** time + location for maximum reliability.
- **Battery presets** (Low / Medium / High) so location reminders never drain your phone.

### 👥 Train with friends *(server mode)*
- Add friends by username search, **QR friend codes**, or privacy-preserving contact matching (emails are hashed, never uploaded in the clear).
- **Granular sharing** — choose exactly what each friend can see: workout history, analytics, or your program.
- **Joint sessions** — work out together in real time, synced set-for-set.
- **Watch sessions** — spectate a friend's live workout as it happens.

### 🎨 Make it yours
- Multiple built-in themes (light, dark, and more), plus automatic light/dark switching.
- **Create your own custom themes** and export/import them as JSON to share with friends.

---

## Works offline — no server, no signup, no catch

OwnLift is built **offline-first**. The moment you open it in offline mode, you're in — no account, no login screen. A local profile is created for you and **everything lives privately on your device**: workouts, body stats, photos, supplements, and analytics all stored locally.

- **No self-hosting required.** You never need to run a server to use the core app.
- **Your data stays yours.** In offline mode nothing leaves your phone.
- **Flip a switch anytime.** A toggle in Settings (and on the login screen) switches between **Offline** and **Server** mode instantly — no restart needed.
- **Seamless sync when connected.** If you use server mode, workouts logged while offline are queued and automatically replayed to the server when you reconnect, so you can lift in a dead-zone gym and sync later without losing a thing.

Server mode is entirely optional. Use it only if you want to sync across devices or use the social/live features — and you can point it at your own self-hosted [OwnLift Server](../OwnLift-Server) for full control over your data.

---

## Technical overview

### Stack
- **React Native 0.81.5** + **React 19.1.0** on **Expo ~54**, written in **TypeScript ~5.9**.
- **Navigation:** React Navigation v7 (native-stack + a custom animated, collapsible bottom tab bar).
- **State:** React Context (no Redux) — `AuthContext`, `WorkoutContext`, `ThemeContext`, `TabBarContext`, plus custom hooks under `src/shared/context/hooks`.
- **Local storage:** `@react-native-async-storage/async-storage`, `expo-file-system`, and `expo-secure-store` (for auth tokens). No SQLite.
- **Charts:** `react-native-chart-kit` + `react-native-svg`.
- **UI/animation:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-linear-gradient`, `react-native-pager-view`.
- **Media/files:** `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-sharing`, `expo-contacts`, `expo-crypto`, `xlsx`.
- **Notifications/background:** `expo-notifications`, `expo-task-manager`, `expo-location`.
- **Other:** `react-native-qrcode-svg`, `expo-updates` (OTA), `@react-native-community/datetimepicker`.

### Architecture
- Feature-based layout under `src/features/<feature>/`, each with its screen, `types.ts`, and a `services/` folder split into **`on/`** (server) and **`off/`** (offline) implementations.
- **App mode dispatch** (`src/shared/services/appMode.tsx` + `dispatchProxy.tsx`): every service call is routed to the `on/` or `off/` implementation at call time based on the current mode (persisted under `@app_mode`, default `on`). Switching modes takes effect immediately.
- **Offline sync queue** (`src/shared/context/hooks/useSyncManager.tsx`): sessions started offline get `local_` IDs; on reconnect, queued `startSession` / `recordSet` / `endSession` operations are replayed and local IDs are remapped to server IDs. Failed ops stay queued.
- **Auth** (server mode): JWT with silent refresh every ~55 min, tokens stored via `expo-secure-store`. Default server `https://ownlift.superak0s.com`, overridable in Settings (`@server_url`).
- **Real-time:** a single persistent WebSocket (JWT-authenticated, exponential backoff) powers joint/watch sessions — server mode only.
- **Smart reminders:** local scheduled notifications for time-based reminders; a registered `expo-task-manager` background task computes Haversine distance for geofenced location reminders, with configurable accuracy/interval battery presets.

### Main screens
Home · Workout · Plan · Progress (Analytics) · Track (Weight / Photos / Macros / Body Fat) · Supps · Friends · Settings.

### Path aliases
`@features`, `@shared`, `@utils` (via `babel-plugin-module-resolver`).

---

## Development

```bash
npm install --legacy-peer-deps
npm start          # Expo dev server
npm run android    # run on Android
npm run ios        # run on iOS
```

## Building a release

**With EAS** (see `eas.json` — profiles: `development`, `preview` (APK), `production` (AAB)):
```bash
eas build --profile preview --platform android
```

**Locally with Docker** (builds an Android release APK without EAS):
```bash
docker build -t ownlift-app .
# APK is written to /output inside the image (see Dockerfile)
```

Or use the provided `release.sh` / `release.bat` scripts.

### In-app updates
On launch the app checks GitHub releases (`Superak0s/OwnLift-App`) and, when a newer `tag_name` than the installed version is found, prompts to download the latest `.apk`. Expo OTA updates are also enabled (`checkAutomatically: ON_LOAD`).

## App identity
- Name: **OwnLift** · slug `ownlift` · bundle/package `com.ownlift.app`
- Android permissions include background location, foreground service, notifications, exact alarms, boot-completed, wake lock, and vibration (for the smart reminder system).

---

*Server mode is optional. OwnLift is designed to be fully useful with zero infrastructure — the server only adds cross-device sync and social/live features.*
