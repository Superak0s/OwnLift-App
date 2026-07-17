import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as DocumentPicker from "expo-document-picker"
import * as ImagePicker from "expo-image-picker"
import { File as ExpoFile } from "expo-file-system"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  saveToStorage,
  loadFromStorage,
  STORAGE_KEYS,
} from "@shared/services/storage"
import { useWorkout } from "@shared/context/WorkoutContext"
import { useAuth } from "@shared/context/AuthContext"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import { useAlert } from "@shared/components/CustomAlert"
import ThemeEditorModal from "@shared/components/ThemeEditorModal"
import EditWorkoutHistoryModal from "./components/EditWorkoutHistoryModal"
import ModalSheet from "@shared/components/ModalSheet"
import { importStrengthLevelCSV } from "@utils/strengthLevelImport"
import { formatTime as formatDuration } from "@utils/timeEstimation"
import { isServerless, setAppMode } from "@shared/services/appMode"
import { workoutApi } from "@features/workout/services/index"
import type { WorkoutDay, CompletedExercises } from "@shared/types"

export default function SettingsScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { user, logout, updateProfile, refreshUser } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const isMountedRef = useRef<boolean>(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const {
    workoutData,
    selectedSplit,
    currentDay,
    completedDays,
    lockedDays,
    timeBetweenSets,
    isDemoMode,
    useManualTime,
    pendingSyncs,
    isSyncing,
    workoutStartTime,
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
    syncFromServer,
  } = useWorkout()

  const [showTimeBetweenSetsModal, setShowTimeBetweenSetsModal] =
    useState<boolean>(false)
  const [tempTimeBetweenSets, setTempTimeBetweenSets] = useState<string>("")
  const [showResetDayModal, setShowResetDayModal] = useState<boolean>(false)
  const [selectedDayToReset, setSelectedDayToReset] = useState<number | null>(
    null,
  )

  const [showThemeEditor, setShowThemeEditor] = useState<boolean>(false)
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [showEditHistoryModal, setShowEditHistoryModal] =
    useState<boolean>(false)

  const [serverProgress, setServerProgress] = useState<{
    daysCount?: number
    setsCount?: number
    lockedCount?: number
    [key: string]: unknown
  } | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false)

  useEffect(() => {
    loadServerProgress()
  }, [user])

  const formatTime = (seconds: number) => formatDuration(seconds)

  const loadServerProgress = async () => {
    if (!selectedSplit) return
    setLoadingProgress(true)
    try {
      const sessions = await workoutApi.getSessionHistory(
        selectedSplit,
        null,
        100,
      )
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
        totalSets += session.set_count ?? 0
      }

      setServerProgress({
        daysCount: daysSeen.size,
        setsCount: totalSets,
        lockedCount: lockedDaysSeen.size,
      })
    } catch (error) {
      console.error(
        "Error loading server progress:",
        error instanceof Error ? error.message : error,
      )
    } finally {
      setLoadingProgress(false)
    }
  }

  const handleImportCSV = useCallback(async (): Promise<void> => {
    if (!selectedSplit) {
      alert(
        "No Person Selected",
        "Select a person before importing workout history.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "public.comma-separated-values-text",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (pickerResult.canceled) return

      const fileUri = pickerResult.assets?.[0]?.uri
      if (!fileUri) return

      setIsImporting(true)

      const csvText = await new ExpoFile(fileUri).text()

      const result = await importStrengthLevelCSV(csvText, selectedSplit)

      if (result.sessionsCreated > 0 && isMountedRef.current) {
        await syncFromServer()
        await loadServerProgress()
      }

      if (!isMountedRef.current) return

      const summary =
        `Imported ${result.setsImported} set${result.setsImported === 1 ? "" : "s"} ` +
        `across ${result.sessionsCreated} session${result.sessionsCreated === 1 ? "" : "s"}.` +
        (result.skipped > 0 ? `\n${result.skipped} row(s) were skipped.` : "")

      alert(
        result.errors.length > 0
          ? "Import Completed with Issues"
          : "Import Successful",
        result.errors.length > 0
          ? `${summary}\n\n${result.errors.slice(0, 3).join("\n")}`
          : summary,
        [{ text: "OK" }],
        result.errors.length > 0 ? "error" : "success",
      )
    } catch (error) {
      console.error("Error importing CSV:", error)
      if (isMountedRef.current) {
        alert(
          "Import Failed",
          error instanceof Error
            ? error.message
            : "Failed to import the CSV file.",
          [{ text: "OK" }],
          "error",
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsImporting(false)
      }
    }
  }, [selectedSplit, syncFromServer, alert])

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
              // Wipe ALL server-side data for this user (workouts, tracking,
              // social). Server requires explicit confirmation token; the
              // API should return { success: true } on success.
              const serverResp = await workoutApi.deleteAllUserData()
              if (serverResp && typeof serverResp === "object") {
                const sr = serverResp as any
                if (sr.success === false) {
                  throw new Error(sr.error || "Server refused to delete data")
                }
                if (sr.error) {
                  // treat presence of error as failure
                  throw new Error(sr.error)
                }
              }

              // If the server call was successful (or returned nothing), clear
              // local data as well.
              await clearAllData()

              alert(
                "Success",
                "All data has been cleared (local and server)",
                [{ text: "OK" }],
                "success",
              )
            } catch (error) {
              console.error("Error clearing data:", error)
              alert(
                "Error",
                error instanceof Error
                  ? error.message
                  : "Failed to clear all data",
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

              console.log("asdasdadssad")

              if (selectedSplit) {
                // deleteAllSessionsForPerson is imported at the top of the file
                try {
                  await workoutApi.deleteAllSessionsForPerson(selectedSplit)
                } catch (error) {
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
            } catch (error) {
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
                  (acc, d: WorkoutDay) => ({ ...acc, [d.dayNumber]: true }),
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
            } catch (error) {
              console.error("Error unlocking days:", error)
              alert("Error", "Failed to unlock days", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "lock",
    )
  }

  const handleResetSingleDay = (dayNumber: number) => {
    const day = workoutData?.days.find(
      (d: WorkoutDay) => d.dayNumber === dayNumber,
    )
    const dayTitle = day
      ? (day.dayTitle ?? day.muscleGroups?.join("/") ?? `Day ${dayNumber}`)
      : `Day ${dayNumber}`
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
            } catch (error) {
              console.error("Error resetting day:", error)
              alert("Error", "Failed to reset day", [{ text: "OK" }], "error")
            }
          },
        },
      ],
      willAffectActiveSession ? "warning" : "info",
    )
  }

  const lockDay = async (dayNumber: number) => {
    try {
      const newLockedDays = { ...lockedDays, [dayNumber]: true }
      await saveLockedDays(newLockedDays)

      if (unlockedOverrides[dayNumber]) {
        const newOverrides = { ...unlockedOverrides }
        delete newOverrides[dayNumber]
        await saveUnlockedOverrides(newOverrides)
      }
    } catch (error) {
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

  const handleToggleDemoMode = (value: boolean) => {
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

  const handleToggleManualTime = (value: boolean) => {
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
    Object.values(completedDays).forEach((day: CompletedExercises) => {
      Object.values(day).forEach((exercise) => {
        total += Object.keys(exercise).length
      })
    })
    return total
  }

  const getLockedDaysCount = () =>
    Object.keys(lockedDays).filter((day) => lockedDays[Number(day)]).length

  const getDaysWithActivity = () => {
    if (!workoutData?.days) return []
    return workoutData.days.filter(
      (day: WorkoutDay) =>
        completedDays[day.dayNumber] || lockedDays[day.dayNumber],
    )
  }

  // UI state: advanced section is collapsible and account editing uses a modal
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false)
  // Keep legacy activeTab string so older conditionals still work — general is default
  const activeTab: "general" | "advanced" = "general"

  // Profile editing state
  const [profileName, setProfileName] = useState<string>(user?.name ?? "")
  const [profileEmail, setProfileEmail] = useState<string>(user?.email ?? "")
  const [profilePhone, setProfilePhone] = useState<string>("")
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState<boolean>(false)

  useEffect(() => {
    setProfileName(user?.name ?? "")
    setProfileEmail(user?.email ?? "")
  }, [user?.name, user?.email])

  // Load locally-stored phone/avatar
  useEffect(() => {
    ;(async () => {
      try {
        const phone = await AsyncStorage.getItem("@profile_phone")
        const avatar = await AsyncStorage.getItem("@profile_avatar")
        if (phone) setProfilePhone(phone)
        if (avatar) setProfileAvatarUri(avatar)
      } catch (err) {
        console.warn("Failed loading profile extras:", err)
      }
    })()
  }, [])

  const pickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      })
      // Support both old and new result shapes
      const canceled = (res as any).canceled ?? (res as any).cancelled
      if (canceled) return
      if (
        (res as any).assets &&
        Array.isArray((res as any).assets) &&
        (res as any).assets.length > 0
      ) {
        const uri = (res as any).assets[0].uri
        if (uri) setProfileAvatarUri(uri)
        return
      }
      if ((res as any).uri) {
        setProfileAvatarUri((res as any).uri)
      }
    } catch (err) {
      console.error("Image pick error:", err)
      alert("Image Error", "Unable to pick image", [{ text: "OK" }], "error")
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const result = await updateProfile(profileName, profileEmail)
      if (!result.success) {
        alert(
          "Update Failed",
          result.error ?? "Could not update profile",
          [{ text: "OK" }],
          "error",
        )
        setSavingProfile(false)
        return
      }
      await AsyncStorage.setItem("@profile_phone", profilePhone)
      if (profileAvatarUri)
        await AsyncStorage.setItem("@profile_avatar", profileAvatarUri)
      alert("Saved", "Profile updated", [{ text: "OK" }], "success")
      await refreshUser()
    } catch (error) {
      console.error("Save profile error:", error)
      alert("Error", "Failed to save profile", [{ text: "OK" }], "error")
    } finally {
      setSavingProfile(false)
    }
  }

  const migrateToOffline = async () => {
    alert(
      "Migrate to Offline",
      "This will create a local offline account using your current profile data and switch the app to offline mode. All local app state (workout plan, progress, and session history) will be copied to the offline profile so you can continue where you left off. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Migrate",
          onPress: async () => {
            try {
              const currentUserId = user?.id ?? null

              // Copy persistent workout state for the current user into the local/offline user namespace.
              // Read all STORAGE_KEYS for the current user and write them for the offline local id.
              if (currentUserId) {
                const keys = Object.values(STORAGE_KEYS)
                for (const key of keys) {
                  try {
                    const value = await loadFromStorage(key, currentUserId)
                    if (value != null) {
                      // Write to offline "local" user id so the offline provider will load it
                      await saveToStorage(key, value, "local")
                    }
                  } catch (err) {
                    console.warn(`Failed copying key ${key}:`, err)
                  }
                }

                // Copy server session history (if a selectedSplit exists) into the offline sessions store
                try {
                  if (selectedSplit) {
                    // Pull full sessions including timings from the server
                    const sessions = await workoutApi.getSessionHistory(
                      selectedSplit,
                      null,
                      1000,
                      true,
                    )
                    // Map shape to the offline storage format used by the offline workout service
                    const mapped = (sessions || []).map((s: any) => ({
                      id: s.id,
                      person: selectedSplit,
                      day_number: s.day_number ?? s.dayNumber ?? 0,
                      day_title:
                        s.day_title ?? s.dayTitle ?? s.day_title ?? undefined,
                      start_time: s.start_time ?? s.startTime ?? null,
                      end_time: s.end_time ?? s.endTime ?? null,
                      set_timings: s.set_timings ?? s.setTimings ?? [],
                      is_demo: s.is_demo ?? false,
                    }))
                    try {
                      await AsyncStorage.setItem(
                        "@offline:workout:sessions",
                        JSON.stringify(mapped),
                      )
                    } catch (err) {
                      console.warn("Failed writing offline sessions:", err)
                    }
                  }
                } catch (err) {
                  console.warn("Failed fetching sessions for migration:", err)
                }
              }

              // Finally flip the mode — autoConnectOffline (AuthContext) will sign in the local profile.
              await setAppMode("off")

              // create/overwrite local profile with same name/email using auth updateProfile
              const current = user
              await updateProfile(
                current?.name ?? current?.username ?? "Me",
                current?.email ?? "",
              )
              if (profilePhone)
                await AsyncStorage.setItem("@profile_phone", profilePhone)
              if (profileAvatarUri)
                await AsyncStorage.setItem("@profile_avatar", profileAvatarUri)

              alert(
                "Success",
                "Migrated to offline account — your data has been copied and you can continue where you left off.",
                [{ text: "OK" }],
                "success",
              )
            } catch (error) {
              console.error("Migration to offline failed:", error)
              alert(
                "Error",
                "Failed to migrate to offline account",
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

  const migrateToOnline = async () => {
    alert(
      "Switch to Online Mode",
      "Switching to online mode will log you out and require you to sign in to an online account. If you have an existing server account, sign in after switching. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            try {
              await setAppMode("on")
              alert(
                "Mode Changed",
                "App switched to online mode. Please sign in or sign up from the login screen.",
                [{ text: "OK" }],
                "info",
              )
            } catch (error) {
              console.error("Switch to online failed:", error)
              alert(
                "Error",
                "Failed to switch to online mode",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "info",
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Settings</Text>
          </View>

          <View style={styles.section}>
            {!isServerless() && (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => setShowAccountModal(true)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Account</Text>
                    <Text style={styles.settingDescription}>
                      {user?.name ??
                        user?.username ??
                        "View or edit your account"}
                    </Text>
                  </View>
                  <Text style={styles.settingValue}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
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

          {/* Workout Timing - keep in General */}
          {activeTab === "general" && (
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
                    trackColor={{
                      false: colors.surfaceBorder,
                      true: colors.accent,
                    }}
                    thumbColor={useManualTime ? colors.surface : "#f4f3f4"}
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
          )}

          {/* Progress - General */}
          {activeTab === "general" && selectedSplit && workoutData && (
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
            </View>
          )}

          {/* Advanced (collapsible) */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsSectionHeaderSimple}
              onPress={() => setShowAdvanced((s) => !s)}
            >
              <View style={styles.settingsTitleContainer}>
                <Text style={styles.settingsSectionIcon}>⚙️</Text>
                <Text style={styles.settingsSectionTitle}>Advanced</Text>
              </View>
              <Text style={styles.settingValue}>
                {showAdvanced ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>

            {showAdvanced && (
              <>
                {/* Admin Mode (renamed from Demo Mode) */}
                {user?.is_admin && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🛡️ Admin Mode</Text>
                    <View style={styles.card}>
                      <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingLabel}>Admin Mode</Text>
                          <Text style={styles.settingDescription}>
                            Record data for testing without affecting your real
                            stats (Admin/Test mode)
                          </Text>
                        </View>
                        <Switch
                          value={isDemoMode}
                          onValueChange={handleToggleDemoMode}
                          trackColor={{
                            false: colors.surfaceBorder,
                            true: colors.accent,
                          }}
                          thumbColor={isDemoMode ? colors.surface : "#f4f3f4"}
                        />
                      </View>
                    </View>
                    {isDemoMode && (
                      <Text style={styles.warningText}>
                        ⚠️ Admin mode is active. Session data created in this
                        mode may be deleted when turned off.
                      </Text>
                    )}
                  </View>
                )}

                {/* Data Import */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📥 Data Import</Text>
                  <View style={styles.card}>
                    <TouchableOpacity
                      style={styles.settingRow}
                      onPress={handleImportCSV}
                      disabled={isImporting}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>
                          Import from Strength Level
                        </Text>
                        <Text style={styles.settingDescription}>
                          Import workout history from a Strength Level CSV
                          export
                        </Text>
                      </View>
                      {isImporting ? (
                        <ActivityIndicator color={colors.accent} />
                      ) : (
                        <Text style={styles.settingValue}>Import</Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity
                      style={styles.settingRow}
                      onPress={() => {
                        if (!selectedSplit) {
                          alert(
                            "No Person Selected",
                            "Select a person before editing workout history.",
                            [{ text: "OK" }],
                            "error",
                          )
                          return
                        }
                        setShowEditHistoryModal(true)
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>
                          Edit Workout History
                        </Text>
                        <Text style={styles.settingDescription}>
                          Update the name, muscle group, or time of already
                          logged/imported sets
                        </Text>
                      </View>
                      <Text style={styles.settingValue}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helperText}>
                    💡 Choose a CSV file exported from the Strength Level app
                  </Text>
                </View>

                {/* Actions (destructive) */}
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
                          <Text style={styles.actionButtonText}>
                            Unlock All Days
                          </Text>
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
                          <Text
                            style={[styles.actionButtonText, styles.dangerText]}
                          >
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
                      <Text
                        style={[styles.actionButtonText, styles.dangerText]}
                      >
                        Clear All Data
                      </Text>
                      <Text style={styles.actionButtonSubtext}>
                        Delete everything
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Migration */}
                  <View style={{ height: 8 }} />
                  {!isServerless() && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={migrateToOffline}
                    >
                      <Text style={styles.actionButtonIcon}>⬇️</Text>
                      <View style={styles.actionButtonContent}>
                        <Text style={styles.actionButtonText}>
                          Migrate to Offline Account
                        </Text>
                        <Text style={styles.actionButtonSubtext}>
                          Create a local profile and switch the app to offline
                          mode
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {isServerless() && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={migrateToOnline}
                    >
                      <Text style={styles.actionButtonIcon}>⬆️</Text>
                      <View style={styles.actionButtonContent}>
                        <Text style={styles.actionButtonText}>
                          Switch to Online Mode
                        </Text>
                        <Text style={styles.actionButtonSubtext}>
                          Switch to server mode — you will need to sign in to an
                          online account
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Logout */}
          {!isServerless() && (
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
          )}

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

        {/* ── Account Modal ── */}
        <ModalSheet
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          title='Account'
          showCancelButton={false}
          showConfirmButton={false}
          scrollable={true}
        >
          <View style={styles.fullModalContent}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <TouchableOpacity
                onPress={pickAvatar}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  overflow: "hidden",
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {profileAvatarUri ? (
                  <Image
                    source={{ uri: profileAvatarUri }}
                    style={{ width: 72, height: 72 }}
                  />
                ) : (
                  <Text style={{ color: colors.textMuted }}>Add</Text>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder='Full name'
                  style={styles.inputBig}
                />
                <TextInput
                  value={profileEmail}
                  onChangeText={setProfileEmail}
                  placeholder='Email'
                  style={styles.inputBig}
                />
                <TextInput
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                  placeholder='Phone'
                  style={styles.inputBig}
                />
              </View>
            </View>

            <View style={{ height: 20 }} />
            <TouchableOpacity
              style={styles.saveButtonBig}
              onPress={async () => {
                await handleSaveProfile()
                setShowAccountModal(false)
              }}
              disabled={savingProfile}
            >
              <Text style={styles.saveButtonTextBig}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </Text>
            </TouchableOpacity>
          </View>
        </ModalSheet>

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
                    {day.muscleGroups?.join(", ") ?? day.dayTitle ?? ""}
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

        <ThemeEditorModal
          visible={showThemeEditor}
          onClose={() => setShowThemeEditor(false)}
        />

        {selectedSplit && (
          <EditWorkoutHistoryModal
            visible={showEditHistoryModal}
            onClose={() => setShowEditHistoryModal(false)}
            person={selectedSplit}
            onDataChanged={() => {
              syncFromServer()
              loadServerProgress()
            }}
          />
        )}
      </ScrollView>
      {AlertComponent}
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    contentContainer: { paddingBottom: 120 },
    content: { padding: 20, paddingTop: 60 },
    section: { marginBottom: 25 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
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
    infoLabel: { fontSize: 16, color: colors.textSecondary },
    infoValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      maxWidth: "50%",
    },
    activeValue: { fontSize: 16, fontWeight: "600", color: colors.success },
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
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: { fontSize: 13, color: colors.textSecondary },
    settingValue: { fontSize: 16, fontWeight: "600", color: colors.accent },
    divider: { height: 1, backgroundColor: colors.surfaceBorder },
    helperText: {
      fontSize: 14,
      color: colors.accent,
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
    syncButtonText: { fontSize: 16, fontWeight: "600", color: colors.accent },
    actionButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      shadowColor: colors.shadow,
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
      color: colors.textPrimary,
      marginBottom: 4,
    },
    dangerText: { color: "#ff4444" },
    actionButtonSubtext: { fontSize: 14, color: colors.textSecondary },
    aboutText: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 24,
      textAlign: "center",
    },
    modalDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 22,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
    },
    resetButton: {
      backgroundColor: colors.surfaceBorder,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    resetButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    dayListItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    dayListItemContent: { flex: 1 },
    dayListItemTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    dayListItemSubtitle: { fontSize: 14, color: colors.textSecondary },
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
    badgeText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
    emptyDayList: { padding: 40, alignItems: "center" },
    emptyDayListText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
    },
    modalHeaderButton: { padding: 8 },
    modalHeaderButtonText: {
      fontSize: 16,
      color: colors.error,
      fontWeight: "600",
    },
    fullModalContent: { padding: 20, paddingBottom: 20 },
    fullModalFooter: {
      padding: 20,
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.inputBorder,
    },
    infoCardBig: {
      backgroundColor: colors.infoLight,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 24,
    },
    infoIconBig: { fontSize: 48, marginBottom: 12 },
    infoTitleBig: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    infoTextBig: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    settingsSection: {
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
    },
    settingsSectionSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    settingsSectionHeaderSimple: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    settingsSectionContent: { marginTop: 16 },
    timePickerButton: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.accent,
    },
    timePickerLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    timePickerValue: { fontSize: 24, fontWeight: "700", color: colors.accent },
    locationButton: {
      backgroundColor: "#f0f9ff",
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: "#0ea5e9",
    },
    locationButtonLabel: { fontSize: 15, color: "#0c4a6e", fontWeight: "600" },
    bothEnabledCard: {
      backgroundColor: colors.successLight,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.success,
    },
    bothEnabledIcon: { fontSize: 32, marginBottom: 8 },
    bothEnabledTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.success,
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
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    inputBig: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      paddingVertical: 14,
      color: colors.textPrimary,
    },
    inputUnitBig: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
    hintText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
      fontStyle: "italic",
    },
    notificationTypes: { flexDirection: "row", gap: 12, marginTop: 12 },
    notificationOption: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    notificationOptionActive: {
      backgroundColor: colors.infoLight,
      borderColor: "#8b5cf6",
    },
    notificationIcon: { fontSize: 28, marginBottom: 8 },
    notificationLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    notificationLabelActive: { color: "#6d28d9" },
    notificationDesc: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    summaryText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    saveButtonBig: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    saveButtonTextBig: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.surface,
    },
  })
