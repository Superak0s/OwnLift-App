// Generic background location task for supplement reminders.
// Replaces the creatine-specific creatineLocationTask.ts.
// The old LOCATION_TASK_NAME ("creatine-location-reminder") is preserved
// so existing registered tasks survive an app update without needing a restart.

import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import Application from "expo-application";
import { getStorageItem, setStorageItem } from "../src/shared/services/sqliteStorage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import logger from "../src/shared/services/logger";

// ─── Expo Go detection ─────────────────────────────────────────────────────
// Remote/local push infra in expo-notifications triggers a load-time warning
// (and, as of SDK 57, a hard runtime error) the moment the module is required
// inside Expo Go. We therefore NEVER statically import expo-notifications —
// we lazily `import()` it, and only when we're not running in Expo Go.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import("expo-notifications");
let cachedNotifications: NotificationsModule | null = null;

/** Returns the expo-notifications module, or null when running in Expo Go. */
async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!cachedNotifications) {
    cachedNotifications = await import("expo-notifications");
  }
  return cachedNotifications;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatteryPreset {
  timeInterval: number;
  distanceInterval: number;
  accuracy: Location.Accuracy;
  label: string;
  description: string;
}

export interface BatteryPresets {
  LOW: BatteryPreset;
  MEDIUM: BatteryPreset;
  HIGH: BatteryPreset;
}

export type PresetKey = keyof BatteryPresets | "CUSTOM";

export interface BatterySettings {
  preset: PresetKey;
  custom: boolean;
  timeInterval: number;
  distanceInterval: number;
  accuracy: Location.Accuracy;
}

export interface CustomBatteryValues {
  timeInterval: number;
  distanceInterval: number;
  accuracy: Location.Accuracy;
}

export interface SupplementReminderLocation {
  lat: number;
  lng: number;
  radius: number;
  address: string;
}

/** Per-supplement reminder config stored in SQLite. */
export interface SupplementReminderConfig {
  supplementId: number;
  name: string;
  unit: string;
  defaultAmount: number;
  locationBasedReminder: boolean;
  timeBasedEnabled: boolean;
  reminderTime: string;
  reminderLocation: SupplementReminderLocation | null;
  enabled: boolean;
}

export interface UserData {
  id: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Keep old name so existing background task registrations survive the update
export const LOCATION_TASK_NAME = "creatine-location-reminder";

const STORAGE_KEY_SUPPLEMENT_CONFIGS = (userId: string) =>
  `supplementReminderConfigs_user_${userId}`;

// ─── Battery presets ──────────────────────────────────────────────────────────

export const BATTERY_PRESETS: BatteryPresets = {
  LOW: {
    timeInterval: 1_800_000,
    distanceInterval: 500,
    accuracy: Location.Accuracy.Low,
    label: "Low Impact",
    description: "Checks every 30 min, 500m movement",
  },
  MEDIUM: {
    timeInterval: 600_000,
    distanceInterval: 250,
    accuracy: Location.Accuracy.Balanced,
    label: "Medium Impact",
    description: "Checks every 10 min, 250m movement",
  },
  HIGH: {
    timeInterval: 300_000,
    distanceInterval: 100,
    accuracy: Location.Accuracy.High,
    label: "High Impact",
    description: "Checks every 5 min, 100m movement",
  },
};

// ─── Haversine ────────────────────────────────────────────────────────────────

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6_371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Reminder key helpers ─────────────────────────────────────────────────────

const getReminderKey = (
  userId: string,
  supplementId: number,
  reminderTime: string,
): string => {
  const today = new Date().toDateString();
  const [hour, minute] = reminderTime.split(":").map(Number);
  const timeWindow = Math.floor((hour ?? 0) * 2 + (minute ?? 0) / 30);
  return `supplementReminderShown_${today}_${timeWindow}_sup_${supplementId}_user_${userId}`;
};

const getTakenTodayKey = (userId: string, supplementId: number): string =>
  `supplementTakenToday_${new Date().toDateString()}_sup_${supplementId}_user_${userId}`;

// ─── Per-supplement evaluation ────────────────────────────────────────────────

async function evaluateSupplementReminder(
  userId: string,
  config: SupplementReminderConfig,
  latitude: number,
  longitude: number,
): Promise<boolean> {
  if (
    !config.enabled ||
    !config.locationBasedReminder ||
    !config.reminderLocation
  )
    return false;

  // No-op in Expo Go — remote/local push infra isn't available there.
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const takenKey = getTakenTodayKey(userId, config.supplementId);
  const takenToday = await getStorageItem(takenKey);
  if (takenToday) return false;

  const { lat, lng, radius } = config.reminderLocation;
  const distance = calculateDistance(latitude, longitude, lat, lng);
  const withinRadius = distance <= radius;

  logger.debug(
    `[${config.name}] Distance: ${distance.toFixed(0)}m/${radius}m ${withinRadius ? "✅" : "❌"}`,
  );

  if (!withinRadius) return false;

  let shouldFire = false;

  if (config.timeBasedEnabled) {
    const now = new Date();
    const [h, m] = config.reminderTime.split(":").map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = (h ?? 0) * 60 + (m ?? 0);
    shouldFire = currentMinutes >= targetMinutes;
  } else {
    shouldFire = true;
  }

  if (!shouldFire) return false;

  const shownKey = getReminderKey(
    userId,
    config.supplementId,
    config.reminderTime,
  );
  if (await getStorageItem(shownKey)) return false;

  logger.info(`[${config.name}] 🔔 Sending notification!`);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💊 Time for ${config.name}!`,
      body: `You're at ${config.reminderLocation.address}. Don't forget your ${config.defaultAmount}${config.unit} dose!`,
      data: { type: "supplement_reminder", supplementId: config.supplementId },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 250, 250, 250],
      ...(Platform.OS === "android" && { channelId: "supplement-reminders" }),
    },
    trigger: null,
  });

  await setStorageItem(shownKey, "true");
  return true;
}

// ─── Background task ──────────────────────────────────────────────────────────

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{
    locations: Location.LocationObject[];
  }>) => {
    if (error) {
      logger.error("❌ Location task error: " + error.message);
      return;
    }
    if (!data?.locations?.length) return;

    const location = data.locations[data.locations.length - 1];
    if (!location) return;

    const { latitude, longitude } = location.coords;
    logger.debug(
      `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    );

