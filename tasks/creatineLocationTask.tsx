// tasks/creatineLocationTask.ts
// Background location task for location-based creatine reminders

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

export interface ReminderLocation {
  lat: number
  lng: number
  radius: number
  address: string
}

export interface CreatineSettings {
  locationBasedReminder: boolean
  timeBasedEnabled: boolean
  reminderTime: string
  reminderLocation: ReminderLocation | null
  defaultGrams?: number
  enabled: boolean
}

export interface UserData {
  id: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATION_TASK_NAME = "creatine-location-reminder"
const TIME_NOTIFICATION_ID = "creatine-time-based-notification"
const MAX_DEBUG_LOGS = 50

export const BATTERY_PRESETS: BatteryPresets = {
  LOW: {
    timeInterval: 1_800_000, // 30 minutes
    distanceInterval: 500,
    accuracy: Location.Accuracy.Low,
    label: "Low Impact",
    description: "Checks every 30 min, 500m movement",
  },
  MEDIUM: {
    timeInterval: 600_000, // 10 minutes
    distanceInterval: 250,
    accuracy: Location.Accuracy.Balanced,
    label: "Medium Impact",
    description: "Checks every 10 min, 250m movement",
  },
  HIGH: {
    timeInterval: 300_000, // 5 minutes
    distanceInterval: 100,
    accuracy: Location.Accuracy.High,
    label: "High Impact",
    description: "Checks every 5 min, 100m movement",
  },
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

const writeDebugLog = async (message: string): Promise<void> => {
  try {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`

    const existingLogsStr = await AsyncStorage.getItem("creatineDebugLogs")
    let logs: string[] = existingLogsStr
      ? (JSON.parse(existingLogsStr) as string[])
      : []

    logs.push(logEntry)
    if (logs.length > MAX_DEBUG_LOGS) {
      logs = logs.slice(-MAX_DEBUG_LOGS)
    }

    await AsyncStorage.setItem("creatineDebugLogs", JSON.stringify(logs))
    console.log(message)
  } catch {
    console.log(message)
  }
}

// ─── Haversine distance ───────────────────────────────────────────────────────

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
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

const isReminderTime = (reminderTime: string): boolean => {
  const now = new Date()
  const [targetHour, targetMinute] = reminderTime.split(":").map(Number)
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
  const targetTotalMinutes = (targetHour ?? 0) * 60 + (targetMinute ?? 0)
  return Math.abs(currentTotalMinutes - targetTotalMinutes) <= 30
}

const getReminderKey = (userId: string, reminderTime: string): string => {
  const today = new Date().toDateString()
  const [hour, minute] = reminderTime.split(":").map(Number)
  const timeWindow = Math.floor((hour ?? 0) * 2 + (minute ?? 0) / 30)
  return `creatineReminderShown_${today}_${timeWindow}_user_${userId}`
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

    if (!data) return

    const { locations } = data
    if (!locations?.length) return

    try {
      const location = locations[locations.length - 1]
      if (!location) return

      const { latitude, longitude } = location.coords

      await writeDebugLog(
        `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      )

      const userDataStr = await AsyncStorage.getItem("@user")
      if (!userDataStr) return

      const userData = JSON.parse(userDataStr) as UserData
      const userId = userData.id

      const creatineSettingsKey = `creatineSettings_user_${userId}`
      const settingsStr = await AsyncStorage.getItem(creatineSettingsKey)
      if (!settingsStr) return

      const settings = JSON.parse(settingsStr) as CreatineSettings

      if (!settings.locationBasedReminder || !settings.reminderLocation) return

      const today = new Date().toDateString()
      const lastTakenKey = `creatineLastTaken_user_${userId}`
      const lastTaken = await AsyncStorage.getItem(lastTakenKey)
      if (lastTaken === today) return

      const checkTime = settings.timeBasedEnabled === true
      const checkLocation = settings.locationBasedReminder === true

      let timeConditionMet = true
      let timePassed = false

      if (checkTime) {
        timeConditionMet = isReminderTime(settings.reminderTime)
        const now = new Date()
        const [targetHour, targetMinute] = settings.reminderTime
          .split(":")
          .map(Number)
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
        const targetTotalMinutes = (targetHour ?? 0) * 60 + (targetMinute ?? 0)
        timePassed = currentTotalMinutes >= targetTotalMinutes
      }

      let locationConditionMet = true
      let distance = 0

      if (checkLocation && settings.reminderLocation) {
        const { lat, lng, radius } = settings.reminderLocation
        distance = calculateDistance(latitude, longitude, lat, lng)
        locationConditionMet = distance <= radius
        await writeDebugLog(
          `📍 Distance: ${distance.toFixed(0)}m/${radius}m ${locationConditionMet ? "✅" : "❌"}`,
        )
      }

      let shouldFire = false

      if (checkTime && checkLocation) {
        if (timePassed && locationConditionMet) {
          shouldFire = true
          await writeDebugLog("🎯 Both conditions met!")
        }
      } else if (checkLocation && locationConditionMet) {
        shouldFire = true
        await writeDebugLog("🎯 Location met!")
      }

      if (!shouldFire) return

      const reminderShownKey = getReminderKey(userId, settings.reminderTime)
      const reminderShown = await AsyncStorage.getItem(reminderShownKey)
      if (reminderShown) return

      await writeDebugLog("🔔 Sending notification!")

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Time for Creatine!",
          body: `You're at ${settings.reminderLocation?.address}. Don't forget your ${settings.defaultGrams ?? 5}g dose!`,
          data: { type: "creatine_reminder" },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        },
        trigger: null,
      })

      await AsyncStorage.setItem(reminderShownKey, "true")
      await writeDebugLog("✅ Notification sent!")
    } catch (err) {
      await writeDebugLog(
        "❌ Error: " + (err instanceof Error ? err.message : String(err)),
      )
    }
  },
)

