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

### 📋 Manage your plan

- **Split templates** — choose from built-in split templates or create your own custom splits.
- **Program export** — export your loaded program for backup or sharing.
- **Strength level import** — import strength level data to inform your training.

### 📊 See your progress

- **Per-exercise analytics** with charts for volume, weight, and rep trends over time.
- **Session history** and **personal bests** at a glance.
- Overlay your body weight against your lifting numbers to see the full picture.

### 📈 Track your body

- **Widgetized dashboard** — every screen has a customizable widget board. Add, remove, resize, and reorder widgets with a two-finger pull gesture or the "Edit Widgets" panel. Each screen maintains its own independent widget layout:
  - **Home:** next workout, weekly progress, workout calendar, body weight trend, supplement reminders, recent PRs, workout streak, getting started guide
  - **Analytics:** exercise selector, data toggles, last workout, workout history, weight/volume/reps progress
  - **Workout:** day number, total sets, progress bar, session stats
  - **Plan:** create split, import workout, default splits, program loaded, split selector
  - **Friends:** friends list, pending/sent requests, contact/QR/user search
  - **Tracking:** one widget per sub-tab (Weight, Body Fat, Macros, Hydration, Measurements, Photos, Soreness, Menstrual)
- **Weight** — daily weigh-ins in your preferred unit (kg/lb).
- **Progress photos** — capture and store photos privately to watch your transformation, with gallery view, side-by-side comparison, and muscle-group tagging.
- **Macros** — log protein, carbs, fat, and calories against your goals.
- **Body fat** — track body-fat measurements over time.
- **Body measurements** — log waist, arms, chest, and custom body-part measurements.
- **Hydration** — track daily water intake against a goal.
- **Soreness & DOMS** — log muscle soreness with an interactive muscle map, DOMS heat map, follow-up tracking, muscle dashboard, and injury logging/tracking.
- **Menstrual cycle** — log cycles, per-day flow intensity, symptoms, and predicted period windows with calendar decorations.
- **Personal notes** — log freeform notes tied to dates.
- **Custom body measurements** — define and track arbitrary body-part measurements (server mode only).
- A universal calendar lets you jump to any date for any metric.

### 💊 Never miss a supplement

- Track your supplements and doses with fast quick-logging.
- **Smart reminders** that actually fit your life:
  - **Time-based** — get pinged at the times you set.
  - **Location-based** — geofenced reminders that fire when you arrive somewhere (like your kitchen or the gym).
  - **Combined** time + location for maximum reliability.
- **Battery presets** (Low / Medium / High) so location reminders never drain your phone.

### 👥 Train with friends _(server mode)_

- Add friends by username search, **QR friend codes**, or privacy-preserving contact matching (emails are hashed, never uploaded in the clear).
- **Granular sharing** — choose exactly what each friend can see: workout history, analytics, or your program.
- **Joint sessions** — work out together in real time, synced set-for-set.
- **Watch sessions** — spectate a friend's live workout as it happens.

### 🎨 Make it yours

- 7 built-in themes (Light, Dark, Yellow, Red, Green, Blue, Pink), plus automatic light/dark switching.
- **Create your own custom themes** with a full color editor and export/import them as JSON to share with friends.

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

- **React Native 0.86.2** + **React 19.2.3** on **Expo ~57**, written in **TypeScript ~6.0**.
- **Navigation:** React Navigation v7 (native-stack + a custom animated, collapsible bottom tab bar).
- **State:** React Context (no Redux) — `AuthContext`, `WorkoutContext`, `ThemeContext`, `TabBarContext`, plus custom hooks under `src/shared/context/hooks`.
- **Local storage:** `@react-native-async-storage/async-storage`, `expo-file-system`, and `expo-secure-store` (for auth tokens). No SQLite.
- **Charts:** `react-native-chart-kit` + `react-native-svg`.
- **UI/animation:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-linear-gradient`, `react-native-pager-view`, `lucide-react-native`.
- **Media/files:** `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-sharing`, `expo-contacts`, `expo-crypto`, `xlsx`.
- **Notifications/background:** `expo-notifications`, `expo-task-manager`, `expo-location`.
- **Device/system:** `expo-dev-client`, `expo-device`, `expo-constants`, `expo-linking`, `expo-navigation-bar`.
- **Other:** `react-native-qrcode-svg`, `@react-native-community/datetimepicker`, `react-native-webview`, `react-native-worklets`, `react-native-screens`.
- **Config-only (no source imports):** `expo-updates` (OTA), `expo-splash-screen`, `expo-system-ui`.

### Architecture

- Feature-based layout under `src/features/<feature>/`, each with its screen, `types.ts`, and a `services/` folder split into **`on/`** (server) and **`off/`** (offline) implementations.
- **App mode dispatch** (`src/shared/services/appMode.tsx` + `dispatchProxy.tsx`): every service call is routed to the `on/` or `off/` implementation at call time based on the current mode (persisted under `appMode`, default `online`). Switching modes takes effect immediately.
- **Offline sync queue** (`src/shared/context/hooks/useSyncManager.tsx`): sessions started offline get `local_` IDs; on reconnect, queued `startSession` / `recordSet` / `endSession` operations are replayed and local IDs are remapped to server IDs. Failed ops stay queued.
- **Auth** (server mode): JWT with silent refresh every ~55 min, tokens stored via `expo-secure-store`. Default server `https://ownlift.superak0s.com`, overridable in Settings (`@server_url`).
- **Real-time:** a single persistent WebSocket (JWT-authenticated, exponential backoff) powers joint/watch sessions — server mode only.
- **Smart reminders:** local scheduled notifications for time-based reminders; a registered `expo-task-manager` background task computes Haversine distance for geofenced location reminders, with configurable accuracy/interval battery presets.
- **Widget system** (`src/shared/context/hooks/useWidgets.tsx`): each tracking tab has an independent widget board with a registry, defaults, and persisted layout. Two-finger pull gesture opens the widget gallery. Widgets are per-user, reorderable, resizable, and removable.

### Main screens

Home · Workout · Plan · Progress (Analytics) · Track (Weight / Photos / Macros / Body Fat / Measurements / Hydration / Soreness / Menstrual) · Supps · Friends · Settings.

### Path aliases

`@features`, `@shared`, `@utils` (via `babel-plugin-module-resolver`).

---

## Development

```bash
npm install --legacy-peer-deps
npm start          # Expo dev server
npm run android    # run on Android
```

iOS is configured in `app.json` but not maintained — `ios/` is gitignored.

## Building a release

**With EAS** (see `eas.json` — profiles: `development`, `preview` (APK), `production` (AAB)):

```bash
eas build --profile preview --platform android
```

**Locally** (requires `local-expo-build`):

```bash
npm run build:android:apk
npm run build:android:apk:clean   # clean build
```

Or use the provided `release.sh` (Linux) / `release.bat` (Windows, Docker) scripts — both require a secrets file (`~/.ownlift-secrets` or `%USERPROFILE%\.ownlift-secrets.bat`).

### In-app updates

Expo OTA updates are configured in `app.json` (`checkAutomatically: ON_LOAD`). A GitHub release checker exists in `App.tsx` but is currently disabled.

## App identity

- Name: **OwnLift** · slug `ownlift` · bundle/package `com.ownlift.app`
- Android permissions include background location, foreground service, notifications, exact alarms, boot-completed, wake lock, and vibration (for the smart reminder system).

---

_Server mode is optional. OwnLift is designed to be fully useful with zero infrastructure — the server only adds cross-device sync and social/live features._