    try {
      const userDataStr = await getStorageItem("@user");
      if (!userDataStr) return;
      const userData = JSON.parse(userDataStr) as UserData;
      const userId = userData.id;

      const configsStr = await getStorageItem(
        STORAGE_KEY_SUPPLEMENT_CONFIGS(userId),
      );
      if (!configsStr) return;

      const configs = JSON.parse(configsStr) as SupplementReminderConfig[];

      for (const config of configs) {
        await evaluateSupplementReminder(userId, config, latitude, longitude);
      }
    } catch (err) {
      logger.error(
        "❌ Error: " + (err instanceof Error ? err.message : String(err)),
      );
    }
  },
);

// ─── Config management ────────────────────────────────────────────────────────

export const saveSupplementReminderConfig = async (
  userId: string,
  config: SupplementReminderConfig,
): Promise<void> => {
  const key = STORAGE_KEY_SUPPLEMENT_CONFIGS(userId);
  const existingStr = await getStorageItem(key);
  const configs: SupplementReminderConfig[] = existingStr
    ? (JSON.parse(existingStr) as SupplementReminderConfig[])
    : [];
  const idx = configs.findIndex((c) => c.supplementId === config.supplementId);
  if (idx >= 0) configs[idx] = config;
  else configs.push(config);
  await setStorageItem(key, JSON.stringify(configs));
};

export const removeSupplementReminderConfig = async (
  userId: string,
  supplementId: number,
): Promise<void> => {
  const key = STORAGE_KEY_SUPPLEMENT_CONFIGS(userId);
  const existingStr = await getStorageItem(key);
  if (!existingStr) return;
  const configs = (
    JSON.parse(existingStr) as SupplementReminderConfig[]
  ).filter((c) => c.supplementId !== supplementId);
  await setStorageItem(key, JSON.stringify(configs));
};

export const getSupplementReminderConfigs = async (
  userId: string,
): Promise<SupplementReminderConfig[]> => {
  try {
    const str = await getStorageItem(
      STORAGE_KEY_SUPPLEMENT_CONFIGS(userId),
    );
    return str ? (JSON.parse(str) as SupplementReminderConfig[]) : [];
  } catch {
    return [];
  }
};

/** Call after logging a supplement so the background task won't re-fire today. */
export const markSupplementTakenToday = async (
  userId: string,
  supplementId: number,
): Promise<void> => {
  await setStorageItem(getTakenTodayKey(userId, supplementId), "true");
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const initializeSupplementNotifications = async (): Promise<boolean> => {
  // Expo Go can't do push/remote notification setup — skip entirely rather
  // than let expo-notifications warn/throw.
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return false;

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync(
          "supplement-reminders",
          {
            name: "Supplement Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#667eea",
            // sound omitted — channel uses system default
            showBadge: true,
          },
        );
      } catch {
        // channel already exists – ignore
      }
    }
    return true;
  } catch {
    return false;
  }
};

