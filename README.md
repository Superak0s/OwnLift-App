# 💪 SuperGym

A full-featured React Native fitness tracking app built with Expo. SuperGym lets you upload custom workout plans, track sets in real time, analyze your progress, monitor body composition, and connect with friends — all synced to your own backend server.

---

## Features

### 🏋️ Workout Tracking

- Upload custom workout plans from `.ods`, `.xlsx`, or `.xls` files
- Multi-person support (e.g. couples or training partners sharing a plan)
- Track individual sets with weight, reps, notes, and warm-up flags
- Real-time session stats: total time, average rest, current rest timer, estimated finish time
- Day locking after completing a session — resets every Monday
- Add extra sets or entirely new exercises mid-session
- Fuzzy exercise name matching with typo suggestions

### 📊 Analytics

- Per-exercise progress charts
- Volume, weight, and rep trends over time
- Session history with detailed set breakdowns
- Personal best tracking
- Body weight overlay on performance charts

### 📈 Body & Nutrition Tracking

- **Weight** — log daily weigh-ins, trend analysis vs. N-day average
- **Body Fat %** — US Navy method calculator (waist, neck, hip measurements)
- **Macros** — log meals with protein/carbs/fat/calories, set daily goals, error margin support
- **Progress Photos** — camera or gallery upload, grouped by date, full-screen viewer
- **Creatine** — streak tracking, daily logging, configurable reminders
- Calendar view for all tracking tabs — tap any date to view or add entries

### 🔔 Smart Creatine Reminders

- **Time-based** — daily push notification at a set time
- **Location-based** — background geofencing, notifies when you arrive at a chosen location (e.g. gym or home)
- **Combined** — both conditions must be met before firing
- Configurable battery impact (check interval)
- Alarm or notification style alerts

### 👥 Social / Friends

- Search and add friends by username
- Accept/reject friend requests
- View a friend's workout calendar and session history
- Share your analytics snapshot with a friend
- Share your current workout program with a friend
- Accept programs shared by friends directly into your library

### ⚙️ Settings

- Configurable rest timer (manual or learned from your session data)
- Server URL configuration (self-hosted backend)
- Demo mode for testing without affecting real stats
- Unlock individual days or all days
- Offline-first with pending sync queue
- Full data reset options (local + server)

---

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Framework     | React Native 0.81 + Expo 54                    |
| Navigation    | React Navigation v7 (stack + bottom tabs)      |
| Storage       | AsyncStorage                                   |
| Notifications | expo-notifications                             |
| Location      | expo-location + expo-task-manager (background) |
| Charts        | react-native-chart-kit + react-native-svg      |
| Maps          | react-native-maps                              |
| Auth          | Custom JWT (via backend API)                   |
| OTA Updates   | expo-updates                                   |

---

## Project Structure

```
supergym/
├── App.js                        # Root: navigation, tab bar, notification listener
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── tasks/
│   └── creatineLocationTask.js   # Background location task, notification scheduling
└── src/
    ├── context/
    │   ├── AuthContext.js        # Auth state, login/signup/logout
    │   └── WorkoutContext.js     # Workout state, session management, sync
    ├── screens/
    │   ├── HomeScreen.js         # File upload, profile selection, workout calendar
    │   ├── WorkoutScreen.js      # Active workout — sets, exercises, session timer
    │   ├── AnalyticsScreen.js    # Exercise analytics wrapper
    │   ├── TrackingScreen.js     # Weight, macros, photos, creatine, body fat
    │   ├── FriendsScreen.js      # Friends, requests, sharing
    │   ├── SettingsScreen.js     # App settings, creatine reminders, data management
    │   ├── LoginScreen.js
    │   └── SignupScreen.js
    ├── components/
    │   ├── ExerciseAnalytics.js  # Charts and analytics UI
    │   ├── UniversalCalendar.js  # Shared calendar (week/month view)
    │   ├── ModalSheet.js         # Reusable bottom sheet modal
    │   ├── ProgressChart.js      # Line chart wrapper
    │   ├── QuickLogCreatine.js   # Quick creatine logging modal
    │   ├── CreatineLocationPicker.js  # Map-based location picker
    │   └── BatterySettingsModal.js
    ├── services/
    │   └── api.js                # All API calls (auth, workouts, sharing, tracking)
    └── utils/
        └── exerciseMatching.js   # Fuzzy name matching / typo detection
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) — for builds
- A running instance of the SuperGym backend server

### Installation

```bash
git clone https://github.com/your-username/supergym.git
cd supergym
npm install
```

### Running in Development

```bash
npx expo start
```

Then scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

> **Note:** Background location and some notification features require a development build — they are not fully supported in Expo Go.

### Development Build (recommended)

```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

### Configuring the Server

On first launch, tap the **🌐 Server** badge on the login screen and enter your backend URL (e.g. `http://192.168.1.100:3000`). This can also be changed later in **Settings → Server Configuration**.

---

## Building for Distribution

```bash
# Android APK (for sideloading / testing)
eas build --profile preview --platform android

# Android App Bundle (for Play Store)
eas build --profile production --platform android

# iOS (requires Apple Developer account)
eas build --profile production --platform ios
```

---

## Permissions

| Permission                    | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `ACCESS_FINE_LOCATION`        | Setting reminder locations on the map       |
| `ACCESS_BACKGROUND_LOCATION`  | Geofence checks when app is closed          |
| `FOREGROUND_SERVICE_LOCATION` | Required by Android for background location |
| `POST_NOTIFICATIONS`          | Creatine reminders                          |
| `SCHEDULE_EXACT_ALARM`        | Precise time-based reminders                |
| `CAMERA`                      | Progress photo capture                      |
| `READ_MEDIA_IMAGES`           | Progress photo gallery picker               |

---

## Backend

SuperGym requires a self-hosted backend. The app communicates via a REST API supporting:

- JWT authentication (login / signup)
- Workout session logging (sets, timings, exercises)
- Body tracking (weight, height, body fat, progress photos)
- Macros logging and daily goals
- Creatine logging and settings
- Friend system and social sharing
- OTA-compatible analytics endpoints

Configure the server URL in the app or via `app.json` defaults.

---

## Feedback & Contributions

SuperGym is a passion project and feedback is genuinely welcome! If you run into bugs, have feature ideas, or just want to share how you're using the app:

- **Open an issue** on GitHub
- **Submit a pull request** — all contributions are welcome
- **Drop a message** if you've built something on top of SuperGym — I'd love to hear about it

The more feedback, the better the app gets for everyone.

---

## Built With Help From

This app was designed and developed with assistance from [Claude.ai](https://claude.ai) by Anthropic — an AI assistant that helped with architecture decisions, component design, bug fixing, and writing this very README. Shoutout to AI-assisted development making solo projects like this possible. 🤖💪(lol)

---
