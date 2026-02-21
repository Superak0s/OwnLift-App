// tasks/creatineLocationTask.js
// Background location task for location-based creatine reminders

import { Platform } from "react-native"
import * as TaskManager from "expo-task-manager"
import * as Notifications from "expo-notifications"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"

const LOCATION_TASK_NAME = "creatine-location-reminder"
const TIME_NOTIFICATION_ID = "creatine-time-based-notification"
const MAX_DEBUG_LOGS = 50

// Battery impact presets
export const BATTERY_PRESETS = {
  LOW: {
    timeInterval: 1800000, // 30 minutes
    distanceInterval: 500, // 500 meters
    accuracy: Location.Accuracy.Low,
    label: "Low Impact",
    description: "Checks every 30 min, 500m movement",
  },
  MEDIUM: {
    timeInterval: 600000, // 10 minutes
    distanceInterval: 250, // 250 meters
    accuracy: Location.Accuracy.Balanced,
    label: "Medium Impact",
    description: "Checks every 10 min, 250m movement",
  },
  HIGH: {
    timeInterval: 300000, // 5 minutes
    distanceInterval: 100, // 100 meters
    accuracy: Location.Accuracy.High,
    label: "High Impact",
    description: "Checks every 5 min, 100m movement",
  },
}

try {
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  }
} catch (error) {
  console.log("Notifications not available in Expo Go:", error.message)
}

// Helper to write debug logs to AsyncStorage for viewing
const writeDebugLog = async (message) => {
  try {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`

    const existingLogsStr = await AsyncStorage.getItem("creatineDebugLogs")
    let logs = existingLogsStr ? JSON.parse(existingLogsStr) : []

    logs.push(logEntry)

    if (logs.length > MAX_DEBUG_LOGS) {
      logs = logs.slice(-MAX_DEBUG_LOGS)
    }

    await AsyncStorage.setItem("creatineDebugLogs", JSON.stringify(logs))
    console.log(message)
  } catch (error) {
    console.log(message)
  }
}

// Helper to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3
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

const isReminderTime = (reminderTime) => {
  const now = new Date()
  const [targetHour, targetMinute] = reminderTime.split(":").map(Number)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTotalMinutes = currentHour * 60 + currentMinute
  const targetTotalMinutes = targetHour * 60 + targetMinute
  const difference = Math.abs(currentTotalMinutes - targetTotalMinutes)
  return difference <= 30
}

const getReminderKey = (userId, reminderTime) => {
  const today = new Date().toDateString()
  const [hour, minute] = reminderTime.split(":").map(Number)
  const timeWindow = Math.floor(hour * 2 + minute / 30)
  return `creatineReminderShown_${today}_${timeWindow}_user_${userId}`
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    await writeDebugLog("❌ Location task error: " + error.message)
    return
  }

  if (data) {
    const { locations } = data
    if (!locations || locations.length === 0) return

    try {
      const location = locations[locations.length - 1]
      const { latitude, longitude } = location.coords

      await writeDebugLog(
        `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      )

      const userDataStr = await AsyncStorage.getItem("@user")
      if (!userDataStr) return

      const userData = JSON.parse(userDataStr)
      const userId = userData.id

      const creatineSettingsKey = `creatineSettings_user_${userId}`
      const settingsStr = await AsyncStorage.getItem(creatineSettingsKey)
      if (!settingsStr) return

      const settings = JSON.parse(settingsStr)

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
        const targetTotalMinutes = targetHour * 60 + targetMinute
        timePassed = currentTotalMinutes >= targetTotalMinutes
      }

      let locationConditionMet = true
      let distance = 0

      if (checkLocation) {
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
          body: `You're at ${settings.reminderLocation.address}. Don't forget your ${settings.defaultGrams || 5}g dose!`,
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
      await writeDebugLog("❌ Error: " + err.message)
    }
  }
})

export const getDebugLogs = async () => {
  try {
    const logsStr = await AsyncStorage.getItem("creatineDebugLogs")
    return logsStr ? JSON.parse(logsStr) : []
  } catch (error) {
    return []
  }
}

export const clearDebugLogs = async () => {
  try {
    await AsyncStorage.removeItem("creatineDebugLogs")
  } catch (error) {
    console.error("Error clearing debug logs:", error)
  }
}

export const getBatterySettings = async () => {
  try {
    const settingsStr = await AsyncStorage.getItem("creatineBatterySettings")
    if (settingsStr) {
      return JSON.parse(settingsStr)
    }

    return {
      preset: "MEDIUM",
      custom: false,
      timeInterval: BATTERY_PRESETS.MEDIUM.timeInterval,
      distanceInterval: BATTERY_PRESETS.MEDIUM.distanceInterval,
      accuracy: BATTERY_PRESETS.MEDIUM.accuracy,
    }
  } catch (error) {
    return {
      preset: "MEDIUM",
      custom: false,
      timeInterval: BATTERY_PRESETS.MEDIUM.timeInterval,
      distanceInterval: BATTERY_PRESETS.MEDIUM.distanceInterval,
      accuracy: BATTERY_PRESETS.MEDIUM.accuracy,
    }
  }
}