export const scheduleTimeReminder = async (
  userId: string,
  supplementId: number,
  supplementName: string,
  defaultAmount: number,
  unit: string,
  reminderTime: string,
): Promise<string | null> => {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    const notifId = `supplement-time-${supplementId}`;
    // Cancel existing for this supplement
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier === notifId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const [hours, minutes] = reminderTime.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const seconds = Math.max(
      Math.floor((target.getTime() - now.getTime()) / 1000),
      1,
    );

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: `💊 Time for ${supplementName}!`,
        body: `It's ${reminderTime}. Don't forget your ${defaultAmount}${unit} dose!`,
        data: { type: "supplement_time_reminder", supplementId, userId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        ...(Platform.OS === "android" && { channelId: "supplement-reminders" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });

    await setStorageItem(
      `supplementTimeNotifId_${supplementId}_user_${userId}`,
      identifier,
    );
    return identifier;
  } catch {
    return null;
  }
};

export const cancelTimeReminder = async (
  supplementId: number,
): Promise<void> => {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    const notifId = `supplement-time-${supplementId}`;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier === notifId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // best-effort
  }
};

// ─── Battery optimization exemption ────────────────────────────────────────────

/**
 * Prompts the user to exempt the app from Android's battery optimization.
 * Without this, OEM battery managers (MIUI, Samsung, Huawei, etc.) can kill
 * the background location task even though it runs as a foreground service.
 */
export const requestIgnoreBatteryOptimizations = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${Application.applicationId}` },
    );
  } catch (error) {
    logger.error(
      "❌ Error requesting battery optimization exemption: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
};

// ─── Location task lifecycle ──────────────────────────────────────────────────

export const getBatterySettings = async (): Promise<BatterySettings> => {
  const fallback: BatterySettings = {
    preset: "MEDIUM",
    custom: false,
    ...BATTERY_PRESETS.MEDIUM,
  };
  try {
    const str = await getStorageItem("supplementBatterySettings");
    return str ? (JSON.parse(str) as BatterySettings) : fallback;
  } catch {
    return fallback;
  }
};

export const saveBatterySettings = async (
  preset: PresetKey,
  custom = false,
  customValues: CustomBatteryValues | null = null,
): Promise<BatterySettings> => {
  const settings: BatterySettings =
    custom && customValues
      ? { preset: "CUSTOM", custom: true, ...customValues }
      : {
          preset,
          custom: false,
          ...(preset !== "CUSTOM"
            ? BATTERY_PRESETS[preset]
            : BATTERY_PRESETS.MEDIUM),
        };
  await setStorageItem(
    "supplementBatterySettings",
    JSON.stringify(settings),
  );
  return settings;
};

export const registerLocationTask = async (): Promise<boolean> => {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      logger.info("🔄 Unregistering to update settings...");
    }

    const battery = await getBatterySettings();
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: battery.accuracy,
      timeInterval: battery.timeInterval,
      distanceInterval: battery.distanceInterval,
      showsBackgroundLocationIndicator: false,
    });

    logger.info("✅ Location task registered");
    return true;
  } catch (error) {
    logger.error(
      "❌ Error registering: " +
        (error instanceof Error ? error.message : String(error)),
    );
    return false;
  }
};

export const unregisterLocationTask = async (): Promise<boolean> => {
  try {
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      logger.info("✅ Task unregistered");
    }
    return true;
  } catch (error) {
    logger.error(
      "❌ Error unregistering: " +
        (error instanceof Error ? error.message : String(error)),
    );
    return false;
  }
};

export const isLocationTaskRegistered = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
};

export const triggerImmediateLocationCheck = async (): Promise<boolean> => {
  try {
    logger.debug("🚀 Immediate check...");

    let location: Location.LocationObject | null = null;
    try {
      const locPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000),
      );
      location = await Promise.race([locPromise, timeout]);
    } catch {
      location = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
      if (!location) return false;
    }

    const { latitude, longitude } = location.coords;

    const userDataStr = await getStorageItem("@user");
    if (!userDataStr) return false;
    const userData = JSON.parse(userDataStr) as UserData;
    const userId = userData.id;

    const configs = await getSupplementReminderConfigs(userId);
    let anyFired = false;
    for (const config of configs) {
      const fired = await evaluateSupplementReminder(
        userId,
        config,
        latitude,
        longitude,
      );
      if (fired) anyFired = true;
    }
    return anyFired;
  } catch {
    return false;
  }
};

