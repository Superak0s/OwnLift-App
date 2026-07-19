import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { useAuth } from "./AuthContext"
import { useRealtimeSocket } from "./hooks/useRealtimeSocket"
import { authService } from "@features/auth/services"
import { workoutApi } from "@features/workout/services"
import type { WorkoutAnalytics } from "@features/workout/services/on/workout"

import {
  STORAGE_KEYS,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  removeMultipleFromStorage,
} from "../services/storage"

import {
  isSessionInactive,
  calculateSessionTime,
  calculateRestTime,
  calculateSessionAverageRest,
  getSessionStatistics,
  INACTIVITY_THRESHOLD_MS,
} from "../../utils/session"

import {
  getEstimatedTimeRemaining,
  getEstimatedEndTime,
} from "../../utils/timeEstimation"

import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { initializeSupplementNotifications } from "../../../tasks/supplementLocationTask"

import {
  isSetComplete,
  getSetDetails,
  getExerciseCompletedSets,
  isDayComplete,
  isDayLocked,
  shouldResetForMonday,
} from "../../utils/dayCompletion"

import { useSyncManager } from "./hooks/useSyncManager"
import { useSessionOperations } from "./hooks/useSessionOperations"
import { useProgramOperations } from "./hooks/useProgramOperations"
import { useServerSync } from "./hooks/useServerSync"
import { useJointSession } from "./hooks/useJointSession"

import type {
  WorkoutData,
  WorkoutDay,
  CompletedDays,
  LockedDays,
  PendingSync,
  Exercise,
} from "../types"
import type { WebSocketMessage } from "./hooks/useRealtimeSocket"
import type {
  JointSession,
  PartnerProgress,
  PartnerCompletedSet,
  WatchTarget,
  ExerciseEntry,
} from "./hooks/useJointSession"

// ─── Types ────────────────────────────────────────────────────────────────────

type ServerAnalyticsType = WorkoutAnalytics | null

interface WorkoutContextValue {
  socketLastMessage: WebSocketMessage | null
  userId: string | null
  workoutData: WorkoutData | null
  selectedSplit: string | null
  currentDay: number
  completedDays: CompletedDays
  lockedDays: LockedDays
  unlockedOverrides: Record<number, boolean>
  isLoading: boolean
  timeBetweenSets: number
  workoutStartTime: string | null
  currentSessionId: string | null
  isDemoMode: boolean
  serverAnalytics: ServerAnalyticsType
  useManualTime: boolean
  pendingSyncs: PendingSync[]
  isSyncing: boolean
  lastActivityTime: number | null
  weightUnit: "kg" | "lbs"
  saveWorkoutData: (data: WorkoutData | null) => Promise<void>
  saveSelectedSplit: (person: string) => Promise<void>
  saveCurrentDay: (day: number) => Promise<void>
  saveCompletedDays: (completed: CompletedDays) => Promise<void>
  saveLockedDays: (locked: LockedDays) => Promise<void>
  saveUnlockedOverrides: (overrides: Record<number, boolean>) => Promise<void>
  saveTimeBetweenSets: (seconds: number) => Promise<void>
  toggleUseManualTime: (enabled: boolean) => Promise<void>
  toggleDemoMode: (enabled: boolean) => Promise<void>
  hasActiveSession: () => boolean
  startWorkout: () => Promise<string | null>
  endWorkout: (autoCompleted?: boolean) => Promise<unknown>
  saveWeightUnit: (unit: "kg" | "lbs") => Promise<void>

