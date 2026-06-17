// tasks/supplementLocationTask.ts
// Generic background location task for supplement reminders.
// Replaces the creatine-specific creatineLocationTask.ts.
// The old LOCATION_TASK_NAME ("creatine-location-reminder") is preserved
// so existing registered tasks survive an app update without needing a restart.

import { Platform } from "react-native"
import * as TaskManager from "expo-task-manager"
import * as Notifications from "expo-notifications"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatteryPreset {
  timeInterval: number
  distanceInterval: number
  accuracy: Location.Accuracy
  label: string
  description: string
}

export interface BatteryPresets {
  LOW: BatteryPreset
  MEDIUM: BatteryPreset
  HIGH: BatteryPreset
}

export type PresetKey = keyof BatteryPresets | "CUSTOM"

export interface BatterySettings {
  preset: PresetKey
  custom: boolean
  timeInterval: number
  distanceInterval: number
  accuracy: Location.Accuracy
}

export interface CustomBatteryValues {
  timeInterval: number
  distanceInterval: number
  accuracy: Location.Accuracy
}

export interface SupplementReminderLocation {
  lat: number
  lng: number
  radius: number
  address: string
}

/** Per-supplement reminder config stored in AsyncStorage. */
export interface SupplementReminderConfig {
  supplementId: number
  name: string
  unit: string
  defaultAmount: number
  locationBasedReminder: boolean
  timeBasedEnabled: boolean
  reminderTime: string
  reminderLocation: SupplementReminderLocation | null
  enabled: boolean
}

export interface UserData {
  id: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Keep old name so existing background task registrations survive the update
export const LOCATION_TASK_NAME = "creatine-location-reminder"

const MAX_DEBUG_LOGS = 50
const STORAGE_KEY_SUPPLEMENT_CONFIGS = (userId: string) =>
  `supplementReminderConfigs_user_${userId}`

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
}

// ─── Debug ────────────────────────────────────────────────────────────────────

const writeDebugLog = async (message: string): Promise<void> => {
  try {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    const existingLogsStr = await AsyncStorage.getItem("supplementDebugLogs")
    let logs: string[] = existingLogsStr
      ? (JSON.parse(existingLogsStr) as string[])
      : []
    logs.push(logEntry)
    if (logs.length > MAX_DEBUG_LOGS) logs = logs.slice(-MAX_DEBUG_LOGS)
    await AsyncStorage.setItem("supplementDebugLogs", JSON.stringify(logs))
    console.log(message)
  } catch {
    console.log(message)
  }
}

// ─── Haversine ────────────────────────────────────────────────────────────────

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6_371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Reminder key helpers ─────────────────────────────────────────────────────

const getReminderKey = (
  userId: string,
  supplementId: number,
  reminderTime: string,
): string => {
  const today = new Date().toDateString()
  const [hour, minute] = reminderTime.split(":").map(Number)
  const timeWindow = Math.floor((hour ?? 0) * 2 + (minute ?? 0) / 30)
  return `supplementReminderShown_${today}_${timeWindow}_sup_${supplementId}_user_${userId}`
}

const getTakenTodayKey = (userId: string, supplementId: number): string =>
  `supplementTakenToday_${new Date().toDateString()}_sup_${supplementId}_user_${userId}`

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
    return false

  const takenKey = getTakenTodayKey(userId, config.supplementId)
  const takenToday = await AsyncStorage.getItem(takenKey)
  if (takenToday) return false

  const { lat, lng, radius } = config.reminderLocation
  const distance = calculateDistance(latitude, longitude, lat, lng)
  const withinRadius = distance <= radius

  await writeDebugLog(
    `[${config.name}] Distance: ${distance.toFixed(0)}m/${radius}m ${withinRadius ? "✅" : "❌"}`,
  )

  if (!withinRadius) return false

  let shouldFire = false

  if (config.timeBasedEnabled) {
    const now = new Date()
    const [h, m] = config.reminderTime.split(":").map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const targetMinutes = (h ?? 0) * 60 + (m ?? 0)
    shouldFire = currentMinutes >= targetMinutes
  } else {
    shouldFire = true
  }

  if (!shouldFire) return false

  const shownKey = getReminderKey(
    userId,
    config.supplementId,
    config.reminderTime,
  )
  if (await AsyncStorage.getItem(shownKey)) return false

  await writeDebugLog(`[${config.name}] 🔔 Sending notification!`)

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
  })

  await AsyncStorage.setItem(shownKey, "true")
  return true
}