// ─── Public API ───────────────────────────────────────────────────────────────

export const getDebugLogs = async (): Promise<string[]> => {
  try {
    const logsStr = await AsyncStorage.getItem("creatineDebugLogs")
    return logsStr ? (JSON.parse(logsStr) as string[]) : []
  } catch {
    return []
  }
}

export const clearDebugLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem("creatineDebugLogs")
  } catch (error) {
    console.error("Error clearing debug logs:", error)
  }
}

export const getBatterySettings = async (): Promise<BatterySettings> => {
  const fallback: BatterySettings = {
    preset: "MEDIUM",
    custom: false,
    timeInterval: BATTERY_PRESETS.MEDIUM.timeInterval,
    distanceInterval: BATTERY_PRESETS.MEDIUM.distanceInterval,
    accuracy: BATTERY_PRESETS.MEDIUM.accuracy,
  }

  try {
    const settingsStr = await AsyncStorage.getItem("creatineBatterySettings")
    if (settingsStr) {
      return JSON.parse(settingsStr) as BatterySettings
    }
    return fallback
  } catch {
    return fallback
  }
}

export const saveBatterySettings = async (
  preset: PresetKey,
  custom = false,
  customValues: CustomBatteryValues | null = null,
): Promise<BatterySettings> => {
  let settings: BatterySettings

  if (custom && customValues) {
    settings = {
      preset: "CUSTOM",
      custom: true,
      timeInterval: customValues.timeInterval,
      distanceInterval: customValues.distanceInterval,
      accuracy: customValues.accuracy,
    }
  } else {
    const presetConfig =
      preset !== "CUSTOM" ? BATTERY_PRESETS[preset] : BATTERY_PRESETS.MEDIUM
    settings = {
      preset,
      custom: false,
      timeInterval: presetConfig.timeInterval,
      distanceInterval: presetConfig.distanceInterval,
      accuracy: presetConfig.accuracy,
    }
  }

  await AsyncStorage.setItem(
    "creatineBatterySettings",
    JSON.stringify(settings),
  )
  console.log(`✅ Battery settings saved: ${settings.preset}`)
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

    const batterySettings = await getBatterySettings()

    await writeDebugLog(`⚙️ Battery: ${batterySettings.preset}`)
    await writeDebugLog(
      `   ${batterySettings.timeInterval / 1000 / 60}min, ${batterySettings.distanceInterval}m`,
    )

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: batterySettings.accuracy,
      timeInterval: batterySettings.timeInterval,
      distanceInterval: batterySettings.distanceInterval,
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
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
    if (isRegistered) {
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

export const initializeCreatineNotifications = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") return false

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("creatine-reminders", {
          name: "Creatine Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#667eea",
          sound: "default",
          showBadge: true,
        })
      } catch {
        // channel already exists or unsupported – ignore
      }
    }

    return true
  } catch {
    return false
  }
}

export const clearOldReminderKeys = async (userId: string): Promise<void> => {
  try {
    const today = new Date().toDateString()
    const allKeys = await AsyncStorage.getAllKeys()
    const oldKeys = allKeys.filter(
      (key) =>
        key.startsWith("creatineReminderShown_") &&
        key.includes(`user_${userId}`) &&
        !key.includes(today),
    )
    if (oldKeys.length > 0) {
      await AsyncStorage.multiRemove(oldKeys)
    }
  } catch {
    // best-effort cleanup
  }
}

export const clearAllReminderKeys = async (userId: string): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys()
    const reminderKeys = allKeys.filter(
      (key) =>
        key.startsWith("creatineReminderShown_") &&
        key.includes(`user_${userId}`),
    )
    if (reminderKeys.length > 0) {
      await AsyncStorage.multiRemove(reminderKeys)
    }
  } catch {
    // best-effort cleanup
  }
}