  saveSetDetails: (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
    weight: number,
    reps: number,
    note?: string,
    isWarmup?: boolean,
  ) => Promise<void>
  deleteSetDetails: (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
  ) => Promise<boolean>
  lockDay: (dayNumber: number) => Promise<void>
  clearActiveWorkout: () => Promise<void>
  isSetComplete: (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
  ) => boolean
  getSetDetails: (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
  ) => unknown
  getExerciseCompletedSets: (
    dayNumber: number,
    exerciseIndex: number,
  ) => unknown
  isDayComplete: (dayNumber: number) => boolean
  isDayLocked: (dayNumber: number) => boolean
  getEstimatedTimeRemaining: (dayNumber: number) => number | null
  getEstimatedEndTime: (dayNumber: number) => Date | null
  getTotalSessionTime: () => number
  getCurrentRestTime: () => number
  getSessionAverageRestTime: (dayNumber: number) => number
  getSessionStats: (dayNumber: number) => unknown
  updateExerciseName: (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ) => Promise<void>
  addExtraSetsToExercise: (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    additionalSets: number,
  ) => Promise<void>
  addNewExercise: (
    dayNumber: number,
    person: string,
    exerciseData: { name: string; muscleGroup?: string; sets: number },
  ) => Promise<void>
  fetchAnalytics: () => Promise<void>
  fetchSessionHistory: (
    limit?: number,
    includeTimings?: boolean,
  ) => Promise<unknown[]>
  syncFromServer: () => Promise<void>
  syncPendingData: () => Promise<void>
  cleanupInvalidSyncs: () => Promise<void>
  clearAllData: () => Promise<void>
  checkAndEndStaleSession: () => Promise<boolean>
  jointSession: JointSession | null
  isInJointSession: boolean
  partnerProgress: PartnerProgress | null
  partnerExerciseList: Array<{ name: string; sets: number }>
  myJointProgress: Record<string, unknown> | null
  pendingJointInvite: WebSocketMessage | null
  jointInviteStatus: string
  isPartnerReady: boolean
  syncPulse: boolean
  sendJointInvite: (toUserId: string) => Promise<boolean>
  acceptJointInvite: () => Promise<boolean>
  declineJointInvite: () => Promise<void>
  leaveJointSession: () => Promise<void>
  pushJointProgress: (args: {
    exerciseIndex: number | null
    setIndex: number | null
    exerciseName: string | null
    readyForNext?: boolean
  }) => Promise<void>
  partnerCompletedSets: PartnerCompletedSet[]
  isWatching: boolean
  watchTarget: WatchTarget | null
  watchSession: unknown
  watchLoading: boolean
  watchError: string | null
  startWatching: (
    friendId: string,
    friendUsername: string,
    sessionId: string,
  ) => Promise<boolean>
  stopWatching: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | undefined>(undefined)

export const useWorkout = (): WorkoutContextValue => {
  const context = useContext(WorkoutContext)
  if (!context)
    throw new Error("useWorkout must be used within a WorkoutProvider")
  return context
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const WorkoutProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const userId = user?.id ?? null

  // ── State ──────────────────────────────────────────────────────────────────
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null)
  const [selectedSplit, setSelectedSplit] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [completedDays, setCompletedDays] = useState<CompletedDays>({})
  const [lockedDays, setLockedDays] = useState<LockedDays>({})
  const [unlockedOverrides, setUnlockedOverrides] = useState<
    Record<number, boolean>
  >({})
  const [lastResetDate, setLastResetDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [timeBetweenSets, setTimeBetweenSets] = useState(120)
  const [useManualTime, setUseManualTime] = useState(false)

  const [workoutStartTime, setWorkoutStartTime] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [lastSetEndTime, setLastSetEndTime] = useState<string | null>(null)
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null)