// ─── Background task ──────────────────────────────────────────────────────────

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{
    locations: Location.LocationObject[]
  }>) => {
    if (error) {
      await writeDebugLog("❌ Location task error: " + error.message)
      return
    }
    if (!data?.locations?.length) return

    const location = data.locations[data.locations.length - 1]
    if (!location) return

    const { latitude, longitude } = location.coords
    await writeDebugLog(
      `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    )

    try {
      const userDataStr = await AsyncStorage.getItem("@user")
      if (!userDataStr) return
      const userData = JSON.parse(userDataStr) as UserData
      const userId = userData.id

      const configsStr = await AsyncStorage.getItem(
        STORAGE_KEY_SUPPLEMENT_CONFIGS(userId),
      )
      if (!configsStr) return

      const configs = JSON.parse(configsStr) as SupplementReminderConfig[]

      for (const config of configs) {
        await evaluateSupplementReminder(userId, config, latitude, longitude)
      }
    } catch (err) {
      await writeDebugLog(
        "❌ Error: " + (err instanceof Error ? err.message : String(err)),
      )
    }
  },
)

// ─── Config management ────────────────────────────────────────────────────────

export const saveSupplementReminderConfig = async (
  userId: string,
  config: SupplementReminderConfig,
): Promise<void> => {
  const key = STORAGE_KEY_SUPPLEMENT_CONFIGS(userId)
  const existingStr = await AsyncStorage.getItem(key)
  const configs: SupplementReminderConfig[] = existingStr
    ? (JSON.parse(existingStr) as SupplementReminderConfig[])
    : []
  const idx = configs.findIndex((c) => c.supplementId === config.supplementId)
  if (idx >= 0) configs[idx] = config
  else configs.push(config)
  await AsyncStorage.setItem(key, JSON.stringify(configs))
}

export const removeSupplementReminderConfig = async (
  userId: string,
  supplementId: number,
): Promise<void> => {
  const key = STORAGE_KEY_SUPPLEMENT_CONFIGS(userId)
  const existingStr = await AsyncStorage.getItem(key)
  if (!existingStr) return
  const configs = (
    JSON.parse(existingStr) as SupplementReminderConfig[]
  ).filter((c) => c.supplementId !== supplementId)
  await AsyncStorage.setItem(key, JSON.stringify(configs))
}

export const getSupplementReminderConfigs = async (
  userId: string,
): Promise<SupplementReminderConfig[]> => {
  try {
    const str = await AsyncStorage.getItem(
      STORAGE_KEY_SUPPLEMENT_CONFIGS(userId),
    )
    return str ? (JSON.parse(str) as SupplementReminderConfig[]) : []
  } catch {
    return []
  }
}

/** Call after logging a supplement so the background task won't re-fire today. */
export const markSupplementTakenToday = async (
  userId: string,
  supplementId: number,
): Promise<void> => {
  await AsyncStorage.setItem(getTakenTodayKey(userId, supplementId), "true")
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const initializeSupplementNotifications = async (): Promise<boolean> => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== "granted") return false

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync(
          "supplement-reminders",
          {
            name: "Supplement Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#667eea",
            sound: "default",
            showBadge: true,
          },
        )
      } catch {
        // channel already exists – ignore
      }
    }
    return true
  } catch {
    return false
  }
}

export const scheduleTimeReminder = async (
  userId: string,
  supplementId: number,
  supplementName: string,
  defaultAmount: number,
  unit: string,
  reminderTime: string,
): Promise<string | null> => {
  try {
    const notifId = `supplement-time-${supplementId}`
    // Cancel existing for this supplement
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const n of scheduled) {
      if (n.identifier === notifId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier)
      }
    }

    const [hours, minutes] = reminderTime.split(":").map(Number)
    const now = new Date()
    const target = new Date()
    target.setHours(hours ?? 0, minutes ?? 0, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)

    const seconds = Math.max(
      Math.floor((target.getTime() - now.getTime()) / 1000),
      1,
    )

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
    })

    await AsyncStorage.setItem(
      `supplementTimeNotifId_${supplementId}_user_${userId}`,
      identifier,
    )
    return identifier
  } catch {
    return null
  }
}

export const cancelTimeReminder = async (
  supplementId: number,
): Promise<void> => {
  try {
    const notifId = `supplement-time-${supplementId}`
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const n of scheduled) {
      if (n.identifier === notifId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier)
      }
    }
  } catch {
    // best-effort
  }
}

// ─── Location task lifecycle ──────────────────────────────────────────────────

export const getBatterySettings = async (): Promise<BatterySettings> => {
  const fallback: BatterySettings = {
    preset: "MEDIUM",
    custom: false,
    ...BATTERY_PRESETS.MEDIUM,
  }
  try {
    const str = await AsyncStorage.getItem("supplementBatterySettings")
    return str ? (JSON.parse(str) as BatterySettings) : fallback
  } catch {
    return fallback
  }
}

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
        }
  await AsyncStorage.setItem(
    "supplementBatterySettings",
    JSON.stringify(settings),
  )
  return settings
}

export const registerLocationTask = async (): Promise<boolean> => {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
      await writeDebugLog("🔄 Unregistering to update settings...")
    }

    const battery = await getBatterySettings()
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: battery.accuracy,
      timeInterval: battery.timeInterval,
      distanceInterval: battery.distanceInterval,
      showsBackgroundLocationIndicator: false,
    })

    await writeDebugLog("✅ Location task registered")
    return true
  } catch (error) {
    await writeDebugLog(
      "❌ Error registering: " +
        (error instanceof Error ? error.message : String(error)),
    )
    return false
  }
}

export const unregisterLocationTask = async (): Promise<boolean> => {
  try {
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
      await writeDebugLog("✅ Task unregistered")
    }
    return true
  } catch (error) {
    await writeDebugLog(
      "❌ Error unregistering: " +
        (error instanceof Error ? error.message : String(error)),
    )
    return false
  }
}

export const isLocationTaskRegistered = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
  } catch {
    return false
  }
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

export const getDebugLogs = async (): Promise<string[]> => {
  try {
    const str = await AsyncStorage.getItem("supplementDebugLogs")
    return str ? (JSON.parse(str) as string[]) : []
  } catch {
    return []
  }
}

export const clearDebugLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem("supplementDebugLogs")
  } catch (error) {
    console.error("Error clearing debug logs:", error)
  }
}

export const triggerImmediateLocationCheck = async (): Promise<boolean> => {
  try {
    await writeDebugLog("🚀 Immediate check...")

    let location: Location.LocationObject | null = null
    try {
      const locPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000),
      )
      location = await Promise.race([locPromise, timeout])
    } catch {
      location = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
      if (!location) return false
    }

    const { latitude, longitude } = location.coords

    const userDataStr = await AsyncStorage.getItem("@user")
    if (!userDataStr) return false
    const userData = JSON.parse(userDataStr) as UserData
    const userId = userData.id

    const configs = await getSupplementReminderConfigs(userId)
    let anyFired = false
    for (const config of configs) {
      const fired = await evaluateSupplementReminder(
        userId,
        config,
        latitude,
        longitude,
      )
      if (fired) anyFired = true
    }
    return anyFired
  } catch {
    return false
  }
}

export default {
  LOCATION_TASK_NAME,
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeSupplementNotifications,
  saveSupplementReminderConfig,
  removeSupplementReminderConfig,
  getSupplementReminderConfigs,
  markSupplementTakenToday,
  scheduleTimeReminder,
  cancelTimeReminder,
  getDebugLogs,
  clearDebugLogs,
  triggerImmediateLocationCheck,
  getBatterySettings,
  saveBatterySettings,
  BATTERY_PRESETS,
}