export const scheduleDailyTimeReminder = async (
  userId: string,
  reminderTime: string,
  defaultGrams: number,
): Promise<string | null> => {
  try {
    await cancelTimeReminders()
    const [hours, minutes] = reminderTime.split(":").map(Number)
    const now = new Date()
    const target = new Date()
    target.setHours(hours ?? 0, minutes ?? 0, 0, 0)
    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }
    const secondsUntilTrigger = Math.floor(
      (target.getTime() - now.getTime()) / 1000,
    )

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: TIME_NOTIFICATION_ID,
      content: {
        title: "💊 Time for Creatine!",
        body: `It's ${reminderTime}. Don't forget your ${defaultGrams}g dose!`,
        data: {
          type: "creatine_time_reminder",
          userId,
          scheduledTime: reminderTime,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        ...(Platform.OS === "android" && { channelId: "creatine-reminders" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(secondsUntilTrigger, 1),
        repeats: false,
      },
    })

    await AsyncStorage.setItem(
      `creatineTimeNotificationId_user_${userId}`,
      identifier,
    )
    return identifier
  } catch {
    return null
  }
}

export const rescheduleTimeReminder = async (
  userId: string,
  reminderTime: string,
  defaultGrams: number,
): Promise<void> => {
  try {
    await clearAllReminderKeys(userId)
    await scheduleDailyTimeReminder(userId, reminderTime, defaultGrams)
  } catch {
    // best-effort
  }
}

export const cancelTimeReminders = async (): Promise<boolean> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const notification of scheduled) {
      if (
        notification.identifier === TIME_NOTIFICATION_ID ||
        (notification.content?.data as Record<string, unknown>)?.type ===
          "creatine_time_reminder"
      ) {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier,
        )
      }
    }
    return true
  } catch {
    return false
  }
}

export const triggerImmediateLocationCheck = async (): Promise<boolean> => {
  try {
    await writeDebugLog("🚀 Immediate check...")

    let location: Location.LocationObject | null = null

    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000),
      )
      location = await Promise.race([locationPromise, timeoutPromise])
    } catch {
      location = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
      if (!location) return false
    }

    const { latitude, longitude } = location.coords

    const userDataStr = await AsyncStorage.getItem("@user")
    if (!userDataStr) return false

    const userData = JSON.parse(userDataStr) as UserData
    const userId = userData.id

    const creatineSettingsKey = `creatineSettings_user_${userId}`
    const settingsStr = await AsyncStorage.getItem(creatineSettingsKey)
    if (!settingsStr) return false

    const settings = JSON.parse(settingsStr) as CreatineSettings
    if (!settings.locationBasedReminder || !settings.reminderLocation)
      return false

    const today = new Date().toDateString()
    const lastTakenKey = `creatineLastTaken_user_${userId}`
    const lastTaken = await AsyncStorage.getItem(lastTakenKey)
    if (lastTaken === today) return false

    const { lat, lng, radius } = settings.reminderLocation
    const distance = calculateDistance(latitude, longitude, lat, lng)
    const withinRadius = distance <= radius

    const checkTime = settings.timeBasedEnabled === true
    const checkLocation = settings.locationBasedReminder === true

    let shouldFire = false

    if (checkTime && checkLocation) {
      const now = new Date()
      const [targetHour, targetMinute] = settings.reminderTime
        .split(":")
        .map(Number)
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
      const targetTotalMinutes = (targetHour ?? 0) * 60 + (targetMinute ?? 0)
      if (currentTotalMinutes >= targetTotalMinutes && withinRadius) {
        shouldFire = true
      }
    } else if (checkLocation && withinRadius) {
      shouldFire = true
    }

    if (!shouldFire) return false

    const reminderShownKey = getReminderKey(userId, settings.reminderTime)
    const reminderShown = await AsyncStorage.getItem(reminderShownKey)
    if (reminderShown) return false

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 Time for Creatine!",
        body: `You're at ${settings.reminderLocation.address}. Don't forget your ${settings.defaultGrams ?? 5}g dose!`,
        data: { type: "creatine_reminder" },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
      },
      trigger: null,
    })

    await AsyncStorage.setItem(reminderShownKey, "true")
    await writeDebugLog("✅ Notification sent!")
    return true
  } catch {
    return false
  }
}

export default {
  LOCATION_TASK_NAME,
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeCreatineNotifications,
  clearOldReminderKeys,
  clearAllReminderKeys,
  scheduleDailyTimeReminder,
  rescheduleTimeReminder,
  cancelTimeReminders,
  getDebugLogs,
  clearDebugLogs,
  triggerImmediateLocationCheck,
  getBatterySettings,
  saveBatterySettings,
  BATTERY_PRESETS,
}
