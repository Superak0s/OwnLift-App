import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { useWorkout } from "@shared/context/WorkoutContext"
import { useAuth } from "@shared/context/AuthContext"
import { useTabBar } from "@shared/context/TabBarContext"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import ModalSheet from "@shared/components/ModalSheet"
import { useAlert } from "@shared/components/CustomAlert"
import {
  getAllExerciseNames,
  getAllMuscleGroups,
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
  normalizeExerciseName,
} from "@utils/exerciseMatching"
import { formatTime as formatDuration } from "@utils/timeEstimation"
import {
  loadFromStorage,
  saveToStorage,
  STORAGE_KEYS,
} from "@shared/services/storage"
import * as Notifications from "expo-notifications"
import { initializeSupplementNotifications } from "../../../tasks/supplementLocationTask"
import { formatDate as formatDateUtil } from "@utils/format"
import type { SetDetails, SimilarityMatch, PartnerBannerProps } from "./types"

// ─── Unit helpers ─────────────────────────────────────────────────────────────
const LBS_TO_KG = 0.45359237
const KG_TO_LBS = 2.20462262

/** Convert a kg value (as stored) to the display unit, rounded to 1 dp. */
function kgToDisplay(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return (kg * KG_TO_LBS).toFixed(1)
  }
  return kg % 1 === 0 ? String(kg) : kg.toFixed(1)
}

/** Parse a user-entered string in the chosen unit and return kg for storage. */
function displayToKg(value: string, unit: "kg" | "lbs"): number {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return 0
  return unit === "lbs" ? n * LBS_TO_KG : n
}

// ─────────────────────────────────────────────────────────────────────────────
// Partner banner – compact strip pinned to the very top of the screen
// ─────────────────────────────────────────────────────────────────────────────
function PartnerBanner({
  partnerProgress,
  isPartnerReady,
  syncPulse,
  partnerUsername,
  onLeave,
}: PartnerBannerProps): React.JSX.Element {
  const { colors } = useTheme()
  const bannerStyles = makeBannerStyles(colors)
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (syncPulse) {
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [syncPulse, pulse])

  const exerciseLabel = partnerProgress?.exerciseName
    ? partnerProgress.exerciseName
    : partnerProgress?.exerciseIndex != null
      ? `Ex ${(partnerProgress.exerciseIndex as number) + 1}`
      : "—"
  const setLabel =
    partnerProgress?.setIndex != null
      ? `Set ${(partnerProgress.setIndex as number) + 1}`
      : "—"
  const statusText = isPartnerReady
    ? "✅ Ready for next set"
    : partnerProgress
      ? `${exerciseLabel} · ${setLabel}`
      : "Waiting…"

  return (
    <Animated.View
      style={[bannerStyles.container, { transform: [{ scale: pulse }] }]}
    >
      <View style={bannerStyles.liveDot} />
      <View style={bannerStyles.avatarRing}>
        <Text style={bannerStyles.avatarText}>
          {partnerUsername?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <Text style={bannerStyles.label} numberOfLines={1}>
        <Text style={bannerStyles.name}>{partnerUsername}</Text>
        {"  "}
        <Text style={bannerStyles.status}>{statusText}</Text>
      </Text>
      <TouchableOpacity style={bannerStyles.leaveBtn} onPress={onLeave}>
        <Text style={bannerStyles.leaveBtnText}>Leave</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const makeBannerStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingVertical: 7,
      gap: 8,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.success,
    },
    avatarRing: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accentDark,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.info,
    },
    avatarText: { color: colors.surface, fontWeight: "700", fontSize: 12 },
    label: { flex: 1, fontSize: 12 },
    name: { color: colors.surface, fontWeight: "700" },
    status: { color: "rgba(255,255,255,0.6)" },
    leaveBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    leaveBtnText: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 11,
      fontWeight: "600",
    },
  })

// ─────────────────────────────────────────────────────────────────────────────
// "Partner is here" pill
// ─────────────────────────────────────────────────────────────────────────────
function PartnerExercisePill({ username }: { username: string }) {
  const { colors } = useTheme()
  const pillStyles = makePillStyles(colors)
  return (
    <View style={pillStyles.pill}>
      <View style={pillStyles.dot} />
      <Text style={pillStyles.text}>{username} is here</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge showing set-count difference for shared exercises
// ─────────────────────────────────────────────────────────────────────────────
function PartnerExerciseMatchBadge({
  partnerSets,
  mySets,
}: {
  partnerSets: number | null
  mySets: number
}) {
  const { colors } = useTheme()
  const diff = (partnerSets ?? 0) - mySets
  const diffText =
    diff === 0
      ? "Same sets"
      : diff > 0
        ? `+${diff} partner sets`
        : `${diff} partner sets`
  const diffColor = diff === 0 ? "#78350f" : diff > 0 ? "#92400e" : "#78350f"
  const bgColor =
    diff === 0 ? "#fef9c3" : diff > 0 ? colors.warningLight : "#fef9c3"
  const borderColor = diff === 0 ? "#fde68a" : diff > 0 ? "#fcd34d" : "#fde68a"
  return (
    <View
      style={[matchStyles.badge, { backgroundColor: bgColor, borderColor }]}
    >
      <Text style={[matchStyles.setsText, { color: diffColor }]}>
        🤝 {diffText}
      </Text>
    </View>
  )
}

const makePillStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.infoLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.accentDark,
    },
    text: { fontSize: 11, fontWeight: "700", color: colors.accentDark },
  })

const matchStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  setsText: { fontSize: 11, fontWeight: "700" },
})

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { user } = useAuth()
  const { isTabBarCollapsed } = useTabBar()
  const {
    workoutData,
    selectedSplit,
    currentDay,
    completedDays,
    saveSetDetails: saveSetDetailsCtx,
    deleteSetDetails,
    isSetComplete,
    getSetDetails,
    getExerciseCompletedSets,
    isDayComplete,
    isDayLocked,
    getEstimatedTimeRemaining,
    getEstimatedEndTime,
    workoutStartTime,
    currentSessionId,
    endWorkout,
    updateExerciseName,
    addExtraSetsToExercise,
    addNewExercise,
    lastActivityTime,
    getSessionAverageRestTime,
    getTotalSessionTime,
    getCurrentRestTime,
    getSessionStats,
    weightUnit,
    saveWeightUnit,
    fetchSessionHistory,
    isInJointSession,
    jointSession,
    partnerProgress,
    partnerExerciseList,
    isPartnerReady,
    syncPulse,
    pushJointProgress,
    leaveJointSession,
    partnerCompletedSets,
  } = useWorkout()

  const { alert, AlertComponent } = useAlert()

  const isMountedRef = useRef<boolean>(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const partnerUsername =
    jointSession?.participants?.find((p) => p.userId !== user?.id)?.username ??
    "Partner"

  const bottomAnim = useRef(new Animated.Value(74)).current
  const leftAnim = useRef(new Animated.Value(0)).current
  const borderRadiusAnim = useRef(new Animated.Value(0)).current
  const paddingBottomAnim = useRef(new Animated.Value(15)).current

  // ── local state ──────────────────────────────────────────────────────
  const [showSetModal, setShowSetModal] = useState<boolean>(false)
  const [selectedSet, setSelectedSet] = useState<{
    exerciseIndex: number
    setIndex: number
  } | null>(null)
  const [weight, setWeight] = useState<string>("")
  const [reps, setReps] = useState<string>("")
  const [performanceHistory, setPerformanceHistory] = useState<any>(null)
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [setNote, setSetNote] = useState<string>("")
  const [isWarmupSet, setIsWarmupSet] = useState<boolean>(false)
  const [showEditNameModal, setShowEditNameModal] = useState<boolean>(false)
  const [editingExercise, setEditingExercise] = useState<{
    index: number
    exercise: { name: string; muscleGroup?: string; sets: number }
  } | null>(null)
  const [newExerciseName, setNewExerciseName] = useState<string>("")
  const [newMuscleGroup, setNewMuscleGroup] = useState<string>("")
  const [nameSuggestions, setNameSuggestions] = useState<SimilarityMatch[]>([])
  const [muscleGroupSuggestions, setMuscleGroupSuggestions] = useState<
    SimilarityMatch[]
  >([])
  const [showAddSetsModal, setShowAddSetsModal] = useState<boolean>(false)
  const [addingSetsExercise, setAddingSetsExercise] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [additionalSets, setAdditionalSets] = useState<string>("")
  const [showAddExerciseModal, setShowAddExerciseModal] =
    useState<boolean>(false)
  const [newExercise, setNewExercise] = useState<{
    name: string
    muscleGroup: string
    sets: string
  }>({
    name: "",
    muscleGroup: "",
    sets: "",
  })
  const [newExerciseSuggestions, setNewExerciseSuggestions] = useState<
    SimilarityMatch[]
  >([])
  const [
    newExerciseMuscleGroupSuggestions,
    setNewExerciseMuscleGroupSuggestions,
  ] = useState<SimilarityMatch[]>([])
  const [restReminderEnabled, setRestReminderEnabled] = useState<boolean>(false)
  const [restReminderSeconds, setRestReminderSeconds] = useState<number>(0)
  const hasNotifiedRef = useRef<boolean>(false)
  const [showRestReminderModal, setShowRestReminderModal] =
    useState<boolean>(false)
  const [tempRestReminderSeconds, setTempRestReminderSeconds] =
    useState<string>("")

  const [currentRestTimer, setCurrentRestTimer] = useState<number>(0)
  const [sessionStats, setSessionStats] = useState<Record<
    string,
    unknown
  > | null>(null)

  const allExerciseNames = getAllExerciseNames(workoutData, selectedSplit)
  const allMuscleGroups = getAllMuscleGroups(workoutData, selectedSplit)
  const isCurrentDayLocked = isDayLocked(currentDay)
  const areAllSetsComplete = isDayComplete(currentDay)

  const getCurrentDayWorkout = (): Record<string, unknown> | null => {
    if (!workoutData?.days || !selectedSplit) return null
    const day = workoutData.days.find((d) => d.dayNumber === currentDay)
    if (!day || !day.split[selectedSplit]) return null
    return {
      dayNumber: day.dayNumber,
      dayTitle: day.dayTitle,
      muscleGroups: day.muscleGroups,
      exercises: day.split[selectedSplit].exercises || [],
      totalSets: day.split[selectedSplit].totalSets || 0,
    }
  }
  const dayWorkout = getCurrentDayWorkout()

  // ── session stats ticker ─────────────────────────────────────────────
  useEffect(() => {
    if (!workoutStartTime || isCurrentDayLocked)
      return // Load stored rest reminder for this user once when session starts
    ;(async () => {
      try {
        const stored = await loadFromStorage<number | null>(
          STORAGE_KEYS.REST_REMINDER_SECONDS,
          user?.id ?? null,
        )
        const secs = Number(stored ?? 0) || 0
        setRestReminderSeconds(secs)
        setRestReminderEnabled(secs > 0)
      } catch (err) {
        console.warn("Failed to load rest reminder setting:", err)
      }
    })()

    const interval = setInterval(() => {
      setSessionStats(
        getSessionStats(currentDay) as Record<string, unknown> | null,
      )
      const crt = getCurrentRestTime()
      setCurrentRestTimer(crt)

      // Reset notification flag when rest resets (new set / user activity)
      if (crt <= 1) {
        hasNotifiedRef.current = false
      }

      // Trigger notification when threshold is reached and not already sent
      if (
        restReminderEnabled &&
        restReminderSeconds > 0 &&
        crt >= restReminderSeconds &&
        !hasNotifiedRef.current
      ) {
        hasNotifiedRef.current = true
        ;(async () => {
          try {
            const ready = await initializeSupplementNotifications()
            if (!ready) return
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `⏱️ Time to start your next set`,
                body: `You've rested ${formatDuration(crt)}. Start your next set when ready.`,
                data: { type: "rest_reminder" },
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                ...(Platform.OS === "android" && {
                  channelId: "supplement-reminders",
                }),
              },
              trigger: null,
            })
          } catch (err) {
            console.warn("Failed to send rest reminder:", err)
          }
        })()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [
    workoutStartTime,
    isCurrentDayLocked,
    currentDay,
    restReminderEnabled,
    restReminderSeconds,
  ])

  useEffect(() => {
    if (showSetModal && selectedSet) loadPerformanceHistory()
  }, [showSetModal, selectedSet])

  useEffect(() => {
    if (showEditNameModal && newExerciseName.trim()) {
      const t = checkForTypo(newExerciseName, allExerciseNames)
      setNameSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setNameSuggestions([])
  }, [newExerciseName, showEditNameModal])

  useEffect(() => {
    if (showEditNameModal && newMuscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(newMuscleGroup, allMuscleGroups)
      setMuscleGroupSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setMuscleGroupSuggestions([])
  }, [newMuscleGroup, showEditNameModal])

  useEffect(() => {
    if (showAddExerciseModal && newExercise.name.trim()) {
      const t = checkForTypo(newExercise.name, allExerciseNames)
      setNewExerciseSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setNewExerciseSuggestions([])
  }, [newExercise.name, showAddExerciseModal])

  useEffect(() => {
    if (showAddExerciseModal && newExercise.muscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(
        newExercise.muscleGroup,
        allMuscleGroups,
      )
      setNewExerciseMuscleGroupSuggestions(
        t.suggestions.length > 0 ? t.suggestions : [],
      )
    } else setNewExerciseMuscleGroupSuggestions([])
  }, [newExercise.muscleGroup, showAddExerciseModal])

  useEffect(() => {
    if (isDayLocked(currentDay) && workoutStartTime && lastActivityTime) {
      const since = Date.now() - new Date(lastActivityTime).getTime()
      if (since >= 30 * 60 * 1000)
        alert(
          "Session Auto-Completed",
          "Your workout session was automatically completed due to 30 minutes of inactivity.",
          [{ text: "OK" }],
          "info",
        )
    }
  }, [])

  useEffect(() => {
    Animated.spring(bottomAnim, {
      toValue: isTabBarCollapsed ? -10 : 74,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(leftAnim, {
      toValue: isTabBarCollapsed ? 66 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(borderRadiusAnim, {
      toValue: isTabBarCollapsed ? 16 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(paddingBottomAnim, {
      toValue: isTabBarCollapsed ? 25 : 15,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
  }, [isTabBarCollapsed])

  const loadPerformanceHistory = useCallback(async () => {
    if (!selectedSet || !dayWorkout) return
    setLoadingHistory(true)
    try {
      const exercises = (dayWorkout as Record<string, unknown>)
        ?.exercises as Array<{ name: string }>
      const exercise = exercises[selectedSet.exerciseIndex]
      const canonicalName = getCanonicalName(exercise.name, allExerciseNames)
      const history: Array<{
        date: Date
        weight: number
        reps: number
        volume: number
        note: string
        isWarmup: boolean
      }> = []

      // First look through local completedDays (fast / already available)
      Object.keys(completedDays).forEach((dayNumber) => {
        const day = workoutData?.days.find(
          (d) => d.dayNumber === parseInt(dayNumber),
        )
        if (!day) return
        const pw = day.split[selectedSplit!]
        if (!pw?.exercises) return
        pw.exercises.forEach((ex, exerciseIndex) => {
          if (
            getCanonicalName(ex.name, allExerciseNames).toLowerCase() !==
            canonicalName.toLowerCase()
          )
            return
          const sets = (
            completedDays as Record<
              string,
              Record<
                number,
                Record<
                  string,
                  {
                    weight?: number
                    reps?: number
                    completedAt?: string
                    note?: string
                    isWarmup?: boolean
                  }
                >
              >
            >
          )[dayNumber]?.[exerciseIndex]
          if (!sets) return
          Object.keys(sets).forEach((si) => {
            const s = sets[si]
            const w = s.weight ?? 0,
              r = s.reps ?? 0
            history.push({
              date: new Date(s.completedAt ?? Date.now()),
              weight: isFinite(w) ? w : 0,
              reps: isFinite(r) ? r : 0,
              volume: isFinite(w * r) ? w * r : 0,
              note: s.note || "",
              isWarmup: s.isWarmup || false,
            })
          })
        })
      })

      // If no local history, fall back to server session history (set_timings)
      if (history.length === 0 && typeof fetchSessionHistory === "function") {
        try {
          const sessions = (await fetchSessionHistory(50, true)) as any[]
          if (sessions && sessions.length) {
            sessions.forEach((session) => {
              if (!session?.set_timings) return
              session.set_timings.forEach((t: any) => {
                const timingName = t.exercise_name || exercise.name || ""
                const timingCanonical = getCanonicalName(
                  timingName,
                  allExerciseNames,
                )
                if (
                  timingCanonical.toLowerCase() !== canonicalName.toLowerCase()
                )
                  return
                const w = t.weight ?? 0
                const r = t.reps ?? 0
                const completedAt =
                  t.end_time ?? session.end_time ?? session.start_time
                history.push({
                  date: new Date(completedAt ?? Date.now()),
                  weight: isFinite(w) ? w : 0,
                  reps: isFinite(r) ? r : 0,
                  volume: isFinite(w * r) ? w * r : 0,
                  note: t.note || "",
                  isWarmup: Boolean(t.is_warmup),
                })
              })
            })
          }
        } catch (err) {
          // ignore server lookup failures — we simply won't show history
          console.warn(
            "Failed to fetch server session history for performance:",
            err,
          )
        }
      }

      if (!history.length) {
        if (isMountedRef.current) setPerformanceHistory(null)
        return
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const prev = history.filter((e) => e.date < today && !e.isWarmup)
      if (!prev.length) {
        if (isMountedRef.current) setPerformanceHistory(null)
        return
      }
      prev.sort((a, b) => b.date.getTime() - a.date.getTime())
      const last = prev[0]
      const best = prev.reduce((b, c) => (c.volume > b.volume ? c : b), prev[0])
      if (isMountedRef.current)
        setPerformanceHistory({ last, best, totalAttempts: prev.length })
    } catch (e) {
      console.error("Error loading performance history:", e)
      if (isMountedRef.current) setPerformanceHistory(null)
    } finally {
      if (isMountedRef.current) setLoadingHistory(false)
    }
  }, [
    selectedSet,
    dayWorkout,
    completedDays,
    workoutData,
    selectedSplit,
    allExerciseNames,
    fetchSessionHistory,
  ])

  // ── set press ────────────────────────────────────────────────────────
  const handleSetPress = (exerciseIndex: number, setIndex: number) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "This day has been completed and locked.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    const existing = getSetDetails(
      currentDay,
      exerciseIndex,
      setIndex,
    ) as SetDetails | null
    if (existing) {
      // Display weight in the user's preferred unit
      const displayWeight = existing.weight
        ? kgToDisplay(existing.weight, weightUnit)
        : "0"
      let msg = `Weight: ${displayWeight} ${weightUnit}\nReps: ${existing.reps || 0}`
      if (existing.isWarmup) msg = `🔥 WARM-UP SET\n${msg}`
      if (existing.note) msg += `\n\nNote: ${existing.note}`
      alert(
        "Set Completed",
        msg,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () => {
              setSelectedSet({ exerciseIndex, setIndex })
              // Pre-fill weight field in the user's current unit
              setWeight(
                existing.weight ? kgToDisplay(existing.weight, weightUnit) : "",
              )
              setReps(existing.reps?.toString() || "")
              setSetNote(existing.note || "")
              setIsWarmupSet(existing.isWarmup || false)
              setShowSetModal(true)
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              deleteSetDetails(currentDay, exerciseIndex, setIndex),
          },
        ],
        "info",
      )
    } else {
      setSelectedSet({ exerciseIndex, setIndex })
      setWeight("")
      setReps("")
      setSetNote("")
      setIsWarmupSet(false)
      setShowSetModal(true)
    }
  }

  // ── save set ─────────────────────────────────────────────────────────
  const handleSaveSetDetails = useCallback(async () => {
    if (!selectedSet) return

    // Convert entered value to kg for storage/server
    const weightInKg = displayToKg(weight, weightUnit)
    const r = parseInt(reps) || 0

    if (weightInKg === 0 || r === 0) {
      alert(
        "Invalid Set",
        "Please enter a weight and reps greater than 0.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    // Always save in kg — server only receives kg
    await saveSetDetailsCtx(
      currentDay,
      selectedSet.exerciseIndex,
      selectedSet.setIndex,
      weightInKg,
      r,
      setNote.trim(),
      isWarmupSet,
    )

    if (isInJointSession) {
      const exercises = (dayWorkout as Record<string, unknown>)
        ?.exercises as Array<{ name: string }>
      const exercise = exercises[selectedSet.exerciseIndex]
      await pushJointProgress({
        exerciseIndex: selectedSet.exerciseIndex,
        setIndex: selectedSet.setIndex,
        exerciseName: exercise.name,
        readyForNext: false,
      })
    }

    if (isMountedRef.current) {
      setShowSetModal(false)
      setSelectedSet(null)
      setWeight("")
      setReps("")
      setSetNote("")
      setIsWarmupSet(false)
      setPerformanceHistory(null)
    }
  }, [
    selectedSet,
    weight,
    reps,
    setNote,
    isWarmupSet,
    currentDay,
    saveSetDetailsCtx,
    isInJointSession,
    dayWorkout,
    pushJointProgress,
    alert,
    weightUnit,
  ])

  // Rest reminder modal handlers
  const handleOpenRestReminderModal = () => {
    setTempRestReminderSeconds(String(restReminderSeconds || 60))
    setShowRestReminderModal(true)
  }

  const handleSaveRestReminder = async (overrideSeconds?: number) => {
    const raw =
      overrideSeconds !== undefined
        ? overrideSeconds
        : parseInt(tempRestReminderSeconds || "0", 10) || 0
    const secs = Math.max(0, Number(raw))
    setRestReminderSeconds(secs)
    setRestReminderEnabled(secs > 0)
    try {
      await saveToStorage(
        STORAGE_KEYS.REST_REMINDER_SECONDS,
        secs,
        user?.id ?? null,
      )
    } catch (err) {
      console.warn("Failed to save rest reminder setting:", err)
    }
    setShowRestReminderModal(false)
    alert(
      "Saved",
      secs > 0
        ? `Rest reminder set to ${formatTime(secs)}`
        : "Rest reminder turned off",
      [{ text: "OK" }],
      "success",
    )
  }

  // ── exercise editing ─────────────────────────────────────────────────
  const handleEditExerciseName = useCallback(
    (exerciseIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "Cannot edit exercises on a locked day.",
          [{ text: "OK" }],
          "lock",
        )
        return
      }
      const exercises = (dayWorkout as Record<string, unknown>)
        ?.exercises as Array<{
        name: string
        muscleGroup?: string
        sets: number
      }>
      const exercise = exercises[exerciseIndex]
      setEditingExercise({ index: exerciseIndex, exercise })
      setNewExerciseName(exercise.name)
      setNewMuscleGroup(exercise.muscleGroup || "")
      setShowEditNameModal(true)
    },
    [isCurrentDayLocked, dayWorkout, alert],
  )

  const closeEditModal = () => {
    setShowEditNameModal(false)
    setEditingExercise(null)
    setNewExerciseName("")
    setNewMuscleGroup("")
    setNameSuggestions([])
    setMuscleGroupSuggestions([])
  }

  const handleSaveExerciseName = () => {
    if (!editingExercise || !newExerciseName.trim()) {
      alert("Error", "Exercise name cannot be empty", [{ text: "OK" }], "error")
      return
    }
    const trimmed = newExerciseName.trim(),
      trimmedMG = newMuscleGroup.trim()
    const tc = checkForTypo(trimmed, allExerciseNames)
    if (tc.exactMatch) {
      updateExerciseName(
        currentDay,
        selectedSplit!,
        editingExercise.index,
        tc.exactMatch,
        trimmedMG,
      )
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      )
      closeEditModal()
    } else if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0]
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}". Use that instead?`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedSplit!,
                editingExercise.index,
                trimmed,
                trimmedMG,
              )
              closeEditModal()
            },
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedSplit!,
                editingExercise.index,
                top.name,
                trimmedMG,
              )
              closeEditModal()
            },
          },
        ],
        "warning",
      )
    } else {
      updateExerciseName(
        currentDay,
        selectedSplit!,
        editingExercise.index,
        trimmed,
        trimmedMG,
      )
      closeEditModal()
    }
  }

  const handleQuickAddSet = (exerciseIndex: number) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add sets to a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    addExtraSetsToExercise(currentDay, selectedSplit!, exerciseIndex, 1)
  }

  const handleAddMultipleSets = useCallback(
    (exerciseIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "Cannot add sets to a locked day.",
          [{ text: "OK" }],
          "lock",
        )
        return
      }
      const exercises = (dayWorkout as Record<string, unknown>)
        ?.exercises as Array<{
        name: string
        muscleGroup?: string
        sets: number
      }>
      setAddingSetsExercise({
        index: exerciseIndex,
        exercise: exercises[exerciseIndex],
      })
      setAdditionalSets("")
      setShowAddSetsModal(true)
    },
    [isCurrentDayLocked, dayWorkout, alert],
  )

  const handleSaveAdditionalSets = () => {
    if (!addingSetsExercise) return
    const sets = parseInt(additionalSets)
    if (isNaN(sets) || sets < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    addExtraSetsToExercise(
      currentDay,
      selectedSplit!,
      addingSetsExercise.index as number,
      sets,
    )
    setShowAddSetsModal(false)
    setAddingSetsExercise(null)
    setAdditionalSets("")
  }

  const handleAddNewExercise = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add exercises to a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    setNewExercise({ name: "", muscleGroup: "", sets: "" })
    setShowAddExerciseModal(true)
  }

  const closeAddExerciseModal = () => {
    setShowAddExerciseModal(false)
    setNewExercise({ name: "", muscleGroup: "", sets: "" })
    setNewExerciseSuggestions([])
    setNewExerciseMuscleGroupSuggestions([])
  }

  const handleSaveNewExercise = () => {
    const { name, muscleGroup, sets } = newExercise
    if (!name.trim()) {
      alert("Error", "Exercise name is required", [{ text: "OK" }], "error")
      return
    }
    const setsNum = parseInt(sets)
    if (isNaN(setsNum) || setsNum < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    const trimmed = name.trim(),
      trimmedMG = muscleGroup.trim()
    const tc = checkForTypo(trimmed, allExerciseNames)
    if (tc.exactMatch) {
      addNewExercise(currentDay, selectedSplit!, {
        name: tc.exactMatch,
        muscleGroup: trimmedMG,
        sets: setsNum,
      })
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      )
      closeAddExerciseModal()
      return
    }
    if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0]
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}".`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => {
              addNewExercise(currentDay, selectedSplit!, {
                name: trimmed,
                muscleGroup: trimmedMG,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => {
              addNewExercise(currentDay, selectedSplit!, {
                name: top.name,
                muscleGroup: trimmedMG,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
          },
        ],
        "warning",
      )
      return
    }
    addNewExercise(currentDay, selectedSplit!, {
      name: trimmed,
      muscleGroup: trimmedMG,
      sets: setsNum,
    })
    closeAddExerciseModal()
  }

  const handleSuggestionPress = (
    suggestion: SimilarityMatch,
    field = "name",
  ) => {
    if (showEditNameModal) {
      field === "muscleGroup"
        ? (setNewMuscleGroup(suggestion.name), setMuscleGroupSuggestions([]))
        : (setNewExerciseName(suggestion.name), setNameSuggestions([]))
    } else if (showAddExerciseModal) {
      field === "muscleGroup"
        ? (setNewExercise({ ...newExercise, muscleGroup: suggestion.name }),
          setNewExerciseMuscleGroupSuggestions([]))
        : (setNewExercise({ ...newExercise, name: suggestion.name }),
          setNewExerciseSuggestions([]))
    }
  }

  const handleCompleteWorkout = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Already Locked",
        "This day has already been completed.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    const done = getCompletedSetsCount(),
      total = (dayWorkout?.totalSets as number) || 0
    const msg =
      done === total
        ? "Are you sure you want to finish? You've completed all sets!"
        : `You've completed ${done}/${total} sets. End this session? The day will be locked.`
    alert(
      "Complete Workout?",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete & Lock",
          onPress: async () => {
            if (isInJointSession) await leaveJointSession()
            const auto = await endWorkout()
            if (!auto)
              alert(
                "Workout Completed! 💪",
                `Day ${currentDay} is now locked.`,
                [{ text: "OK" }],
                "success",
              )
          },
        },
      ],
      "session",
    )
  }

  const getCompletedSetsCount = useCallback((): number => {
    if (!dayWorkout) return 0
    const exercises = (dayWorkout as Record<string, unknown>)
      ?.exercises as Array<unknown>
    return exercises.reduce(
      (n: number, _: unknown, i: number) =>
        n + (getExerciseCompletedSets(currentDay, i) as number),
      0,
    )
  }, [dayWorkout, getExerciseCompletedSets, currentDay])

  const formatTime = useCallback(
    (seconds: number): string => formatDuration(seconds),
    [],
  )

  const formatEndTime = useCallback(
    (d: Date | null): string =>
      d
        ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        : "",
    [],
  )

  const formatDate = useCallback((d: Date): string => formatDateUtil(d), [])

  const isAssistedExercise = useCallback(
    (name: string): boolean => name.toLowerCase().includes("assisted"),
    [],
  )

  const partnerNameSet = useMemo(() => {
    if (!isInJointSession) return new Set<string>()
    const partnerExerciseNames = jointSession?.participants?.find(
      (p) => p.userId !== user?.id,
    )?.exerciseNames
    if (!partnerExerciseNames?.length) return new Set<string>()
    const partnerSet = new Set<string>(
      partnerExerciseNames.map((e) =>
        normalizeExerciseName(typeof e === "string" ? e : e.name),
      ),
    )
    const myExerciseNames = ((dayWorkout?.exercises ?? []) as any[])
      .map((ex: any) => (ex.name ? normalizeExerciseName(ex.name) : undefined))
      .filter(Boolean) as string[]
    return new Set<string>(myExerciseNames.filter((n) => partnerSet.has(n)))
  }, [isInJointSession, jointSession?.participants, dayWorkout])

  // ── empty states ─────────────────────────────────────────────────────
  if (!workoutData)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyTitle}>No Workout Plan</Text>
        <Text style={styles.emptyText}>
          Go to the Home tab to upload your workout file
        </Text>
      </View>
    )
  if (!selectedSplit)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>No Split Selected</Text>
        <Text style={styles.emptyText}>
          Go to the Plan tab to select your split
        </Text>
      </View>
    )
  if (!dayWorkout)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🤷</Text>
        <Text style={styles.emptyTitle}>No Workout for This Day</Text>
        <Text style={styles.emptyText}>
          {selectedSplit} has no exercises scheduled for Day {currentDay}
        </Text>
      </View>
    )

  const completedSetsCount = getCompletedSetsCount()
  const totalSetsCount = ((dayWorkout as any)?.totalSets as number) ?? 0
  const progressPercentage =
    totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0
  const allSetsComplete = areAllSetsComplete && !isCurrentDayLocked
  const totalSessionTime = getTotalSessionTime()
  const sessionAvgRest = getSessionAverageRestTime(currentDay)
  const estimatedRemaining = getEstimatedTimeRemaining(currentDay) as
    | number
    | null
  const estimatedEnd = getEstimatedEndTime(currentDay)

  const partnerParticipant = isInJointSession
    ? jointSession?.participants?.find((p) => p.userId !== user?.id)
    : null

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.container}>
        {isInJointSession && (
          <PartnerBanner
            partnerProgress={partnerProgress as any}
            isPartnerReady={isPartnerReady}
            syncPulse={syncPulse}
            partnerUsername={partnerUsername}
            onLeave={leaveJointSession}
          />
        )}

        {isCurrentDayLocked && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedBannerIcon}>🔒</Text>
            <View style={styles.lockedBannerTextContainer}>
              <Text style={styles.lockedBannerTitle}>
                Day Completed & Locked
              </Text>
              <Text style={styles.lockedBannerText}>
                This workout is view-only. Select another day to continue.
              </Text>
            </View>
          </View>
        )}

        {/* ── Header card ── */}
        <View
          style={[
            styles.headerCard,
            allSetsComplete && styles.headerCardComplete,
            isCurrentDayLocked && styles.headerCardLocked,
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.dayNumber}>
                Day {(dayWorkout as any).dayNumber}
                {isCurrentDayLocked && " 🔒"}
              </Text>
            </View>
            <View style={styles.setsInfo}>
              <Text style={styles.setsLabel}>Total Sets</Text>
              <Text style={styles.setsValue}>
                {(dayWorkout as any).totalSets}
              </Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercentage}%` },
                ]}
              />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressText}>
                {completedSetsCount} / {totalSetsCount} sets completed
              </Text>
              {workoutStartTime &&
                estimatedRemaining != null &&
                estimatedRemaining > 0 &&
                !isCurrentDayLocked && (
                  <Text style={styles.progressText}>
                    ~{formatTime(estimatedRemaining)} left
                  </Text>
                )}
            </View>
            {workoutStartTime &&
              estimatedEnd &&
              estimatedRemaining != null &&
              estimatedRemaining > 0 &&
              !isCurrentDayLocked && (
                <Text style={styles.endTimeText}>
                  Estimated finish: {formatEndTime(estimatedEnd)}
                </Text>
              )}
          </View>
          {workoutStartTime && !isCurrentDayLocked && sessionStats && (
            <View style={styles.sessionStatsContainer}>
              <View style={styles.sessionStatRow}>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>⏱️ Total Time</Text>
                  <Text style={styles.sessionStatValue}>
                    {formatTime(totalSessionTime)}
                  </Text>
                </View>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>💤 Avg Rest/Set</Text>
                  <Text style={styles.sessionStatValue}>
                    {formatTime(Math.round(sessionAvgRest))}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.sessionStat}
                  onPress={handleOpenRestReminderModal}
                >
                  <Text style={styles.sessionStatLabel}>⏰ Reminder</Text>
                  <Text style={styles.sessionStatValue}>
                    {restReminderEnabled && restReminderSeconds > 0
                      ? formatTime(restReminderSeconds)
                      : "Off"}
                  </Text>
                </TouchableOpacity>
              </View>
              {getCurrentRestTime() > 0 && (
                <View style={styles.currentRestContainer}>
                  <Text style={styles.currentRestLabel}>
                    Rest since last set:
                  </Text>
                  <Text
                    style={[
                      styles.currentRestValue,
                      getCurrentRestTime() > sessionAvgRest &&
                        styles.currentRestOvertime,
                    ]}
                  >
                    {formatTime(getCurrentRestTime())}
                    {getCurrentRestTime() > sessionAvgRest && (
                      <Text style={styles.overtimeText}>
                        {" "}
                        (+
                        {formatTime(
                          Math.round(getCurrentRestTime() - sessionAvgRest),
                        )}
                        )
                      </Text>
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
          {(allSetsComplete || isCurrentDayLocked) && (
            <View style={styles.completeMessage}>
              <Text style={styles.completeMessageText}>
                {isCurrentDayLocked
                  ? `🔒 Locked (${completedSetsCount}/${totalSetsCount} sets) - View Only`
                  : "🎉 All sets complete! Great job!"}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.exerciseList}
          contentContainerStyle={styles.exerciseListContent}
        >
          {((dayWorkout as any)?.exercises as any[]).map(
            (exercise: any, exerciseIndex: number) => {
              const completedSets = getExerciseCompletedSets(
                currentDay,
                exerciseIndex,
              ) as number
              const allDone = completedSets === exercise.sets
              const isAssisted = isAssistedExercise(exercise.name)
              const exerciseNameLower = exercise.name
                ? normalizeExerciseName(exercise.name)
                : ""
              const partnerMatchesByName =
                isInJointSession && partnerNameSet.has(exerciseNameLower)
              const partnerActiveExercise = partnerProgress?.exerciseName as
                | string
                | undefined
              const partnerActiveNameLower = partnerActiveExercise
                ? normalizeExerciseName(partnerActiveExercise)
                : undefined
              const partnerOnThis =
                isInJointSession &&
                !!partnerActiveNameLower &&
                partnerMatchesByName &&
                partnerActiveNameLower === exerciseNameLower
              const partnerSetCount = partnerMatchesByName
                ? (() => {
                    const entry = (
                      partnerParticipant?.exerciseNames ?? []
                    ).find(
                      (e) =>
                        (typeof e === "string" ? e : e.name)
                          .trim()
                          .toLowerCase() === exerciseNameLower,
                    )
                    return typeof entry === "object"
                      ? (entry?.sets ?? null)
                      : null
                  })()
                : null

              return (
                <View
                  key={exerciseIndex}
                  style={[
                    styles.exerciseCard,
                    allDone && styles.exerciseCardComplete,
                    isCurrentDayLocked && styles.exerciseCardLocked,
                    partnerMatchesByName && styles.exerciseCardShared,
                    partnerOnThis && styles.exerciseCardPartner,
                  ]}
                >
                  {partnerOnThis && (
                    <PartnerExercisePill username={partnerUsername} />
                  )}
                  {partnerMatchesByName &&
                    !partnerOnThis &&
                    partnerSetCount !== null && (
                      <PartnerExerciseMatchBadge
                        partnerSets={partnerSetCount}
                        mySets={exercise.sets}
                      />
                    )}

                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseInfo}>
                      <View style={styles.exerciseNameRow}>
                        <Text
                          style={[
                            styles.exerciseName,
                            allDone && styles.exerciseNameComplete,
                          ]}
                        >
                          {exercise.name}
                          {isAssisted && " 🤝"}
                        </Text>
                        {!isCurrentDayLocked && (
                          <TouchableOpacity
                            onPress={() =>
                              handleEditExerciseName(exerciseIndex)
                            }
                            style={styles.editButton}
                          >
                            <Text style={styles.editButtonText}>✏️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {exercise.muscleGroup && (
                        <Text style={styles.muscleGroup}>
                          {exercise.muscleGroup}
                        </Text>
                      )}
                    </View>
                    <View style={styles.exerciseProgress}>
                      <Text style={styles.exerciseProgressText}>
                        {completedSets}/{exercise.sets}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.setsContainer}>
                    {Array.from({ length: exercise.sets }, (_, setIndex) => {
                      const done = isSetComplete(
                        currentDay,
                        exerciseIndex,
                        setIndex,
                      )
                      if (isCurrentDayLocked && !done) return null
                      const setDetails = getSetDetails(
                        currentDay,
                        exerciseIndex,
                        setIndex,
                      ) as SetDetails | null
                      const partnerDoneThisSet =
                        isInJointSession &&
                        partnerCompletedSets.some(
                          (s) =>
                            (s.exerciseName
                              ? normalizeExerciseName(s.exerciseName)
                              : undefined) === exerciseNameLower &&
                            s.setIndex === setIndex,
                        )
                      const partnerOnSet =
                        partnerOnThis &&
                        (partnerProgress?.setIndex as number | undefined) ===
                          setIndex
                      return (
                        <TouchableOpacity
                          key={setIndex}
                          style={[
                            styles.setButton,
                            done && styles.setButtonComplete,
                            isCurrentDayLocked &&
                              done &&
                              styles.setButtonLocked,
                            setDetails?.isWarmup && styles.setButtonWarmup,
                            partnerDoneThisSet && styles.setButtonPartnerDone,
                            partnerOnSet && styles.setButtonPartner,
                          ]}
                          onPress={() =>
                            handleSetPress(exerciseIndex, setIndex)
                          }
                          activeOpacity={isCurrentDayLocked ? 1 : 0.7}
                          disabled={isCurrentDayLocked && !done}
                        >
                          {partnerOnSet && (
                            <View style={styles.partnerSetDot} />
                          )}
                          <Text
                            style={[
                              styles.setButtonNumber,
                              done && styles.setButtonNumberComplete,
                              isCurrentDayLocked &&
                                done && { color: colors.textPrimary },
                              setDetails?.isWarmup && styles.warmupText,
                              partnerDoneThisSet &&
                                done && { color: colors.accentDark },
                            ]}
                          >
                            {setDetails?.isWarmup ? "W" : setIndex + 1}
                          </Text>
                          {done && setDetails && (
                            <View style={styles.setDetailsPreview}>
                              {/* Display stored kg value in user's preferred unit */}
                              <Text
                                style={[
                                  styles.setDetailsText,
                                  isCurrentDayLocked && {
                                    color: colors.textPrimary,
                                  },
                                ]}
                              >
                                {setDetails.weight
                                  ? kgToDisplay(setDetails.weight, weightUnit)
                                  : "0"}
                                {weightUnit}
                              </Text>
                              <Text
                                style={[
                                  styles.setDetailsText,
                                  isCurrentDayLocked && {
                                    color: colors.textPrimary,
                                  },
                                ]}
                              >
                                ×{setDetails.reps || 0}
                              </Text>
                              {setDetails.note && (
                                <Text style={styles.setNoteIndicator}>📝</Text>
                              )}
                            </View>
                          )}
                          {done && (
                            <View style={styles.setCheckmark}>
                              <Text style={styles.setCheckmarkText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                    {!isCurrentDayLocked && (
                      <TouchableOpacity
                        style={styles.addSetButton}
                        onPress={() => handleQuickAddSet(exerciseIndex)}
                        onLongPress={() => handleAddMultipleSets(exerciseIndex)}
                      >
                        <Text style={styles.addSetButtonIcon}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!isCurrentDayLocked && (
                    <View style={styles.exerciseHint}>
                      <Text style={styles.exerciseHintText}>
                        Tap + to add 1 set · Long press for multiple
                      </Text>
                    </View>
                  )}
                </View>
              )
            },
          )}

          {!isCurrentDayLocked && (
            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={handleAddNewExercise}
            >
              <Text style={styles.addExerciseButtonIcon}>➕</Text>
              <Text style={styles.addExerciseButtonText}>Add New Exercise</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── Complete Session button ── */}
        {workoutStartTime && !isCurrentDayLocked && (
          <Animated.View
            style={[
              styles.bottomActions,
              {
                bottom: bottomAnim,
                left: leftAnim,
                borderTopLeftRadius: borderRadiusAnim,
                paddingBottom: paddingBottomAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.completeWorkoutButton}
              onPress={handleCompleteWorkout}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.completeWorkoutGradient}
              >
                <Text style={styles.completeWorkoutIcon}>💪</Text>
                <Text style={styles.completeWorkoutButtonText}>
                  Complete Session
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Set Details Modal ── */}
        <ModalSheet
          visible={showSetModal}
          onClose={() => {
            setShowSetModal(false)
            setSelectedSet(null)
            setWeight("")
            setReps("")
            setSetNote("")
            setIsWarmupSet(false)
            setPerformanceHistory(null)
          }}
          title='Set Details'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          {/* ── Warmup toggle ── */}
          <TouchableOpacity
            style={[
              styles.warmupToggle,
              isWarmupSet && styles.warmupToggleActive,
            ]}
            onPress={() => setIsWarmupSet(!isWarmupSet)}
          >
            <Text
              style={[
                styles.warmupToggleText,
                isWarmupSet && styles.warmupToggleTextActive,
              ]}
            >
              {isWarmupSet ? "🔥 Warm-up Set" : "Tap to mark as warm-up"}
            </Text>
          </TouchableOpacity>

          {/* ── Unit selector ── */}
          <View style={styles.unitSelectorContainer}>
            <Text style={styles.unitSelectorLabel}>Weight unit</Text>
            <View style={styles.unitSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === "kg" && styles.unitButtonActive,
                ]}
                onPress={() => {
                  if (weightUnit !== "kg") {
                    // Convert currently entered value from lbs → kg display
                    const currentLbs = parseFloat(weight)
                    if (isFinite(currentLbs) && currentLbs > 0) {
                      setWeight((currentLbs * LBS_TO_KG).toFixed(1))
                    }
                    saveWeightUnit("kg")
                  }
                }}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    weightUnit === "kg" && styles.unitButtonTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === "lbs" && styles.unitButtonActive,
                ]}
                onPress={() => {
                  if (weightUnit !== "lbs") {
                    // Convert currently entered value from kg → lbs display
                    const currentKg = parseFloat(weight)
                    if (isFinite(currentKg) && currentKg > 0) {
                      setWeight((currentKg * KG_TO_LBS).toFixed(1))
                    }
                    saveWeightUnit("lbs")
                  }
                }}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    weightUnit === "lbs" && styles.unitButtonTextActive,
                  ]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Performance history ── */}
          {loadingHistory ? (
            <View style={styles.historyLoading}>
              <Text style={styles.historyLoadingText}>Loading history...</Text>
            </View>
          ) : performanceHistory ? (
            <View style={styles.performanceSection}>
              <Text style={styles.performanceSectionTitle}>
                📊 Performance History
              </Text>
              <View style={styles.performanceCard}>
                <View style={styles.performanceCardHeader}>
                  <Text style={styles.performanceCardTitle}>🕐 Last Time</Text>
                  <Text style={styles.performanceCardDate}>
                    {formatDate(performanceHistory.last.date)}
                  </Text>
                </View>
                <View style={styles.performanceStats}>
                  <View style={styles.performanceStat}>
                    {/* History is stored in kg — display in chosen unit */}
                    <Text style={styles.performanceStatValue}>
                      {kgToDisplay(performanceHistory.last.weight, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Weight</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text style={styles.performanceStatValue}>
                      {performanceHistory.last.reps}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Reps</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text style={styles.performanceStatValue}>
                      {kgToDisplay(performanceHistory.last.volume, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Volume</Text>
                  </View>
                </View>
              </View>
              <View
                style={[styles.performanceCard, styles.bestPerformanceCard]}
              >
                <View style={styles.performanceCardHeader}>
                  <Text style={styles.performanceCardTitle}>
                    🏆 Best Performance
                  </Text>
                  <Text style={styles.performanceCardDate}>
                    {formatDate(performanceHistory.best.date)}
                  </Text>
                </View>
                <View style={styles.performanceStats}>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {kgToDisplay(performanceHistory.best.weight, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Weight</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {performanceHistory.best.reps}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Reps</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {kgToDisplay(performanceHistory.best.volume, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Volume</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.performanceTotalAttempts}>
                Total attempts: {performanceHistory.totalAttempts}
              </Text>
            </View>
          ) : (
            <View style={styles.noHistoryContainer}>
              <Text style={styles.noHistoryText}>
                No previous data for this exercise
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight ({weightUnit})</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType='decimal-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reps</Text>
            <TextInput
              style={styles.input}
              value={reps}
              onChangeText={setReps}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          {selectedSet &&
            (dayWorkout as any)?.exercises[selectedSet.exerciseIndex] &&
            isAssistedExercise(
              (dayWorkout as any)?.exercises[selectedSet.exerciseIndex].name,
            ) && (
              <View style={styles.assistedInfoBox}>
                <Text style={styles.assistedInfoText}>
                  🤝 Assisted Exercise - Weight represents assistance from the
                  machine. Lower = harder.
                </Text>
              </View>
            )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={setNote}
              onChangeText={setSetNote}
              placeholder='e.g., felt strong'
              placeholderTextColor='#999'
              multiline
              numberOfLines={3}
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSetDetails}
          >
            <Text style={styles.saveButtonText}>Save Set</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Edit Exercise Modal ── */}
        <ModalSheet
          visible={showEditNameModal}
          onClose={closeEditModal}
          title='Edit Exercise'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Exercise Name</Text>
            <TextInput
              style={styles.input}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder='Enter exercise name'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          {nameSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {nameSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "name")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Muscle Group</Text>
            <TextInput
              style={styles.input}
              value={newMuscleGroup}
              onChangeText={setNewMuscleGroup}
              placeholder='e.g., Chest'
              placeholderTextColor='#999'
            />
          </View>
          {muscleGroupSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {muscleGroupSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "muscleGroup")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveExerciseName}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Add Sets Modal ── */}
        <ModalSheet
          visible={showAddSetsModal}
          onClose={() => {
            setShowAddSetsModal(false)
            setAddingSetsExercise(null)
            setAdditionalSets("")
          }}
          title='Add Multiple Sets'
          subtitle={
            addingSetsExercise
              ? `Adding sets to: ${(addingSetsExercise.exercise as { name: string }).name}`
              : undefined
          }
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Sets to Add</Text>
            <TextInput
              style={styles.input}
              value={additionalSets}
              onChangeText={setAdditionalSets}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAdditionalSets}
          >
            <Text style={styles.saveButtonText}>Add Sets</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Add New Exercise Modal ── */}
        <ModalSheet
          visible={showAddExerciseModal}
          onClose={closeAddExerciseModal}
          title='Add New Exercise'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Exercise Name *</Text>
            <TextInput
              style={styles.input}
              value={newExercise.name}
              onChangeText={(t) => setNewExercise({ ...newExercise, name: t })}
              placeholder='e.g., Bench Press'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          {newExerciseSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "name")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Muscle Group</Text>
            <TextInput
              style={styles.input}
              value={newExercise.muscleGroup}
              onChangeText={(t) =>
                setNewExercise({ ...newExercise, muscleGroup: t })
              }
              placeholder='e.g., Chest'
              placeholderTextColor='#999'
            />
          </View>
          {newExerciseMuscleGroupSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseMuscleGroupSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "muscleGroup")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Sets *</Text>
            <TextInput
              style={styles.input}
              value={newExercise.sets}
              onChangeText={(t) => setNewExercise({ ...newExercise, sets: t })}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveNewExercise}
          >
            <Text style={styles.saveButtonText}>Add Exercise</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Rest Reminder Modal ── */}
        <ModalSheet
          visible={showRestReminderModal}
          onClose={() => setShowRestReminderModal(false)}
          title='Rest Reminder'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <Text style={styles.inputLabel}>
            Get notified once your rest time reaches this duration.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Seconds</Text>
            <TextInput
              style={styles.input}
              value={tempRestReminderSeconds}
              onChangeText={setTempRestReminderSeconds}
              keyboardType='number-pad'
              placeholder='e.g., 90'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          <View style={styles.restReminderPresetRow}>
            {[60, 90, 120, 180].map((preset) => (
              <TouchableOpacity
                key={preset}
                style={styles.restReminderPresetChip}
                onPress={() => setTempRestReminderSeconds(String(preset))}
              >
                <Text style={styles.restReminderPresetChipText}>
                  {formatTime(preset)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSaveRestReminder()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSaveRestReminder(0)}
          >
            <Text style={styles.saveButtonText}>Turn Off</Text>
          </TouchableOpacity>
        </ModalSheet>

        {AlertComponent}
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
      backgroundColor: colors.background,
    },
    emptyIcon: { fontSize: 64, marginBottom: 20 },
    emptyTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    lockedBanner: {
      backgroundColor: "#ff9800",
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      paddingHorizontal: 20,
    },
    lockedBannerIcon: { fontSize: 24, marginRight: 12 },
    lockedBannerTextContainer: { flex: 1 },
    lockedBannerTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.surface,
      marginBottom: 2,
    },
    lockedBannerText: { fontSize: 13, color: colors.surface, opacity: 0.95 },
    headerCard: {
      backgroundColor: colors.accent,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      paddingBottom: 10,
      paddingTop: 10,
    },
    headerCardComplete: { backgroundColor: colors.success },
    headerCardLocked: { backgroundColor: colors.textSecondary },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 15,
    },
    dayNumber: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.surface,
      marginBottom: 4,
    },
    setsInfo: { alignItems: "flex-end" },
    setsLabel: {
      fontSize: 12,
      color: colors.surface,
      opacity: 0.8,
      marginBottom: 2,
    },
    setsValue: { fontSize: 32, fontWeight: "bold", color: colors.surface },
    progressContainer: { marginTop: 10 },
    progressBar: {
      height: 8,
      backgroundColor: "rgba(255,255,255,0.3)",
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 8,
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.surface,
      borderRadius: 4,
    },
    progressTextRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressText: { fontSize: 14, color: colors.surface, opacity: 0.9 },
    endTimeText: {
      fontSize: 12,
      color: colors.surface,
      opacity: 0.8,
      marginTop: 4,
    },
    sessionStatsContainer: {
      marginTop: 15,
      padding: 12,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 8,
    },
    sessionStatRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 10,
    },
    sessionStat: { alignItems: "center" },
    sessionStatLabel: {
      fontSize: 12,
      color: colors.surface,
      opacity: 0.9,
      marginBottom: 4,
    },
    sessionStatValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.surface,
    },
    currentRestContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.2)",
    },
    currentRestLabel: {
      fontSize: 14,
      color: colors.surface,
      opacity: 0.9,
      marginRight: 8,
    },
    currentRestValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.surface,
    },
    currentRestOvertime: { color: colors.warning },
    overtimeText: { fontSize: 14, color: colors.warning },
    completeMessage: {
      marginTop: 15,
      padding: 12,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 8,
    },
    completeMessageText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    exerciseList: { flex: 1 },
    exerciseListContent: { padding: 15, paddingBottom: 140 },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    exerciseCardComplete: {
      backgroundColor: "#f0fff4",
      borderColor: colors.success,
    },
    exerciseCardLocked: {
      backgroundColor: colors.inputBackground,
      borderColor: colors.surfaceBorder,
    },
    exerciseCardShared: {
      borderColor: colors.warning,
      backgroundColor: "#fffbeb",
    },
    exerciseCardPartner: {
      borderColor: colors.accentDark,
      backgroundColor: "#faf5ff",
    },
    exerciseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    exerciseInfo: { flex: 1 },
    exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    exerciseName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
      flex: 1,
    },
    exerciseNameComplete: { color: colors.success },
    editButton: { padding: 4 },
    editButtonText: { fontSize: 16 },
    muscleGroup: { fontSize: 14, color: colors.textSecondary },
    exerciseProgress: {
      backgroundColor: colors.separator,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    exerciseProgressText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    setsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    setButton: {
      width: 70,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.separator,
      borderWidth: 2,
      borderColor: "#ddd",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      padding: 4,
    },
    setButtonComplete: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    setButtonLocked: { backgroundColor: "#ff9800", borderColor: "#d97706" },
    setButtonWarmup: { backgroundColor: "#fb923c", borderColor: "#ea580c" },
    setButtonPartner: {
      borderColor: colors.accentDark,
      borderWidth: 3,
      backgroundColor: colors.infoLight,
    },
    setButtonPartnerDone: { borderColor: colors.info, borderWidth: 2 },
    partnerSetDot: {
      position: "absolute",
      top: -4,
      left: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accentDark,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    setButtonNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textSecondary,
      marginBottom: 2,
    },
    setButtonNumberComplete: { color: colors.surface },
    warmupText: { fontSize: 14 },
    setDetailsPreview: { alignItems: "center" },
    setDetailsText: { fontSize: 10, color: colors.surface, fontWeight: "500" },
    setNoteIndicator: { fontSize: 10, marginTop: 2 },
    setCheckmark: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    setCheckmarkText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "bold",
    },
    addSetButton: {
      width: 70,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.accentLight,
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    addSetButtonIcon: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.accent,
    },
    exerciseHint: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      alignItems: "center",
    },
    exerciseHintText: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    addExerciseButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: "dashed",
    },
    addExerciseButtonIcon: { fontSize: 32, marginBottom: 8 },
    addExerciseButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.accent,
    },
    bottomActions: {
      position: "absolute",
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: "transparent",
    },
    completeWorkoutButton: {
      borderRadius: 28,
      overflow: "hidden",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 12,
    },
    completeWorkoutGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 17,
      paddingHorizontal: 32,
      borderRadius: 28,
      gap: 10,
    },
    completeWorkoutIcon: { fontSize: 20 },
    completeWorkoutButtonText: {
      color: colors.surface,
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    warmupToggle: {
      backgroundColor: colors.separator,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    warmupToggleActive: { backgroundColor: "#fff7ed", borderColor: "#fb923c" },
    warmupToggleText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      fontWeight: "500",
    },
    warmupToggleTextActive: { color: "#ea580c", fontWeight: "600" },

    // ── Unit selector ──────────────────────────────────────────────────
    unitSelectorContainer: { marginBottom: 16 },
    unitSelectorLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    unitSelectorRow: { flexDirection: "row", gap: 10 },
    unitButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBackground,
      alignItems: "center",
    },
    unitButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
    },
    unitButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    unitButtonTextActive: { color: colors.accent },

    performanceSection: { marginBottom: 20 },
    performanceSectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    performanceCard: {
      backgroundColor: colors.accentLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    bestPerformanceCard: {
      backgroundColor: "#fff7ed",
      borderColor: colors.warning,
    },
    performanceCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    performanceCardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    performanceCardDate: { fontSize: 12, color: colors.textSecondary },
    performanceStats: { flexDirection: "row", justifyContent: "space-around" },
    performanceStat: { alignItems: "center" },
    performanceStatValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    bestStatValue: { color: colors.warning },
    performanceStatLabel: { fontSize: 12, color: colors.textSecondary },
    performanceTotalAttempts: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 4,
    },
    historyLoading: { padding: 20, alignItems: "center" },
    historyLoadingText: { fontSize: 14, color: colors.textMuted },
    noHistoryContainer: {
      padding: 20,
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      marginBottom: 20,
    },
    noHistoryText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    inputGroup: { marginBottom: 20 },
    inputLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
    },
    notesInput: { minHeight: 80, textAlignVertical: "top" },
    assistedInfoBox: {
      backgroundColor: "#dbeafe",
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#3b82f6",
    },
    assistedInfoText: { fontSize: 14, color: colors.info, textAlign: "center" },
    saveButton: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
    },
    saveButtonText: { color: colors.surface, fontSize: 18, fontWeight: "bold" },
    suggestionsContainer: {
      backgroundColor: "#fffbeb",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    suggestionsTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: "#92400e",
      marginBottom: 12,
    },
    suggestionButton: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.warning,
    },
    suggestionText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
      flex: 1,
    },
    suggestionMatch: { fontSize: 12, color: "#92400e", fontWeight: "600" },
    restReminderPresetRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    restReminderPresetChip: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    restReminderPresetChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  })