export const saveBatterySettings = async (
  preset,
  custom = false,
  customValues = null,
) => {
  try {
    let settings

    if (custom && customValues) {
      settings = {
        preset: "CUSTOM",
        custom: true,
        timeInterval: customValues.timeInterval,
        distanceInterval: customValues.distanceInterval,
        accuracy: customValues.accuracy,
      }
    } else {
      const presetConfig = BATTERY_PRESETS[preset]
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
  } catch (error) {
    console.error("Error saving battery settings:", error)
    throw error
  }
}

export const registerLocationTask = async () => {
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
    await writeDebugLog("❌ Error registering: " + error.message)
    return false
  }
}

export const unregisterLocationTask = async () => {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
      await writeDebugLog("✅ Task unregistered")
    }
    return true
  } catch (error) {
    await writeDebugLog("❌ Error unregistering: " + error.message)
    return false
  }
}

export const isLocationTaskRegistered = async () => {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
  } catch (error) {
    return false
  }
}

export const initializeCreatineNotifications = async () => {
  try {
    if (!Notifications || !Notifications.requestPermissionsAsync) {
      return false
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") {
      return false
    }

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
      } catch (error) {}
    }

    return true
  } catch (error) {
    return false
  }
}

export const clearOldReminderKeys = async (userId) => {
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
  } catch (error) {}
}

export const clearAllReminderKeys = async (userId) => {
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
  } catch (error) {}
}

export const scheduleDailyTimeReminder = async (
  userId,
  reminderTime,
  defaultGrams,
) => {
  try {
    await cancelTimeReminders()
    const [hours, minutes] = reminderTime.split(":").map(Number)
    const now = new Date()
    const target = new Date()
    target.setHours(hours, minutes, 0, 0)
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
          userId: userId,
          scheduledTime: reminderTime,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        ...(Platform.OS === "android" && { channelId: "creatine-reminders" }),
      },
      trigger: {
        type: "timeInterval",
        seconds: Math.max(secondsUntilTrigger, 1),
        repeats: false,
      },
    })

    await AsyncStorage.setItem(
      `creatineTimeNotificationId_user_${userId}`,
      identifier,
    )
    return identifier
  } catch (error) {
    return null
  }
}

export const rescheduleTimeReminder = async (
  userId,
  reminderTime,
  defaultGrams,
) => {
  try {
    await clearAllReminderKeys(userId)
    await scheduleDailyTimeReminder(userId, reminderTime, defaultGrams)
  } catch (error) {}
}

export const cancelTimeReminders = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const notification of scheduled) {
      if (
        notification.identifier === TIME_NOTIFICATION_ID ||
        notification.content?.data?.type === "creatine_time_reminder"
      ) {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier,
        )
      }
    }
    return true
  } catch (error) {
    return false
  }
}

export const triggerImmediateLocationCheck = async () => {
  try {
    await writeDebugLog("🚀 Immediate check...")

    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeoutMs: 5000,
      maximumAge: 10000,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000),
    )

    let location
    try {
      location = await Promise.race([locationPromise, timeoutPromise])
    } catch (error) {
      location = await Location.getLastKnownPositionAsync({ maxAge: 60000 })
      if (!location) return false
    }

    const { latitude, longitude } = location.coords
    const userDataStr = await AsyncStorage.getItem("@user")
    if (!userDataStr) return false

    const userData = JSON.parse(userDataStr)
    const userId = userData.id

    const creatineSettingsKey = `creatineSettings_user_${userId}`
    const settingsStr = await AsyncStorage.getItem(creatineSettingsKey)
    if (!settingsStr) return false

    const settings = JSON.parse(settingsStr)
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
      const targetTotalMinutes = targetHour * 60 + targetMinute
      const timePassed = currentTotalMinutes >= targetTotalMinutes

      if (timePassed && withinRadius) {
        shouldFire = true
      }
    } else if (checkLocation && withinRadius) {
      shouldFire = true
    }

    if (shouldFire) {
      const reminderShownKey = getReminderKey(userId, settings.reminderTime)
      const reminderShown = await AsyncStorage.getItem(reminderShownKey)
      if (reminderShown) return false

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Time for Creatine!",
          body: `You're at ${settings.reminderLocation.address}. Don't forget your ${settings.defaultGrams || 5}g dose!`,
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
    }

    return false
  } catch (error) {
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