  const [isDemoMode, setIsDemoMode] = useState(false)
  const [serverAnalytics, setServerAnalytics] =
    useState<ServerAnalyticsType>(null)
  const [pendingSyncs, setPendingSyncs] = useState<PendingSync[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  const hasSyncedRef = useRef(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg")

  // ── Joint session exercise list ────────────────────────────────────────────
  const currentDayAllExercises = useMemo((): ExerciseEntry[] => {
    if (!workoutData?.days || !currentDay) return []
    const day = workoutData.days.find(
      (d: WorkoutDay) => d.dayNumber === currentDay,
    )
    if (!day?.split) return []
    const result: ExerciseEntry[] = []
    Object.entries(day.split).forEach(([person, personWorkout]) => {
      ;(personWorkout?.exercises ?? []).forEach((ex: Exercise) => {
        result.push({ name: ex.name, sets: ex.sets ?? 0, person })
      })
    })
    return result
  }, [workoutData, currentDay])

  const jointSessionMessageHandlerRef = useRef<
    ((msg: WebSocketMessage) => void) | null
  >(null)

  const handleSocketMessage = useCallback((msg: WebSocketMessage) => {
    console.log("[CONTEXT_WS_MESSAGE]", msg.type)
    jointSessionMessageHandlerRef.current?.(msg)
  }, [])

  const socket = useRealtimeSocket({
    token: authToken,
    enabled: !!userId,
    onMessage: handleSocketMessage,
  })

  const jointSessionHook = useJointSession({
    userId,
    currentSessionId,
    workoutStartTime,
    currentDayExercises: currentDayAllExercises,
    selectedSplit,
    socket,
  })

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const analytics = await workoutApi.getAnalytics(selectedSplit, currentDay)
      if (analytics) {
        setServerAnalytics(analytics as WorkoutAnalytics)
        const avg = (analytics as WorkoutAnalytics).averageTimeBetweenSets
        if (!useManualTime && avg && avg > 0) setTimeBetweenSets(avg)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    }
  }, [selectedSplit, currentDay, useManualTime])
  // ── Sub-hooks ──────────────────────────────────────────────────────────────
  const syncManager = useSyncManager({
    pendingSyncs,
    setPendingSyncs,
    isSyncing,
    setIsSyncing,
    currentSessionId,
    setCurrentSessionId,
    userId,
    saveToStorage,
    STORAGE_KEYS,
    useManualTime,
    fetchAnalytics,
  })

  const sessionOps = useSessionOperations({
    workoutStartTime,
    setWorkoutStartTime,
    currentSessionId,
    setCurrentSessionId,
    lastSetEndTime,
    setLastSetEndTime,
    lastActivityTime,
    setLastActivityTime,
    currentDay,
    selectedSplit,
    workoutData,
    isDemoMode,
    completedDays,
    setCompletedDays,
    lockedDays,
    setLockedDays,
    unlockedOverrides,
    setUnlockedOverrides,
    userId,
    saveToStorage,
    removeFromStorage,
    STORAGE_KEYS,
    addPendingSync: syncManager.addPendingSync,
    useManualTime,
    fetchAnalytics,
    syncPendingData: syncManager.syncPendingData,
    pendingSyncs,
    setPendingSyncs,
  })

  const programOps = useProgramOperations({
    workoutData,
    setWorkoutData,
    userId,
    saveToStorage,
    STORAGE_KEYS,
  })

  const serverSync = useServerSync({
    userId,
    selectedSplit,
    workoutData,
    setWorkoutData,
    completedDays,
    lockedDays,
    setCompletedDays,
    setLockedDays,
    currentSessionId,
    workoutStartTime,
    unlockedOverrides,
    saveToStorage,
    STORAGE_KEYS,
    clearActiveWorkout: sessionOps.clearActiveWorkout,
  })

