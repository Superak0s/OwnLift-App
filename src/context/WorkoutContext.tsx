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
import { authService, getAnalytics, clearDemoSessions } from "../services/api"
import type { WorkoutAnalytics } from "../services/api"

import {
  STORAGE_KEYS,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  removeMultipleFromStorage,
} from "../utils/storage"

import {
  isSessionInactive,
  calculateSessionTime,
  calculateRestTime,
  calculateSessionAverageRest,
  getSessionStatistics,
} from "../utils/session"

import {
  getEstimatedTimeRemaining,
  getEstimatedEndTime,
} from "../utils/timeEstimation"

import {
  isSetComplete,
  getSetDetails,
  getExerciseCompletedSets,
  isDayComplete,
  isDayLocked,
  shouldResetForMonday,
} from "../utils/dayCompletion"

import { useSyncManager } from "./hooks/useSyncManager"
import { useSessionOperations } from "./hooks/useSessionOperations"
import { useProgramOperations } from "./hooks/useProgramOperations"
import { useServerSync } from "./hooks/useServerSync"
import { useJointSession } from "./hooks/useJointSession"

import type {
  WorkoutData,
  CompletedDays,
  LockedDays,
  PendingSync,
} from "../types/index"
import type { WebSocketMessage } from "./hooks/useRealtimeSocket"
import type {
  JointSession,
  PartnerProgress,
  PartnerCompletedSet,
  WatchTarget,
  ExerciseEntry,
} from "./hooks/useJointSession"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by the analytics endpoint. Extend as fields become known. */
type ServerAnalyticsType = WorkoutAnalytics | null

interface WorkoutContextValue {
  socketLastMessage: WebSocketMessage | null
  workoutData: WorkoutData | null
  selectedPerson: string | null
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
  saveWorkoutData: (data: WorkoutData | null) => Promise<void>
  saveSelectedPerson: (person: string) => Promise<void>
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
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
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

  // ── Joint session exercise list ────────────────────────────────────────────
  // Computed with useMemo instead of an IIFE so it only re-runs when
  // workoutData or currentDay changes.
  const currentDayAllExercises = useMemo((): ExerciseEntry[] => {
    if (!workoutData?.days || !currentDay) return []
    const day = workoutData.days.find((d) => d.dayNumber === currentDay)
    if (!day?.people) return []
    const result: ExerciseEntry[] = []
    Object.entries(day.people).forEach(([person, personWorkout]) => {
      ;(personWorkout?.exercises ?? []).forEach((ex) => {
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
    selectedPerson,
    socket,
  })

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const analytics = await getAnalytics(selectedPerson, currentDay)
      if (analytics) {
        setServerAnalytics(analytics as WorkoutAnalytics)
        const avg = (analytics as WorkoutAnalytics).averageTimeBetweenSets
        if (!useManualTime && avg && avg > 0) setTimeBetweenSets(avg)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    }
  }, [selectedPerson, currentDay, useManualTime])

  // ── Hooks ──────────────────────────────────────────────────────────────────
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
    selectedPerson,
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
    selectedPerson,
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
  })

