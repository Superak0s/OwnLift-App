import React, { useState, useEffect } from "react"
import type {
  WorkoutData,
  CompletedDays,
  LockedDays,
  PendingSync,
} from "../types/index"
import type { User } from "../context/AuthContext"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "../context/AuthContext"
import DateTimePicker from "@react-native-community/datetimepicker"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  getServerUrl,
  setServerUrl,
  resetServerUrl,
  getDefaultServerUrl,
  bodyTrackingApi,
  creatineApi,
  getSessionHistory,
} from "../services/api"
import {
  scheduleDailyTimeReminder,
  cancelTimeReminders,
  clearAllReminderKeys,
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeCreatineNotifications,
  triggerImmediateLocationCheck,
  getBatterySettings,
  BATTERY_PRESETS,
} from "../../tasks/creatineLocationTask"
import CreatineLocationPicker from "../components/CreatineLocationPicker"
import BatterySettingsModal from "../components/BatterySettingsModal"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"

export default function SettingsScreen(): React.JSX.Element {
  const { user, logout } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const {
    workoutData,
    selectedPerson,
    currentDay,
    completedDays,
    lockedDays,
    timeBetweenSets,
    isDemoMode,
    serverAnalytics,
    useManualTime,
    pendingSyncs,
    isSyncing,
    workoutStartTime,
    currentSessionId,
    saveSelectedPerson,
    saveCurrentDay,
    saveCompletedDays,
    saveLockedDays,
    saveTimeBetweenSets,
    toggleUseManualTime,
    toggleDemoMode,
    clearAllData,
    syncPendingData,
    clearActiveWorkout,
    saveUnlockedOverrides,
    unlockedOverrides,
  } = useWorkout()

  const [showTimeBetweenSetsModal, setShowTimeBetweenSetsModal] =
    useState<boolean>(false)
  const [tempTimeBetweenSets, setTempTimeBetweenSets] = useState<string>("")
  const [showServerUrlModal, setShowServerUrlModal] = useState<boolean>(false)
  const [tempServerUrl, setTempServerUrl] = useState<string>("")
  const [currentServerUrl, setCurrentServerUrl] = useState<string>("")
  const [showResetDayModal, setShowResetDayModal] = useState<boolean>(false)
  const [selectedDayToReset, setSelectedDayToReset] = useState<number | null>(
    null,
  )

  // Creatine reminder settings
  const [creatineTimeBasedEnabled, setCreatineTimeBasedEnabled] =
    useState<boolean>(false)
  const [creatineLocationBasedEnabled, setCreatineLocationBasedEnabled] =
    useState<boolean>(false)
  const [creatineReminderTime, setCreatineReminderTime] = useState<Date>(
    new Date(),
  )
  const [showCreatineTimePicker, setShowCreatineTimePicker] =
    useState<boolean>(false)
  const [creatineDefaultGrams, setCreatineDefaultGrams] = useState<string>("5")
  const [creatineNotificationType, setCreatineNotificationType] =
    useState<string>("notification")
  const [reminderLocation, setReminderLocation] = useState<any>(null)
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false)
  const [showCreatineSettings, setShowCreatineSettings] =
    useState<boolean>(false)

  const [showBatterySettings, setShowBatterySettings] = useState<boolean>(false)
  const [batteryPreset, setBatteryPreset] = useState<string>("MEDIUM")

  const [serverProgress, setServerProgress] = useState<{
    daysCount?: number
    setsCount?: number
    lockedCount?: number
    [key: string]: unknown
  } | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false)

  useEffect(() => {
    setCurrentServerUrl(getServerUrl())
    loadCreatineSettings()
    loadServerProgress()
  }, [])

  // Check task status on mount
  useEffect(() => {
    const checkTaskStatus = async () => {
      try {
        const isRegistered = await isLocationTaskRegistered()
        console.log("🔍 Location task registered:", isRegistered)

        if (isRegistered && user?.id) {
          const settingsKey = `creatineSettings_user_${(user as any)?.id}`
          const settingsStr = await AsyncStorage.getItem(settingsKey)
          if (settingsStr) {
            const settings = JSON.parse(settingsStr)
            console.log("📋 Loaded settings from AsyncStorage:", settings)
          }
        }
      } catch (error: any) {
        console.error("Error checking task status:", error)
      }
    }

    if (user?.id) {
      checkTaskStatus()
    }
  }, [user?.id])

  useEffect(() => {
    const loadBatterySettings = async () => {
      const settings = await getBatterySettings()
      setBatteryPreset(settings.preset)
    }
    loadBatterySettings()
  }, [])

  const loadServerProgress = async () => {
    if (!selectedPerson) return
    setLoadingProgress(true)
    try {
      const sessions = await getSessionHistory(selectedPerson, null, 100)
      if (!sessions || sessions.length === 0) {
        setServerProgress({ daysCount: 0, setsCount: 0, lockedCount: 0 })
        return
      }

      const daysSeen = new Set()
      const lockedDaysSeen = new Set()
      let totalSets = 0

      for (const session of sessions) {
        daysSeen.add(session.day_number)
        if (session.end_time) {
          lockedDaysSeen.add(session.day_number)
        }
        totalSets += (session as any).set_count || 0
      }

      setServerProgress({
        daysCount: daysSeen.size,
        setsCount: totalSets,
        lockedCount: lockedDaysSeen.size,
      })
    } catch (error: any) {
      console.error("Error loading server progress:", error)
    } finally {
      setLoadingProgress(false)
    }
  }

  const loadCreatineSettings = async () => {
    try {
      console.log("📥 Loading creatine settings...")

      if (!user?.id) {
        console.log("⚠️ No user ID, skipping load")
        return
      }

      const settingsKey = `creatineSettings_user_${(user as any)?.id}`
      const settingsStr = await AsyncStorage.getItem(settingsKey)

      let hasValidLocalSettings = false

      if (settingsStr) {
        const settings = JSON.parse(settingsStr)
        console.log("📱 Loaded settings from AsyncStorage:", settings)

        setCreatineTimeBasedEnabled(settings.timeBasedEnabled || false)
        setCreatineLocationBasedEnabled(settings.locationBasedReminder || false)
        setCreatineDefaultGrams(String(settings.defaultGrams || 5))
        setCreatineNotificationType(settings.notificationType || "notification")

        if (settings.reminderLocation) {
          setReminderLocation(settings.reminderLocation)
          console.log(
            "✅ Loaded location from AsyncStorage:",
            settings.reminderLocation.address,
          )
        }

        if (settings.reminderTime) {
          const [hours, minutes] = settings.reminderTime.split(":")
          const date = new Date()
          date.setHours(parseInt(hours, 10))
          date.setMinutes(parseInt(minutes, 10))
          setCreatineReminderTime(date)
        }

        hasValidLocalSettings =
          settings.locationBasedReminder || settings.timeBasedEnabled

        console.log("✅ State updated from AsyncStorage:", {
          timeBasedEnabled: settings.timeBasedEnabled,
          locationBasedEnabled: settings.locationBasedReminder,
          hasValidSettings: hasValidLocalSettings,
        })
      }

      try {
        const status: any = await bodyTrackingApi.getCreatineStatus()
        console.log("🔍 Server status:", status)

        if (status.settings) {
          const serverHasTimeBasedField =
            status.settings.hasOwnProperty("timeBasedEnabled")
          const serverHasLocationBasedField = status.settings.hasOwnProperty(
            "locationBasedEnabled",
          )

          if (
            hasValidLocalSettings &&
            (!serverHasTimeBasedField || !serverHasLocationBasedField)
          ) {
            console.log(
              "⚠️ Local settings are valid but server data is incomplete, keeping local",
            )
            return
          }

          if (serverHasTimeBasedField && serverHasLocationBasedField) {
            const timeBasedEnabled = status.settings.timeBasedEnabled || false
            const locationBasedEnabled =
              status.settings.locationBasedEnabled || false

            setCreatineTimeBasedEnabled(timeBasedEnabled)
            setCreatineLocationBasedEnabled(locationBasedEnabled)
            setCreatineDefaultGrams(String(status.settings.defaultGrams || 5))
            setCreatineNotificationType(
              status.settings.notificationType || "notification",
            )

            if (status.settings.reminderTime) {
              const [hours, minutes] = status.settings.reminderTime.split(":")
              const date = new Date()
              date.setHours(parseInt(hours, 10))
              date.setMinutes(parseInt(minutes, 10))
              setCreatineReminderTime(date)
            }
          }
        }

        const locationData: any = await creatineApi.getReminderLocation()

        if (locationData.location) {
          const location = {
            lat: locationData.location.latitude,
            lng: locationData.location.longitude,
            address: locationData.location.address,
            radius: locationData.location.radius,
          }
          setReminderLocation(location)

          if (
            status.settings?.hasOwnProperty("timeBasedEnabled") &&
            status.settings?.hasOwnProperty("locationBasedEnabled")
          ) {
            const creatineSettings = {
              locationBasedReminder:
                status.settings.locationBasedEnabled || false,
              reminderLocation: location,
              reminderTime: status.settings.reminderTime || "09:00",
              enabled: true,
              timeBasedEnabled: status.settings.timeBasedEnabled || false,
              defaultGrams: status.settings.defaultGrams || 5,
              notificationType:
                status.settings.notificationType || "notification",
            }

            await AsyncStorage.setItem(
              settingsKey,
              JSON.stringify(creatineSettings),
            )
          }
        }
      } catch (serverError: any) {
        console.log(
          "⚠️ Server sync failed, using local data:",
          serverError.message,
        )
      }
    } catch (error: any) {
      console.error("❌ Error loading creatine settings:", error)
    }
  }

  const handleSaveCreatineSettings = async () => {
    try {
      if (!creatineTimeBasedEnabled && !creatineLocationBasedEnabled) {
        alert(
          "Enable a Condition",
          "Please enable at least one reminder condition (time or location).",
          [{ text: "OK" }],
          "warning",
        )
        return
      }

      if (creatineLocationBasedEnabled && !reminderLocation) {
        alert(
          "Set Location",
          "Please set a reminder location before enabling location-based reminders.",
          [{ text: "OK" }],
          "warning",
        )
        return
      }

      const grams = parseFloat(creatineDefaultGrams)
      if (isNaN(grams) || grams <= 0) {
        alert(
          "Invalid Amount",
          "Please enter a valid number of grams.",
          [{ text: "OK" }],
          "error",
        )
        return
      }

      const notificationsReady = await initializeCreatineNotifications()
      if (!notificationsReady) {
        alert(
          "Notifications Required",
          "Please enable notifications for reminders to work.",
          [{ text: "OK" }],
          "warning",
        )
        return
      }

      if (creatineLocationBasedEnabled) {
        const { status: foregroundStatus } =
          await Location.requestForegroundPermissionsAsync()
        if (foregroundStatus !== "granted") {
          alert(
            "Permission Required",
            "Location access is needed for location-based reminders.",
            [{ text: "OK" }],
            "warning",
          )
          return
        }

        if (Platform.OS === "android") {
          const { status: backgroundStatus } =
            await Location.requestBackgroundPermissionsAsync()
          if (backgroundStatus !== "granted") {
            alert(
              "Background Permission Required",
              "Background location access is needed for location-based reminders to work when the app is closed.\n\nPlease select 'Allow all the time' in the next screen.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => Linking.openSettings(),
                },
              ],
              "warning",
            )
            return
          }
        }
      }

      const reminderTimeStr = `${creatineReminderTime.getHours().toString().padStart(2, "0")}:${creatineReminderTime.getMinutes().toString().padStart(2, "0")}`

      await bodyTrackingApi.saveCreatineSettings(
        creatineTimeBasedEnabled,
        creatineLocationBasedEnabled,
        reminderTimeStr,
        grams,
        creatineNotificationType,
      )

      if (user?.id) {
        const creatineSettings = {
          locationBasedReminder: creatineLocationBasedEnabled,
          reminderLocation: reminderLocation,
          reminderTime: reminderTimeStr,
          enabled: true,
          timeBasedEnabled: creatineTimeBasedEnabled,
          defaultGrams: grams,
          notificationType: creatineNotificationType,
        }

        const settingsKey = `creatineSettings_user_${(user as any)?.id}`
        await AsyncStorage.setItem(
          settingsKey,
          JSON.stringify(creatineSettings),
        )
        await clearAllReminderKeys((user as any)?.id)
      }

      if (creatineTimeBasedEnabled && !creatineLocationBasedEnabled) {
        await cancelTimeReminders()

        const isRegistered = await isLocationTaskRegistered()
        if (isRegistered) {
          await unregisterLocationTask()
        }

        const identifier = await scheduleDailyTimeReminder(
          (user as any)?.id,
          reminderTimeStr,
          grams,
        )

        if (!identifier) {
          alert(
            "Warning",
            "Could not schedule time-based notification. Please try again.",
            [{ text: "OK" }],
            "warning",
          )
        }
      } else if (creatineLocationBasedEnabled) {
        await cancelTimeReminders()

        const registered = await registerLocationTask()
        if (!registered) {
          alert(
            "Warning",
            "Location tracking may not work properly. Please check permissions.",
            [{ text: "OK" }],
            "warning",
          )
        } else {
          await triggerImmediateLocationCheck()
        }
      }

      setShowCreatineSettings(false)

      let successMessage = "Creatine reminder settings saved!"
      if (creatineTimeBasedEnabled && !creatineLocationBasedEnabled) {
        successMessage += ` You'll get a notification at ${reminderTimeStr} each day.`
      } else if (creatineLocationBasedEnabled && !creatineTimeBasedEnabled) {
        successMessage += ` You'll get a notification when you arrive at your location. Background checks run every 10 minutes.`
      } else {
        successMessage += ` You'll get a notification at ${reminderTimeStr} when you're at your location. Background checks run every 10 minutes.`
      }

      alert("✅ Success", successMessage, [{ text: "OK" }], "success")
    } catch (error: any) {
      console.error("Error saving creatine settings:", error)
      alert(
        "Error",
        error.message || "Failed to save settings",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const handleTimeChange = (event: any, selectedDate: any) => {
    setShowCreatineTimePicker(Platform.OS === "ios")
    if (selectedDate) {
      setCreatineReminderTime(selectedDate)
    }
  }

  const handleClearData = () => {
    alert(
      "Clear All Data?",
      "This will delete your workout plan, selected profile, and all progress. Both local data and server data will be deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              if (selectedPerson) {
                const {
                  deleteAllSessionsForPerson,
                } = require("../services/api")
                try {
                  await deleteAllSessionsForPerson(selectedPerson)
                } catch (error: any) {
                  console.error("Failed to clear server data:", error)
                }
              }

              await clearAllData()
              alert(
                "Success",
                "All data has been cleared (local and server)",
                [{ text: "OK" }],
                "success",
              )
            } catch (error: any) {
              console.error("Error clearing data:", error)
              alert(
                "Error",
                "Failed to clear all data",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "error",
    )
  }

  const handleResetProgress = () => {
    const hasActiveSession = !!workoutStartTime

    alert(
      "Reset All Progress?",
      hasActiveSession
        ? "⚠️ You have an active workout session. This will end the session and clear all completed sets and unlock all days. Both local data and server data will be deleted. This cannot be undone."
        : "This will clear all completed sets and unlock all days. Both local data and server data will be deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              if (hasActiveSession) {
                await clearActiveWorkout()
              }

              if (selectedPerson) {
                const {
                  deleteAllSessionsForPerson,
                } = require("../services/api")
                try {
                  await deleteAllSessionsForPerson(selectedPerson)
                } catch (error: any) {
                  console.error("Failed to delete server data:", error)
                }
              }

              await saveCompletedDays({})
              await saveLockedDays({})

              alert(
                "Success",
                "All progress has been reset (local and server)",
                [{ text: "OK" }],
                "success",
              )
            } catch (error: any) {
              console.error("Error resetting progress:", error)
              alert(
                "Error",
                "Failed to reset progress",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  const handleLogout = async () => {
    alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout()
          },
        },
      ],
      "warning",
    )
  }

  const handleUnlockAllDays = () => {
    const hasActiveSession = !!workoutStartTime

    alert(
      "Unlock All Days?",
      hasActiveSession
        ? "⚠️ You have an active workout session. Unlocking will end this session and clear its data.\n\nYour completed workout history on the server will remain intact and visible in Analytics."
        : "This will unlock all days for editing. Your completed workout history on the server will remain intact and visible in Analytics.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: hasActiveSession ? "End Session & Unlock" : "Unlock All",
          style: hasActiveSession ? "destructive" : "default",
          onPress: async () => {
            try {
              if (hasActiveSession) {
                await clearActiveWorkout()
              }

              await saveLockedDays({})

              const allDayNumbers =
                workoutData?.days?.reduce(
                  (acc, d) => ({ ...acc, [d.dayNumber]: true }),
                  {},
                ) || {}
              await saveUnlockedOverrides(allDayNumbers)

              alert(
                "Success",
                hasActiveSession
                  ? "Active session ended and all days unlocked. Your workout history is preserved in Analytics."
                  : "All days have been unlocked. Your workout history is preserved in Analytics.",
                [{ text: "OK" }],
                "success",
              )
            } catch (error: any) {
              console.error("Error unlocking days:", error)
              alert("Error", "Failed to unlock days", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "lock",
    )
  }

  const handleResetSingleDay = (dayNumber: any) => {
    const day = workoutData?.days.find((d) => d.dayNumber === dayNumber)
    const dayTitle = day ? (day as any).title : `Day ${dayNumber}`
    const hasActiveSession = !!workoutStartTime
    const isCurrentDay = dayNumber === currentDay
    const willAffectActiveSession = hasActiveSession && isCurrentDay

    alert(
      "Reset Day?",
      willAffectActiveSession
        ? `⚠️ You have an active workout session on ${dayTitle}. Unlocking will end this session and clear its data.\n\nYour completed workout history on the server will remain intact and visible in Analytics.`
        : `This will unlock ${dayTitle} for editing and clear its completed sets locally. Your completed workout history on the server will remain intact and visible in Analytics.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: willAffectActiveSession ? "End Session & Reset" : "Reset Day",
          style: willAffectActiveSession ? "destructive" : "default",
          onPress: async () => {
            try {
              if (willAffectActiveSession) {
                await clearActiveWorkout()
              }

              const newCompletedDays = { ...completedDays }
              delete newCompletedDays[dayNumber]
              await saveCompletedDays(newCompletedDays)

              const newLockedDays = { ...lockedDays }
              delete newLockedDays[dayNumber]
              await saveLockedDays(newLockedDays)

              const newOverrides = { ...unlockedOverrides, [dayNumber]: true }
              await saveUnlockedOverrides(newOverrides)

              setShowResetDayModal(false)
              alert(
                "Success",
                `${dayTitle} has been unlocked.`,
                [{ text: "OK" }],
                "success",
              )
            } catch (error: any) {
              console.error("Error resetting day:", error)
              alert("Error", "Failed to reset day", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      willAffectActiveSession ? "warning" : "info",
    )
  }

  const lockDay = async (dayNumber: any) => {
    try {
      const newLockedDays = { ...lockedDays, [dayNumber]: true }
      await saveLockedDays(newLockedDays)

      if (unlockedOverrides[dayNumber]) {
        const newOverrides = { ...unlockedOverrides }
        delete newOverrides[dayNumber]
        await saveUnlockedOverrides(newOverrides)
      }
    } catch (error: any) {
      console.error("Error locking day:", error)
    }
  }

  const handleOpenTimeBetweenSetsModal = () => {
    setTempTimeBetweenSets(timeBetweenSets.toString())
    setShowTimeBetweenSetsModal(true)
  }

  const handleSaveTimeBetweenSets = () => {
    const value = parseInt(tempTimeBetweenSets)
    if (value && value > 0 && value <= 600) {
      saveTimeBetweenSets(value)
      setShowTimeBetweenSetsModal(false)
      alert(
        "Success",
        `Time between sets set to ${formatTime(value)}`,
        [{ text: "OK" }],
        "success",
      )
    } else {
      alert(
        "Invalid Input",
        "Please enter a value between 1 and 600 seconds",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  const handleOpenServerUrlModal = () => {
    setTempServerUrl(currentServerUrl)
    setShowServerUrlModal(true)
  }

  const handleSaveServerUrl = async () => {
    const url = tempServerUrl.trim()

    if (!url) {
      alert(
        "Invalid URL",
        "Please enter a server URL",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      alert(
        "Invalid URL",
        "URL must start with http:// or https://",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    const success = await setServerUrl(url)
    if (success) {
      setCurrentServerUrl(url)
      setShowServerUrlModal(false)
      alert(
        "Success",
        "Server URL updated successfully!",
        [{ text: "OK" }],
        "success",
      )
    } else {
      alert("Error", "Failed to save server URL", [{ text: "OK" }], "error")
    }
  }

  const handleResetServerUrl = async () => {
    alert(
      "Reset Server URL?",
      `This will reset the server URL to the default: ${getDefaultServerUrl()}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            const success = await resetServerUrl()
            if (success) {
              setCurrentServerUrl(getDefaultServerUrl())
              setShowServerUrlModal(false)
              alert(
                "Success",
                "Server URL updated successfully!",
                [{ text: "OK" }],
                "success",
              )
            } else {
              alert(
                "Error",
                "Failed to reset server URL",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  const handleToggleDemoMode = (value: any) => {
    if (!value) {
      alert(
        "Turn Off Demo Mode?",
        "This will delete all demo session data. Your real workout data will be preserved.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Turn Off",
            onPress: () => toggleDemoMode(false),
          },
        ],
        "warning",
      )
    } else {
      toggleDemoMode(true)
    }
  }

  const handleToggleManualTime = (value: any) => {
    if (value) {
      alert(
        "Use Manual Time?",
        "This will use your manually set time instead of the average calculated from your workout sessions.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Use Manual",
            onPress: () => toggleUseManualTime(true),
          },
        ],
        "info",
      )
    } else {
      toggleUseManualTime(false)
    }
  }

  const handleManualSync = async () => {
    if (pendingSyncs.length === 0) {
      alert(
        "No Data to Sync",
        "All workout data is already synced!",
        [{ text: "OK" }],
        "success",
      )
      return
    }

    alert(
      "Sync Pending Data?",
      `You have ${pendingSyncs.length} pending sync operation(s). Sync now?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync",
          onPress: async () => {
            await syncPendingData()
            alert(
              "Sync Complete",
              pendingSyncs.length === 0
                ? "All data synced successfully!"
                : `${pendingSyncs.length} operation(s) still pending. Check your connection.`,
              [{ text: "OK" }],
              pendingSyncs.length === 0 ? "success" : "warning",
            )
          },
        },
      ],
      "info",
    )
  }

  const getCompletedDaysCount = () => Object.keys(completedDays).length

  const getTotalCompletedSets = () => {
    let total = 0
    Object.values(completedDays).forEach((day) => {
      Object.values(day).forEach((exercise) => {
        total += Object.keys(exercise).length
      })
    })
    return total
  }

  const getLockedDaysCount = () =>
    Object.keys(lockedDays).filter((day) => (lockedDays as any)[day]).length

  const getDaysWithActivity = () => {
    if (!workoutData?.days) return []
    return workoutData.days.filter(
      (day) => completedDays[day.dayNumber] || lockedDays[day.dayNumber],
    )
  }

  const formatTime = (seconds: any) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.content}>
          {/* Creatine Reminders Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💊 Creatine Reminders</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={async () => {
                  setShowCreatineSettings(true)
                  await loadCreatineSettings()
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Reminder Settings</Text>
                  <Text style={styles.settingDescription}>
                    {creatineTimeBasedEnabled || creatineLocationBasedEnabled
                      ? `Active: ${creatineTimeBasedEnabled ? "Time" : ""}${creatineTimeBasedEnabled && creatineLocationBasedEnabled ? " + " : ""}${creatineLocationBasedEnabled ? "Location" : ""}`
                      : "Not configured"}
                  </Text>
                </View>
                <Text style={styles.settingValue}>Configure</Text>
              </TouchableOpacity>

              {(creatineTimeBasedEnabled || creatineLocationBasedEnabled) && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text style={styles.activeValue}>✓ Active</Text>
                  </View>
                  {creatineTimeBasedEnabled && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Time</Text>
                        <Text style={styles.infoValue}>
                          {creatineReminderTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </>
                  )}
                  {creatineLocationBasedEnabled && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Location</Text>
                        <Text
                          style={styles.infoValue}
                          numberOfLines={1}
                          ellipsizeMode='tail'
                        >
                          {reminderLocation?.address || "Set location"}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              )}

              {(creatineTimeBasedEnabled || creatineLocationBasedEnabled) &&
                creatineLocationBasedEnabled && (
                  <View style={styles.card}>
                    <TouchableOpacity
                      style={styles.settingRow}
                      onPress={() => setShowBatterySettings(true)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>Battery Impact</Text>
                        <Text style={styles.settingDescription}>
                          {(BATTERY_PRESETS as any)[batteryPreset]?.label ||
                            "Medium Impact"}
                          {" - "}
                          {(BATTERY_PRESETS as any)[batteryPreset]
                            ?.description || "Checks every 10 min"}
                        </Text>
                      </View>
                      <Text style={styles.settingValue}>⚙️</Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>
            <Text style={styles.helperText}>
              💡 Configure flexible time and/or location-based reminders
            </Text>
          </View>

          <Text style={styles.helperText}>
            💡 Adjust how often the app checks your location in the background
          </Text>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Settings</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>App Version</Text>
                <Text style={styles.infoValue}>
                  {require("../../app.json").expo.version}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Workout Plan Loaded</Text>
                <Text style={styles.infoValue}>
                  {workoutData ? "Yes" : "No"}
                </Text>
              </View>
              {workoutData && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Total Days</Text>
                    <Text style={styles.infoValue}>
                      {(workoutData as any).totalDays}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Server Configuration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌐 Server Configuration</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleOpenServerUrlModal}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Server URL</Text>
                  <Text style={styles.settingDescription} numberOfLines={1}>
                    {currentServerUrl}
                  </Text>
                </View>
                <Text style={styles.settingValue}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              💡 Configure the backend server URL for data sync
            </Text>
          </View>

          {/* Sync Status */}
          {pendingSyncs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>☁️ Data Sync</Text>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Pending Syncs</Text>
                    <Text style={styles.settingDescription}>
                      {pendingSyncs.length} operation(s) waiting to sync
                    </Text>
                  </View>
                  <Text style={styles.warningValue}>{pendingSyncs.length}</Text>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={handleManualSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator color='#667eea' />
                  ) : (
                    <Text style={styles.syncButtonText}>Sync Now</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.warningText}>
                ⚠️ Your workout data is stored locally. Connect to sync with the
                server.
              </Text>
            </View>
          )}

          {/* Demo Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Demo Mode</Text>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Demo Mode</Text>
                  <Text style={styles.settingDescription}>
                    Record data for testing without affecting your real stats
                  </Text>
                </View>
                <Switch
                  value={isDemoMode}
                  onValueChange={handleToggleDemoMode}
                  trackColor={{ false: "#e0e0e0", true: "#667eea" }}
                  thumbColor={isDemoMode ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>
            {isDemoMode && (
              <Text style={styles.warningText}>
                ⚠️ Demo mode is active. Session data will be deleted when turned
                off.
              </Text>
            )}
          </View>

          {/* Server Analytics */}
          {serverAnalytics && !useManualTime && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📈 Smart Analytics</Text>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    Average Time Between Sets
                  </Text>
                  <Text style={styles.infoValue}>
                    {formatTime(
                      serverAnalytics.averageTimeBetweenSets as number,
                    )}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Sessions Recorded</Text>
                  <Text style={styles.infoValue}>
                    {String(serverAnalytics.totalSessions ?? "")}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Sets Completed</Text>
                  <Text style={styles.infoValue}>
                    {String(serverAnalytics.totalSetsCompleted ?? "")}
                  </Text>
                </View>
              </View>
              <Text style={styles.helperText}>
                💡 This average is calculated from your actual workout sessions
              </Text>
            </View>
          )}

          {/* Workout Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏱️ Workout Timing</Text>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Use Manual Time</Text>
                  <Text style={styles.settingDescription}>
                    Use your manually set time instead of server analytics
                  </Text>
                </View>
                <Switch
                  value={useManualTime}
                  onValueChange={handleToggleManualTime}
                  trackColor={{ false: "#e0e0e0", true: "#667eea" }}
                  thumbColor={useManualTime ? "#fff" : "#f4f3f4"}
                />
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleOpenTimeBetweenSetsModal}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Time Between Sets</Text>
                  <Text style={styles.settingDescription}>
                    {useManualTime
                      ? "Manual time (used for estimates)"
                      : "Manual fallback (auto mode active)"}
                  </Text>
                </View>
                <Text style={styles.settingValue}>
                  {formatTime(timeBetweenSets)}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              💡{" "}
              {useManualTime
                ? "Using your manual time setting for workout estimates"
                : "Using server analytics when available, manual time as fallback"}
            </Text>
          </View>

          {/* Progress Stats */}
          {selectedPerson && workoutData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Progress</Text>
              <View style={styles.card}>
                {loadingProgress ? (
                  <ActivityIndicator
                    color='#667eea'
                    style={{ paddingVertical: 20 }}
                  />
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Days with Activity</Text>
                      <Text style={styles.infoValue}>
                        {serverProgress?.daysCount ?? getCompletedDaysCount()}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Total Sets Completed</Text>
                      <Text style={styles.infoValue}>
                        {serverProgress?.setsCount ?? getTotalCompletedSets()}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Locked Days</Text>
                      <Text style={styles.infoValue}>
                        {serverProgress?.lockedCount ?? getLockedDaysCount()}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Day</Text>
                      <Text style={styles.infoValue}>Day {currentDay}</Text>
                    </View>
                  </>
                )}
              </View>
              <Text style={styles.helperText}>
                💡 Progress resets automatically every Monday
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛠️ Actions</Text>

            {getCompletedDaysCount() > 0 && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleUnlockAllDays}
                >
                  <Text style={styles.actionButtonIcon}>🔓</Text>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonText}>Unlock All Days</Text>
                    <Text style={styles.actionButtonSubtext}>
                      Clear local sets & unlock days
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowResetDayModal(true)}
                >
                  <Text style={styles.actionButtonIcon}>🔄</Text>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonText}>
                      Unlock Single Day
                    </Text>
                    <Text style={styles.actionButtonSubtext}>
                      Clear local sets for one day
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={handleResetProgress}
                >
                  <Text style={styles.actionButtonIcon}>↩️</Text>
                  <View style={styles.actionButtonContent}>
                    <Text style={[styles.actionButtonText, styles.dangerText]}>
                      Reset Progress
                    </Text>
                    <Text style={styles.actionButtonSubtext}>
                      Delete all set history
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleClearData}
            >
              <Text style={styles.actionButtonIcon}>🗑️</Text>
              <View style={styles.actionButtonContent}>
                <Text style={[styles.actionButtonText, styles.dangerText]}>
                  Clear All Data
                </Text>
                <Text style={styles.actionButtonSubtext}>
                  Delete everything
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Account</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>{user?.username}</Text>
              </View>
              <View style={styles.divider} />
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleLogout}
            >
              <Text style={styles.actionButtonIcon}>🚪</Text>
              <Text style={[styles.actionButtonText, styles.dangerText]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.aboutText}>
                Workout Tracker helps you stay organized and motivated with your
                fitness routine. Upload your custom workout plan, choose your
                workout day, and track individual sets with weight and reps as
                you complete them. The app learns from your actual workout
                sessions to provide accurate time estimates. All data is stored
                locally first, then synced to the server when online. Days are
                locked when you complete a workout session, preventing
                accidental changes. Track your progress over time with detailed
                analytics and charts. All progress and locks reset every Monday
                for a fresh start to your week!
              </Text>
            </View>
          </View>
        </View>

        {/* ── Time Between Sets Modal ── */}
        <ModalSheet
          visible={showTimeBetweenSetsModal}
          onClose={() => setShowTimeBetweenSetsModal(false)}
          title='Time Between Sets'
          onConfirm={handleSaveTimeBetweenSets}
          confirmText='Save'
        >
          <Text style={styles.modalDescription}>
            How many seconds does it typically take from finishing one set to
            finishing the next? (includes rest time + actual exercise time)
          </Text>
          <TextInput
            style={styles.input}
            value={tempTimeBetweenSets}
            onChangeText={setTempTimeBetweenSets}
            keyboardType='number-pad'
            placeholder='120'
            placeholderTextColor='#999'
          />
        </ModalSheet>

        {/* ── Server URL Modal ── */}
        <ModalSheet
          visible={showServerUrlModal}
          onClose={() => setShowServerUrlModal(false)}
          title='Server URL'
          onConfirm={handleSaveServerUrl}
          confirmText='Save'
        >
          <Text style={styles.modalDescription}>
            Enter the URL of your workout tracker server (including http:// or
            https://)
          </Text>
          <TextInput
            style={styles.input}
            value={tempServerUrl}
            onChangeText={setTempServerUrl}
            keyboardType='url'
            placeholder='http://192.168.1.100:3000'
            placeholderTextColor='#999'
            autoCapitalize='none'
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetServerUrl}
          >
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Unlock Single Day Modal ── */}
        <ModalSheet
          visible={showResetDayModal}
          onClose={() => setShowResetDayModal(false)}
          title='Unlock Single Day'
          showCancelButton={false}
          showConfirmButton={false}
          scrollable={true}
        >
          {getDaysWithActivity().length === 0 ? (
            <View style={styles.emptyDayList}>
              <Text style={styles.emptyDayListText}>
                No days with activity yet
              </Text>
            </View>
          ) : (
            getDaysWithActivity().map((day) => (
              <TouchableOpacity
                key={day.dayNumber}
                style={styles.dayListItem}
                onPress={() => handleResetSingleDay(day.dayNumber)}
              >
                <View style={styles.dayListItemContent}>
                  <Text style={styles.dayListItemTitle}>
                    Day {day.dayNumber}
                  </Text>
                  <Text style={styles.dayListItemSubtitle}>
                    {day as any as any}
                  </Text>
                </View>
                <View style={styles.dayListItemBadges}>
                  {completedDays[day.dayNumber] && (
                    <View style={styles.completedBadge}>
                      <Text style={styles.badgeText}>
                        {Object.keys(completedDays[day.dayNumber]).length}{" "}
                        exercises
                      </Text>
                    </View>
                  )}
                  {lockedDays[day.dayNumber] && (
                    <View style={styles.lockedBadge}>
                      <Text style={styles.badgeText}>🔒 Locked</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ModalSheet>

        {/* ── Creatine Settings Modal ── */}
        <ModalSheet
          visible={showCreatineSettings}
          onClose={() => setShowCreatineSettings(false)}
          fullHeight={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
            <View style={styles.creatineModalHeader}>
              <TouchableOpacity
                onPress={() => setShowCreatineSettings(false)}
                style={styles.modalHeaderButton}
              >
                <Text style={styles.modalHeaderButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.creatineModalTitle}>Creatine Reminders</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.fullModalContent}
            >
              <View style={styles.infoCardBig}>
                <Text style={styles.infoIconBig}>💊</Text>
                <Text style={styles.infoTitleBig}>Flexible Reminders</Text>
                <Text style={styles.infoTextBig}>
                  Set up your perfect reminder system. Enable time-based,
                  location-based, or both!
                </Text>
              </View>

              {/* Time-Based Section */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <View style={styles.settingsTitleContainer}>
                    <Text style={styles.settingsSectionIcon}>🕐</Text>
                    <View>
                      <Text style={styles.settingsSectionTitle}>
                        Time-Based Reminder
                      </Text>
                      <Text style={styles.settingsSectionSubtitle}>
                        Get reminded at a specific time each day
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={creatineTimeBasedEnabled}
                    onValueChange={setCreatineTimeBasedEnabled}
                    trackColor={{ false: "#d1d5db", true: "#667eea" }}
                    thumbColor='#fff'
                  />
                </View>

                {creatineTimeBasedEnabled && (
                  <View style={styles.settingsSectionContent}>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => setShowCreatineTimePicker(true)}
                    >
                      <Text style={styles.timePickerLabel}>Reminder Time</Text>
                      <Text style={styles.timePickerValue}>
                        {creatineReminderTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </TouchableOpacity>

                    {showCreatineTimePicker && (
                      <DateTimePicker
                        value={creatineReminderTime}
                        mode='time'
                        is24Hour={true}
                        display='default'
                        onChange={handleTimeChange}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Location-Based Section */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <View style={styles.settingsTitleContainer}>
                    <Text style={styles.settingsSectionIcon}>📍</Text>
                    <View>
                      <Text style={styles.settingsSectionTitle}>
                        Location-Based Reminder
                      </Text>
                      <Text style={styles.settingsSectionSubtitle}>
                        Get reminded when you arrive at a location
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={creatineLocationBasedEnabled}
                    onValueChange={setCreatineLocationBasedEnabled}
                    trackColor={{ false: "#d1d5db", true: "#667eea" }}
                    thumbColor='#fff'
                  />
                </View>

                {creatineLocationBasedEnabled && (
                  <View style={styles.settingsSectionContent}>
                    <TouchableOpacity
                      style={styles.locationButton}
                      onPress={() => setShowLocationPicker(true)}
                    >
                      <Text style={styles.locationButtonLabel}>
                        {reminderLocation
                          ? `📍 ${reminderLocation.address}`
                          : "📍 Set Reminder Location"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {creatineTimeBasedEnabled && creatineLocationBasedEnabled && (
                <View style={styles.bothEnabledCard}>
                  <Text style={styles.bothEnabledIcon}>⏰ + 📍</Text>
                  <Text style={styles.bothEnabledTitle}>
                    Both Conditions Active
                  </Text>
                  <Text style={styles.bothEnabledText}>
                    You'll be reminded only when you're at the location AND it's
                    the set time.
                  </Text>
                </View>
              )}

              {/* Default Dosage */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeaderSimple}>
                  <Text style={styles.settingsSectionIcon}>⚗️</Text>
                  <Text style={styles.settingsSectionTitle}>
                    Default Dosage
                  </Text>
                </View>
                <View style={styles.inputContainerBig}>
                  <TextInput
                    style={styles.inputBig}
                    value={creatineDefaultGrams}
                    onChangeText={setCreatineDefaultGrams}
                    keyboardType='decimal-pad'
                    placeholder='5'
                  />
                  <Text style={styles.inputUnitBig}>grams</Text>
                </View>
                <Text style={styles.hintText}>
                  You can change this when logging each entry
                </Text>
              </View>

              {/* Notification Type */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeaderSimple}>
                  <Text style={styles.settingsSectionIcon}>🔔</Text>
                  <Text style={styles.settingsSectionTitle}>Alert Type</Text>
                </View>
                <Text style={styles.settingsSectionSubtitle}>
                  Choose how you want to be notified
                </Text>

                <View style={styles.notificationTypes}>
                  {[
                    {
                      key: "notification",
                      icon: "📱",
                      label: "Notification",
                      desc: "Standard push alert",
                    },
                    {
                      key: "alarm",
                      icon: "⏰",
                      label: "Alarm",
                      desc: "Clock-style alert",
                    },
                    {
                      key: "both",
                      icon: "📱⏰",
                      label: "Both",
                      desc: "Notification + alarm",
                    },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.notificationOption,
                        creatineNotificationType === option.key &&
                          styles.notificationOptionActive,
                      ]}
                      onPress={() => setCreatineNotificationType(option.key)}
                    >
                      <Text style={styles.notificationIcon}>{option.icon}</Text>
                      <Text
                        style={[
                          styles.notificationLabel,
                          creatineNotificationType === option.key &&
                            styles.notificationLabelActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.notificationDesc}>{option.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(creatineTimeBasedEnabled || creatineLocationBasedEnabled) && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>📋 Summary</Text>
                  <Text style={styles.summaryText}>
                    {creatineTimeBasedEnabled &&
                      !creatineLocationBasedEnabled &&
                      `You'll be reminded daily at ${creatineReminderTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    {!creatineTimeBasedEnabled &&
                      creatineLocationBasedEnabled &&
                      `You'll be reminded when you arrive at ${reminderLocation?.address || "your set location"}`}
                    {creatineTimeBasedEnabled &&
                      creatineLocationBasedEnabled &&
                      `You'll be reminded at ${creatineReminderTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} when you're at ${reminderLocation?.address || "your set location"}`}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.fullModalFooter}>
              <TouchableOpacity
                style={styles.saveButtonBig}
                onPress={handleSaveCreatineSettings}
              >
                <Text style={styles.saveButtonTextBig}>✓ Save Settings</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ModalSheet>

        {/* Battery Settings Modal */}
        <BatterySettingsModal
          visible={showBatterySettings}
          onClose={() => setShowBatterySettings(false)}
          onSave={(settings) => {
            setBatteryPreset(settings.preset)
          }}
        />

        {/* Location Picker Modal */}
        <CreatineLocationPicker
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onLocationSelected={async (location) => {
            setReminderLocation(location)
            try {
              await creatineApi.saveReminderLocation(
                location.lat,
                location.lng,
                location.address,
                location.radius,
              )
              alert(
                "Location Set",
                `Location saved: ${location.address}`,
                [{ text: "OK" }],
                "success",
              )
            } catch (error: any) {
              console.error("Error saving location:", error)
              alert(
                "Error",
                "Failed to save location",
                [{ text: "OK" }],
                "error",
              )
            }
          }}
          initialLocation={reminderLocation}
        />
      </ScrollView>
      {AlertComponent}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  contentContainer: { paddingBottom: 120 },
  content: { padding: 20, paddingTop: 60 },
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 16, color: "#666" },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    maxWidth: "50%",
  },
  activeValue: { fontSize: 16, fontWeight: "600", color: "#10b981" },
  warningValue: { fontSize: 16, fontWeight: "600", color: "#ff9800" },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  settingDescription: { fontSize: 13, color: "#666" },
  settingValue: { fontSize: 16, fontWeight: "600", color: "#667eea" },
  divider: { height: 1, backgroundColor: "#e0e0e0" },
  helperText: {
    fontSize: 14,
    color: "#667eea",
    marginTop: 10,
    fontStyle: "italic",
  },
  warningText: {
    fontSize: 14,
    color: "#ff9800",
    marginTop: 10,
    fontStyle: "italic",
  },
  syncButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  syncButtonText: { fontSize: 16, fontWeight: "600", color: "#667eea" },
  actionButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dangerButton: { borderWidth: 1, borderColor: "#ff4444" },
  actionButtonIcon: { fontSize: 28, marginRight: 16 },
  actionButtonContent: { flex: 1 },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  dangerText: { color: "#ff4444" },
  actionButtonSubtext: { fontSize: 14, color: "#666" },
  aboutText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 24,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#333",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: "#e0e0e0",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: { color: "#333", fontSize: 16, fontWeight: "600" },
  dayListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
  },
  dayListItemContent: { flex: 1 },
  dayListItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  dayListItemSubtitle: { fontSize: 14, color: "#666" },
  dayListItemBadges: { flexDirection: "row", gap: 8 },
  completedBadge: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedBadge: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#333" },
  emptyDayList: { padding: 40, alignItems: "center" },
  emptyDayListText: { fontSize: 15, color: "#999", textAlign: "center" },
  creatineModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalHeaderButton: { padding: 8 },
  modalHeaderButtonText: {
    fontSize: 16,
    color: "#ef4444",
    fontWeight: "600",
  },
  creatineModalTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  fullModalContent: { padding: 20, paddingBottom: 20 },
  fullModalFooter: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  infoCardBig: {
    backgroundColor: "#e8eaf6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  infoIconBig: { fontSize: 48, marginBottom: 12 },
  infoTitleBig: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  infoTextBig: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  settingsSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  settingsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingsSectionIcon: { fontSize: 24, marginRight: 12 },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  settingsSectionSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  settingsSectionHeaderSimple: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  settingsSectionContent: { marginTop: 16 },
  timePickerButton: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#667eea",
  },
  timePickerLabel: { fontSize: 14, color: "#666", fontWeight: "600" },
  timePickerValue: { fontSize: 24, fontWeight: "700", color: "#667eea" },
  locationButton: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#0ea5e9",
  },
  locationButtonLabel: { fontSize: 15, color: "#0c4a6e", fontWeight: "600" },
  bothEnabledCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#10b981",
  },
  bothEnabledIcon: { fontSize: 32, marginBottom: 8 },
  bothEnabledTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#065f46",
    marginBottom: 6,
  },
  bothEnabledText: {
    fontSize: 13,
    color: "#047857",
    textAlign: "center",
    lineHeight: 18,
  },
  inputContainerBig: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputBig: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 14,
    color: "#333",
  },
  inputUnitBig: { fontSize: 16, color: "#999", fontWeight: "600" },
  hintText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  notificationTypes: { flexDirection: "row", gap: 12, marginTop: 12 },
  notificationOption: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  notificationOptionActive: {
    backgroundColor: "#ede9fe",
    borderColor: "#8b5cf6",
  },
  notificationIcon: { fontSize: 28, marginBottom: 8 },
  notificationLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 4,
  },
  notificationLabelActive: { color: "#6d28d9" },
  notificationDesc: { fontSize: 11, color: "#999", textAlign: "center" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#667eea",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  summaryText: { fontSize: 14, color: "#666", lineHeight: 20 },
  saveButtonBig: {
    backgroundColor: "#667eea",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonTextBig: { fontSize: 18, fontWeight: "700", color: "#fff" },
})