  // ── Stable save helpers (useCallback prevents new refs on every render) ────
  const saveWorkoutData = useCallback(
    async (data: WorkoutData | null) => {
      await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, data, userId)
      setWorkoutData(data)
    },
    [userId],
  )

  const saveSelectedSplit = useCallback(
    async (person: string) => {
      await saveToStorage(STORAGE_KEYS.SELECTED_PERSON, person, userId)
      setSelectedSplit(person)
    },
    [userId],
  )

  const saveCurrentDay = useCallback(
    async (day: number) => {
      if (day !== currentDay && workoutStartTime) {
        console.log(
          `Switching from day ${currentDay} to day ${day}, clearing active workout`,
        )
        await sessionOps.clearActiveWorkout()
      }
      await saveToStorage(STORAGE_KEYS.CURRENT_DAY, day.toString(), userId)
      setCurrentDay(day)
    },
    [userId, currentDay, workoutStartTime, sessionOps],
  )

  const saveCompletedDays = useCallback(
    async (completed: CompletedDays) => {
      await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, completed, userId)
      setCompletedDays(completed)
    },
    [userId],
  )

  const saveLockedDays = useCallback(
    async (locked: LockedDays) => {
      await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, locked, userId)
      setLockedDays(locked)
    },
    [userId],
  )

  const saveUnlockedOverrides = useCallback(
    async (overrides: Record<number, boolean>) => {
      await saveToStorage(STORAGE_KEYS.UNLOCKED_OVERRIDES, overrides, userId)
      setUnlockedOverrides(overrides)

      // Clear completed days for any day that has been unlocked
      setCompletedDays((prev: CompletedDays) => {
        const next = { ...prev }
        let changed = false
        Object.keys(overrides).forEach((dayNumberStr) => {
          const key = Number(dayNumberStr) as keyof CompletedDays
          if (next[key]) {
            delete next[key]
            changed = true
          }
        })
        if (changed) {
          void saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, next, userId)
          return next
        }
        return prev
      })
    },
    [userId],
  )

  const saveTimeBetweenSets = useCallback(
    async (seconds: number) => {
      await saveToStorage(
        STORAGE_KEYS.TIME_BETWEEN_SETS,
        seconds.toString(),
        userId,
      )
      setTimeBetweenSets(seconds)
    },
    [userId],
  )

  const toggleUseManualTime = useCallback(
    async (enabled: boolean) => {
      await saveToStorage(
        STORAGE_KEYS.USE_MANUAL_TIME,
        enabled.toString(),
        userId,
      )
      setUseManualTime(enabled)
      if (!enabled && selectedSplit) await fetchAnalytics()
    },
    [userId, selectedSplit, fetchAnalytics],
  )

  const toggleDemoMode = useCallback(
    async (enabled: boolean) => {
      await saveToStorage(STORAGE_KEYS.IS_DEMO_MODE, enabled.toString(), userId)
      setIsDemoMode(enabled)
      if (!enabled) {
        try {
          await workoutApi.clearDemoSessions()
        } catch (error) {
          console.error("Failed to clear demo sessions (offline):", error)
        }
      }
    },
    [userId],
  )
  const saveWeightUnit = useCallback(
    async (unit: "kg" | "lbs") => {
      await saveToStorage(STORAGE_KEYS.WEIGHT_UNIT, unit, userId)
      setWeightUnit(unit)
    },
    [userId],
  )

  // ── Utility helpers ────────────────────────────────────────────────────────
  const resetAllState = useCallback(() => {
    setWorkoutData(null)
    setSelectedSplit(null)
    setCurrentDay(1)
    setCompletedDays({})
    setLockedDays({})
    setUnlockedOverrides({})
    setLastResetDate(null)
    setWorkoutStartTime(null)
    setCurrentSessionId(null)
    setLastSetEndTime(null)
    setLastActivityTime(null)
    setIsDemoMode(false)
    setTimeBetweenSets(120)
    setUseManualTime(false)
    setPendingSyncs([])
    setServerAnalytics(null)
    setWeightUnit("kg")
    setIsLoading(false)
  }, [])

  // checkMondayReset is defined before loadSavedData so it can be called
  // inside it with a direct resetDate argument — avoiding the stale closure
  // over lastResetDate that existed before.
  const checkMondayReset = useCallback(
    async (resetDate: string | null) => {
      try {
        const newMondayDate = shouldResetForMonday(resetDate)
        if (newMondayDate) {
          console.log("Resetting completed days and locked days for new week!")
          const empty: CompletedDays = {}
          await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, empty, userId)
          await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, {}, userId)
          await saveToStorage(
            STORAGE_KEYS.LAST_RESET_DATE,
            newMondayDate,
            userId,
          )
          setCompletedDays(empty)
          setLockedDays({})
          setLastResetDate(newMondayDate)
        }
      } catch (error) {
        console.error("Error checking Monday reset:", error)
      }
    },
    [userId],
  )

  const loadSavedData = useCallback(async () => {
    try {
      // Parallel load — all AsyncStorage reads happen concurrently
      const [
        data,
        person,
        day,
        completed,
        locked,
        overrides,
        lastReset,
        timeBetween,
        startTime,
        sessionId,
        demoMode,
        manualTime,
        syncs,
        activity,
        weightUnitLoaded,
      ] = await Promise.all([
        loadFromStorage(STORAGE_KEYS.WORKOUT_DATA, userId),
        loadFromStorage(STORAGE_KEYS.SELECTED_PERSON, userId, false),
        loadFromStorage(STORAGE_KEYS.CURRENT_DAY, userId, false),
        loadFromStorage(STORAGE_KEYS.COMPLETED_DAYS, userId),
        loadFromStorage(STORAGE_KEYS.LOCKED_DAYS, userId),
        loadFromStorage(STORAGE_KEYS.UNLOCKED_OVERRIDES, userId),
        loadFromStorage(STORAGE_KEYS.LAST_RESET_DATE, userId, false),
        loadFromStorage(STORAGE_KEYS.TIME_BETWEEN_SETS, userId, false),
        loadFromStorage(STORAGE_KEYS.WORKOUT_START_TIME, userId, false),
        loadFromStorage(STORAGE_KEYS.CURRENT_SESSION_ID, userId, false),
        loadFromStorage(STORAGE_KEYS.IS_DEMO_MODE, userId, false),
        loadFromStorage(STORAGE_KEYS.USE_MANUAL_TIME, userId, false),
        loadFromStorage(STORAGE_KEYS.PENDING_SYNCS, userId),
        loadFromStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, userId, false),
        loadFromStorage(STORAGE_KEYS.WEIGHT_UNIT, userId, false),
      ])

      if (data) setWorkoutData(data as WorkoutData)
      if (person) setSelectedSplit(person as string)
      if (day) setCurrentDay(parseInt(day as string))
      if (completed) setCompletedDays(completed as CompletedDays)
      if (locked) setLockedDays(locked as LockedDays)
      if (overrides) setUnlockedOverrides(overrides as Record<number, boolean>)
      if (timeBetween) setTimeBetweenSets(parseInt(timeBetween as string))
      if (startTime) setWorkoutStartTime(startTime as string)
      if (sessionId) setCurrentSessionId(sessionId as string)
      if (demoMode) setIsDemoMode(demoMode === "true")
      if (manualTime) setUseManualTime(manualTime === "true")
      if (syncs) setPendingSyncs(syncs as PendingSync[])
      if (activity) setLastActivityTime(parseInt(activity as string))
      if (weightUnitLoaded) setWeightUnit(weightUnitLoaded as "kg" | "lbs")

      const loadedLastReset = lastReset ? (lastReset as string) : null
      if (loadedLastReset) setLastResetDate(loadedLastReset)

      // Pass the freshly-read value directly — no stale closure risk
      await checkMondayReset(loadedLastReset)
    } catch (error) {
      console.error("Error loading saved data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, checkMondayReset])

  const checkAndEndStaleSession = useCallback(async (): Promise<boolean> => {
    if (!workoutStartTime || !currentSessionId || !lastSetEndTime) return false
    if (isSessionInactive(lastSetEndTime)) {
      console.log("🔍 Detected stale session, auto-ending...")
      await sessionOps.endWorkout(true)
      console.log("✅ Stale session ended")
      return true
    }
    return false
  }, [workoutStartTime, currentSessionId, lastSetEndTime, sessionOps])

  const clearAllData = useCallback(async () => {
    if (!userId) return
    const keys = Object.values(STORAGE_KEYS)
    await removeMultipleFromStorage(keys, userId)
    resetAllState()
  }, [userId, resetAllState])

  const hasActiveSession = useCallback(
    () => !!workoutStartTime && !isDayLocked(lockedDays, currentDay),
    [workoutStartTime, lockedDays, currentDay],
  )

  // ── Time estimation ────────────────────────────────────────────────────────
  const getEstimatedTimeRemainingForDay = useCallback(
    (dayNumber: number) => {
      const sessionAverage = calculateSessionAverageRest(
        completedDays,
        dayNumber,
        workoutStartTime,
        timeBetweenSets,
      )
      return getEstimatedTimeRemaining(
        workoutData,
        selectedSplit,
        dayNumber,
        completedDays,
        timeBetweenSets,
        workoutStartTime,
        sessionAverage,
        useManualTime,
        serverAnalytics,
      )
    },
    [
      completedDays,
      workoutStartTime,
      timeBetweenSets,
      workoutData,
      selectedSplit,
      useManualTime,
      serverAnalytics,
    ],
  )

  const getEstimatedEndTimeForDay = useCallback(
    (dayNumber: number): Date | null => {
      if (!workoutStartTime) return null
      const remainingSeconds = getEstimatedTimeRemainingForDay(dayNumber)
      return getEstimatedEndTime(remainingSeconds)
    },
    [workoutStartTime, getEstimatedTimeRemainingForDay],
  )

  // ── Session statistics ─────────────────────────────────────────────────────
  const getTotalSessionTime = useCallback(
    () => calculateSessionTime(workoutStartTime),
    [workoutStartTime],
  )
  const getCurrentRestTime = useCallback(
    () => calculateRestTime(lastSetEndTime),
    [lastSetEndTime],
  )
  const getSessionAverageRestTime = useCallback(
    (dayNumber: number) =>
      calculateSessionAverageRest(
        completedDays,
        dayNumber,
        workoutStartTime,
        timeBetweenSets,
      ),
    [completedDays, workoutStartTime, timeBetweenSets],
  )
  const getSessionStats = useCallback(
    (dayNumber: number) =>
      getSessionStatistics(
        workoutStartTime,
        lastSetEndTime,
        completedDays,
        dayNumber,
        workoutData,
        selectedSplit,
        timeBetweenSets,
      ),
    [
      workoutStartTime,
      lastSetEndTime,
      completedDays,
      workoutData,
      selectedSplit,
      timeBetweenSets,
    ],
  )

  // ── Day completion ─────────────────────────────────────────────────────────
  const isSetCompleteFunc = useCallback(
    (dayNumber: number, exerciseIndex: number, setIndex: number) =>
      isSetComplete(completedDays, dayNumber, exerciseIndex, setIndex),
    [completedDays],
  )
  const getSetDetailsFunc = useCallback(
    (dayNumber: number, exerciseIndex: number, setIndex: number) =>
      getSetDetails(completedDays, dayNumber, exerciseIndex, setIndex),
    [completedDays],
  )
  const getExerciseCompletedSetsFunc = useCallback(
    (dayNumber: number, exerciseIndex: number) =>
      getExerciseCompletedSets(completedDays, dayNumber, exerciseIndex),
    [completedDays],
  )
  const isDayCompleteFunc = useCallback(
    (dayNumber: number) =>
      isDayComplete(
        lockedDays,
        dayNumber,
        workoutData,
        selectedSplit,
        completedDays,
      ),
    [lockedDays, workoutData, selectedSplit, completedDays],
  )
  const isDayLockedFunc = useCallback(
    (dayNumber: number) => isDayLocked(lockedDays, dayNumber),
    [lockedDays],
  )

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    jointSessionMessageHandlerRef.current = jointSessionHook.handleSocketMessage
  }, [jointSessionHook.handleSocketMessage])

  useEffect(() => {
    if (userId) void loadSavedData()
    else resetAllState()
  }, [userId])

  useEffect(() => {
    if (selectedSplit && !useManualTime && userId) void fetchAnalytics()
  }, [selectedSplit, currentDay, useManualTime, userId, fetchAnalytics])

  useEffect(() => {
    if (!userId) return
    const syncInterval = setInterval(() => {
      if (pendingSyncs.length > 0 && !isSyncing)
        void syncManager.syncPendingData()
    }, 30_000)
    return () => clearInterval(syncInterval)
  }, [pendingSyncs, isSyncing, userId])

  useEffect(() => {
    if (!isLoading && userId && pendingSyncs.length > 0)
      void syncManager.cleanupInvalidSyncs()
  }, [isLoading, userId])

  useEffect(() => {
    const checkStaleSessionOnStart = async () => {
      if (isLoading) return
      const hadStaleSession = await checkAndEndStaleSession()
      if (hadStaleSession && !useManualTime && selectedSplit)
        await fetchAnalytics()
    }
    void checkStaleSessionOnStart()
  }, [isLoading])

  useEffect(() => {
    if (isLoading || !userId || !selectedSplit || !workoutData) return
    if (hasSyncedRef.current) return
    hasSyncedRef.current = true
    void serverSync.syncFromServer()
  }, [isLoading, userId, selectedSplit])

  useEffect(() => {
    hasSyncedRef.current = false
  }, [selectedSplit, userId])

  useEffect(() => {
    if (!workoutStartTime || !currentSessionId) return

    const staleWarningSentRef = { current: false }

    // Reset warning flag when session activity updates
    const resetWarning = () => {
      staleWarningSentRef.current = false
    }

    const interval = setInterval(async () => {
      try {
        // If there's a last set time, check for the 15-minute warning window
        if (lastSetEndTime) {
          const elapsed = Date.now() - new Date(lastSetEndTime).getTime()
          const warningMs = Math.floor(INACTIVITY_THRESHOLD_MS / 2) // 15 minutes if threshold is 30

          if (
            elapsed >= warningMs &&
            elapsed < INACTIVITY_THRESHOLD_MS &&
            !staleWarningSentRef.current
          ) {
            staleWarningSentRef.current = true
            try {
              const ready = await initializeSupplementNotifications()
              if (ready) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `⚠️ Inactive workout detected`,
                    body: `No sets logged in ${Math.floor(warningMs / 60000)} minutes. Your session will end in another ${Math.floor(warningMs / 60000)} minutes unless activity resumes.`,
                    data: { type: "session_inactivity_warning" },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    ...(Platform.OS === "android" && {
                      channelId: "supplement-reminders",
                    }),
                  },
                  trigger: null,
                })
              }
            } catch (err) {
              console.warn("Failed to send inactivity warning:", err)
            }
          }

          // If user is active again (rest reset) clear the flag
          if (elapsed <= 1000) resetWarning()
        }
      } catch (err) {
        console.warn("Stale session check error:", err)
      }

      // Existing stale session auto-end check (30 minutes)
      await checkAndEndStaleSession()
    }, 60_000)

    return () => clearInterval(interval)
  }, [
    workoutStartTime,
    currentSessionId,
    lastSetEndTime,
    checkAndEndStaleSession,
  ])

  useEffect(() => {
    if (!userId) {
      setAuthToken(null)
      return
    }
    authService
      .getToken()
      .then((t: string | null) => setAuthToken(t))
      .catch(() => setAuthToken(null))
  }, [userId])

  // ── Wrapped session ops that also notify the socket ───────────────────────
  const startWorkout = useCallback(async (): Promise<string | null> => {
    const sessionId = await sessionOps.startWorkout()
    if (sessionId) socket.send({ type: "session_started", sessionId })
    return sessionId as string | null
  }, [sessionOps, socket])

  const endWorkout = useCallback(
    async (autoCompleted = false) => {
      const result = await sessionOps.endWorkout(autoCompleted)
      socket.send({ type: "session_ended" })
      return result
    },
    [sessionOps, socket],
  )

  const syncFromServer = useCallback(async (): Promise<void> => {
    await serverSync.syncFromServer()
  }, [serverSync])

  // ── Context value (memoised to prevent all-consumers re-render) ───────────
  const value = useMemo<WorkoutContextValue>(
    () => ({
      socketLastMessage: socket.lastMessage,
      userId,
      workoutData,
      selectedSplit,
      currentDay,
      completedDays,
      lockedDays,
      unlockedOverrides,
      isLoading,
      timeBetweenSets,
      workoutStartTime,
      currentSessionId,
      isDemoMode,
      serverAnalytics,
      useManualTime,
      pendingSyncs,
      isSyncing,
      lastActivityTime,
      weightUnit,
      saveWorkoutData,
      saveSelectedSplit,
      saveCurrentDay,
      saveCompletedDays,
      saveLockedDays,
      saveUnlockedOverrides,
      saveTimeBetweenSets,
      toggleUseManualTime,
      toggleDemoMode,
      hasActiveSession,
      startWorkout,
      endWorkout,
      saveWeightUnit,
      saveSetDetails: sessionOps.saveSetDetails,
      deleteSetDetails: sessionOps.deleteSetDetails,
      lockDay: sessionOps.lockDay,
      clearActiveWorkout: sessionOps.clearActiveWorkout,
      isSetComplete: isSetCompleteFunc,
      getSetDetails: getSetDetailsFunc,
      getExerciseCompletedSets: getExerciseCompletedSetsFunc,
      isDayComplete: isDayCompleteFunc,
      isDayLocked: isDayLockedFunc,
      getEstimatedTimeRemaining: getEstimatedTimeRemainingForDay,
      getEstimatedEndTime: getEstimatedEndTimeForDay,
      getTotalSessionTime,
      getCurrentRestTime,
      getSessionAverageRestTime,
      getSessionStats,
      updateExerciseName: programOps.updateExerciseName,
      addExtraSetsToExercise: programOps.addExtraSetsToExercise,
      addNewExercise: programOps.addNewExercise,
      fetchAnalytics,
      fetchSessionHistory: serverSync.fetchSessionHistory,
      syncFromServer,
      syncPendingData: syncManager.syncPendingData,
      cleanupInvalidSyncs: syncManager.cleanupInvalidSyncs,
      clearAllData,
      checkAndEndStaleSession,
      jointSession: jointSessionHook.jointSession,
      isInJointSession: jointSessionHook.isInJointSession,
      partnerProgress: jointSessionHook.partnerProgress,
      partnerExerciseList: jointSessionHook.partnerExerciseList,
      myJointProgress: jointSessionHook.myProgress,
      pendingJointInvite: jointSessionHook.pendingInvite,
      jointInviteStatus: jointSessionHook.inviteStatus,
      isPartnerReady: jointSessionHook.isPartnerReady,
      syncPulse: jointSessionHook.syncPulse,
      sendJointInvite: jointSessionHook.sendInvite,
      acceptJointInvite: jointSessionHook.acceptInvite,
      declineJointInvite: jointSessionHook.declineInvite,
      leaveJointSession: jointSessionHook.leaveJointSession,
      pushJointProgress: jointSessionHook.pushProgress,
      partnerCompletedSets: jointSessionHook.partnerCompletedSets,
      isWatching: jointSessionHook.isWatching,
      watchTarget: jointSessionHook.watchTarget,
      watchSession: jointSessionHook.watchSession,
      watchLoading: jointSessionHook.watchLoading,
      watchError: jointSessionHook.watchError,
      startWatching: jointSessionHook.startWatching,
      stopWatching: jointSessionHook.stopWatching,
    }),
    [
      socket.lastMessage,
      userId,
      workoutData,
      selectedSplit,
      currentDay,
      completedDays,
      lockedDays,
      unlockedOverrides,
      isLoading,
      timeBetweenSets,
      workoutStartTime,
      currentSessionId,
      isDemoMode,
      serverAnalytics,
      useManualTime,
      pendingSyncs,
      isSyncing,
      lastActivityTime,
      weightUnit,
      saveWorkoutData,
      saveSelectedSplit,
      saveCurrentDay,
      saveCompletedDays,
      saveLockedDays,
      saveUnlockedOverrides,
      saveTimeBetweenSets,
      toggleUseManualTime,
      toggleDemoMode,
      hasActiveSession,
      startWorkout,
      endWorkout,
      saveWeightUnit,
      sessionOps.saveSetDetails,
      sessionOps.deleteSetDetails,
      sessionOps.lockDay,
      sessionOps.clearActiveWorkout,
      isSetCompleteFunc,
      getSetDetailsFunc,
      getExerciseCompletedSetsFunc,
      isDayCompleteFunc,
      isDayLockedFunc,
      getEstimatedTimeRemainingForDay,
      getEstimatedEndTimeForDay,
      getTotalSessionTime,
      getCurrentRestTime,
      getSessionAverageRestTime,
      getSessionStats,
      programOps.updateExerciseName,
      programOps.addExtraSetsToExercise,
      programOps.addNewExercise,
      fetchAnalytics,
      serverSync.fetchSessionHistory,
      syncFromServer,
      syncManager.syncPendingData,
      syncManager.cleanupInvalidSyncs,
      clearAllData,
      checkAndEndStaleSession,
      jointSessionHook.jointSession,
      jointSessionHook.isInJointSession,
      jointSessionHook.partnerProgress,
      jointSessionHook.partnerExerciseList,
      jointSessionHook.myProgress,
      jointSessionHook.pendingInvite,
      jointSessionHook.inviteStatus,
      jointSessionHook.isPartnerReady,
      jointSessionHook.syncPulse,
      jointSessionHook.sendInvite,
      jointSessionHook.acceptInvite,
      jointSessionHook.declineInvite,
      jointSessionHook.leaveJointSession,
      jointSessionHook.pushProgress,
      jointSessionHook.partnerCompletedSets,
      jointSessionHook.isWatching,
      jointSessionHook.watchTarget,
      jointSessionHook.watchSession,
      jointSessionHook.watchLoading,
      jointSessionHook.watchError,
      jointSessionHook.startWatching,
      jointSessionHook.stopWatching,
    ],
  )

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  )
}