  // ── Save functions ─────────────────────────────────────────────────────────
  const saveWorkoutData = async (data: WorkoutData | null) => {
    await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, data, userId)
    setWorkoutData(data)
  }

  const saveSelectedPerson = async (person: string) => {
    await saveToStorage(STORAGE_KEYS.SELECTED_PERSON, person, userId)
    setSelectedPerson(person)
  }

  const saveCurrentDay = async (day: number) => {
    if (day !== currentDay && workoutStartTime) {
      console.log(
        `Switching from day ${currentDay} to day ${day}, clearing active workout`,
      )
      await sessionOps.clearActiveWorkout()
    }
    await saveToStorage(STORAGE_KEYS.CURRENT_DAY, day.toString(), userId)
    setCurrentDay(day)
  }

  const saveCompletedDays = async (completed: CompletedDays) => {
    await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, completed, userId)
    setCompletedDays(completed)
  }

  const saveLockedDays = async (locked: LockedDays) => {
    await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, locked, userId)
    setLockedDays(locked)
  }

  const saveUnlockedOverrides = async (overrides: Record<number, boolean>) => {
    await saveToStorage(STORAGE_KEYS.UNLOCKED_OVERRIDES, overrides, userId)
    setUnlockedOverrides(overrides)

    const newCompletedDays = { ...completedDays }
    let changed = false
    Object.keys(overrides).forEach((dayNumber) => {
      const key = dayNumber as unknown as keyof CompletedDays
      if (newCompletedDays[key]) {
        delete newCompletedDays[key]
        changed = true
      }
    })
    if (changed) {
      await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, newCompletedDays, userId)
      setCompletedDays(newCompletedDays)
    }
  }

  const saveTimeBetweenSets = async (seconds: number) => {
    await saveToStorage(
      STORAGE_KEYS.TIME_BETWEEN_SETS,
      seconds.toString(),
      userId,
    )
    setTimeBetweenSets(seconds)
  }

  const toggleUseManualTime = async (enabled: boolean) => {
    await saveToStorage(
      STORAGE_KEYS.USE_MANUAL_TIME,
      enabled.toString(),
      userId,
    )
    setUseManualTime(enabled)
    if (!enabled && selectedPerson) await fetchAnalytics()
  }

  const toggleDemoMode = async (enabled: boolean) => {
    await saveToStorage(STORAGE_KEYS.IS_DEMO_MODE, enabled.toString(), userId)
    setIsDemoMode(enabled)
    if (!enabled) {
      try {
        await clearDemoSessions()
      } catch (error) {
        console.error("Failed to clear demo sessions (offline):", error)
      }
    }
  }

  // ── Utility functions ──────────────────────────────────────────────────────
  const resetAllState = () => {
    setWorkoutData(null)
    setSelectedPerson(null)
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
    setIsLoading(false)
  }

  const loadSavedData = async () => {
    try {
      const data = await loadFromStorage(STORAGE_KEYS.WORKOUT_DATA, userId)
      const person = await loadFromStorage(
        STORAGE_KEYS.SELECTED_PERSON,
        userId,
        false,
      )
      const day = await loadFromStorage(STORAGE_KEYS.CURRENT_DAY, userId, false)
      const completed = await loadFromStorage(
        STORAGE_KEYS.COMPLETED_DAYS,
        userId,
      )
      const locked = await loadFromStorage(STORAGE_KEYS.LOCKED_DAYS, userId)
      const overrides = await loadFromStorage(
        STORAGE_KEYS.UNLOCKED_OVERRIDES,
        userId,
      )
      const lastReset = await loadFromStorage(
        STORAGE_KEYS.LAST_RESET_DATE,
        userId,
        false,
      )
      const timeBetween = await loadFromStorage(
        STORAGE_KEYS.TIME_BETWEEN_SETS,
        userId,
        false,
      )
      const startTime = await loadFromStorage(
        STORAGE_KEYS.WORKOUT_START_TIME,
        userId,
        false,
      )
      const sessionId = await loadFromStorage(
        STORAGE_KEYS.CURRENT_SESSION_ID,
        userId,
        false,
      )
      const demoMode = await loadFromStorage(
        STORAGE_KEYS.IS_DEMO_MODE,
        userId,
        false,
      )
      const manualTime = await loadFromStorage(
        STORAGE_KEYS.USE_MANUAL_TIME,
        userId,
        false,
      )
      const syncs = await loadFromStorage(STORAGE_KEYS.PENDING_SYNCS, userId)
      const activity = await loadFromStorage(
        STORAGE_KEYS.LAST_ACTIVITY_TIME,
        userId,
        false,
      )

      if (data) setWorkoutData(data as WorkoutData)
      if (person) setSelectedPerson(person as string)
      if (day) setCurrentDay(parseInt(day as string))
      if (completed) setCompletedDays(completed as CompletedDays)
      if (locked) setLockedDays(locked as LockedDays)
      if (overrides) setUnlockedOverrides(overrides as Record<number, boolean>)
      let loadedLastReset: string | null = null
      if (lastReset) {
        setLastResetDate(lastReset as string)
        loadedLastReset = lastReset as string
      }
      if (timeBetween) setTimeBetweenSets(parseInt(timeBetween as string))
      if (startTime) setWorkoutStartTime(startTime as string)
      if (sessionId) setCurrentSessionId(sessionId as string)
      if (demoMode) setIsDemoMode(demoMode === "true")
      if (manualTime) setUseManualTime(manualTime === "true")
      if (syncs) setPendingSyncs(syncs as PendingSync[])
      if (activity) setLastActivityTime(parseInt(activity as string))
      await checkMondayReset(loadedLastReset)
    } catch (error) {
      console.error("Error loading saved data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkMondayReset = async (resetDate: string | null) => {
    try {
      const dateToCheck = resetDate !== undefined ? resetDate : lastResetDate
      const newMondayDate = shouldResetForMonday(dateToCheck)
      if (newMondayDate) {
        console.log("Resetting completed days and locked days for new week!")
        await saveCompletedDays({})
        await saveLockedDays({})
        await saveToStorage(STORAGE_KEYS.LAST_RESET_DATE, newMondayDate, userId)
        setLastResetDate(newMondayDate)
      }
    } catch (error) {
      console.error("Error checking Monday reset:", error)
    }
  }

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

  const clearAllData = async () => {
    if (!userId) return
    const keys = Object.values(STORAGE_KEYS)
    await removeMultipleFromStorage(keys, userId)
    resetAllState()
  }

  const hasActiveSession = () =>
    !!workoutStartTime && !isDayLocked(lockedDays, currentDay)

  // ── Time estimation ────────────────────────────────────────────────────────
  const getEstimatedTimeRemainingForDay = (dayNumber: number) => {
    const sessionAverage = calculateSessionAverageRest(
      completedDays,
      dayNumber,
      workoutStartTime,
      timeBetweenSets,
    )
    return getEstimatedTimeRemaining(
      workoutData,
      selectedPerson,
      dayNumber,
      completedDays,
      timeBetweenSets,
      workoutStartTime,
      sessionAverage,
      useManualTime,
      serverAnalytics,
    )
  }

  const getEstimatedEndTimeForDay = (dayNumber: number): Date | null => {
    if (!workoutStartTime) return null
    const remainingSeconds = getEstimatedTimeRemainingForDay(dayNumber)
    return getEstimatedEndTime(remainingSeconds)
  }

  // ── Session statistics ─────────────────────────────────────────────────────
  const getTotalSessionTime = () => calculateSessionTime(workoutStartTime)
  const getCurrentRestTime = () => calculateRestTime(lastSetEndTime)
  const getSessionAverageRestTime = (dayNumber: number) =>
    calculateSessionAverageRest(
      completedDays,
      dayNumber,
      workoutStartTime,
      timeBetweenSets,
    )
  const getSessionStats = (dayNumber: number) =>
    getSessionStatistics(
      workoutStartTime,
      lastSetEndTime,
      completedDays,
      dayNumber,
      workoutData,
      selectedPerson,
      timeBetweenSets,
    )

  // ── Day completion ─────────────────────────────────────────────────────────
  const isSetCompleteFunc = (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
  ) => isSetComplete(completedDays, dayNumber, exerciseIndex, setIndex)
  const getSetDetailsFunc = (
    dayNumber: number,
    exerciseIndex: number,
    setIndex: number,
  ) => getSetDetails(completedDays, dayNumber, exerciseIndex, setIndex)
  const getExerciseCompletedSetsFunc = (
    dayNumber: number,
    exerciseIndex: number,
  ) => getExerciseCompletedSets(completedDays, dayNumber, exerciseIndex)
  const isDayCompleteFunc = (dayNumber: number) =>
    isDayComplete(
      lockedDays,
      dayNumber,
      workoutData,
      selectedPerson,
      completedDays,
    )
  const isDayLockedFunc = (dayNumber: number) =>
    isDayLocked(lockedDays, dayNumber)

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    jointSessionMessageHandlerRef.current = jointSessionHook.handleSocketMessage
  }, [jointSessionHook.handleSocketMessage])

  useEffect(() => {
    if (userId) void loadSavedData()
    else resetAllState()
  }, [userId])

  useEffect(() => {
    if (selectedPerson && !useManualTime && userId) void fetchAnalytics()
  }, [selectedPerson, currentDay, useManualTime, userId, fetchAnalytics])

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
      if (hadStaleSession && !useManualTime && selectedPerson)
        await fetchAnalytics()
    }
    void checkStaleSessionOnStart()
  }, [isLoading])

  useEffect(() => {
    if (isLoading || !userId || !selectedPerson || !workoutData) return
    if (hasSyncedRef.current) return
    hasSyncedRef.current = true
    void serverSync.syncFromServer()
  }, [isLoading, userId, selectedPerson])

  useEffect(() => {
    hasSyncedRef.current = false
  }, [selectedPerson, userId])

  useEffect(() => {
    if (!workoutStartTime || !currentSessionId) return
    const interval = setInterval(async () => {
      await checkAndEndStaleSession()
    }, 60_000)
    return () => clearInterval(interval)
  }, [workoutStartTime, currentSessionId, checkAndEndStaleSession])

  useEffect(() => {
    if (!userId) {
      setAuthToken(null)
      return
    }
    authService
      .getToken()
      .then((t) => setAuthToken(t))
      .catch(() => setAuthToken(null))
  }, [userId])

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

  // ── Context value ──────────────────────────────────────────────────────────
  const value: WorkoutContextValue = {
    socketLastMessage: socket.lastMessage,
    workoutData,
    selectedPerson,
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
    saveWorkoutData,
    saveSelectedPerson,
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
  }

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  )
}
