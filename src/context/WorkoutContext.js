import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react"
import { useAuth } from "./AuthContext"

// Utilities
import {
  STORAGE_KEYS,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  removeMultipleFromStorage,
} from "./utils/storage"

import {
  isSessionInactive,
  calculateSessionTime,
  calculateRestTime,
  calculateSessionAverageRest,
  getSessionStatistics,
} from "./utils/session"

import {
  getEstimatedTimeRemaining,
  getEstimatedEndTime,
  getCompletedExerciseSets,
} from "./utils/timeEstimation"

import {
  isSetComplete,
  getSetDetails,
  getExerciseCompletedSets,
  isDayComplete,
  isDayLocked,
  shouldResetForMonday,
} from "./utils/dayCompletion"

// Hooks
import { useSyncManager } from "./hooks/useSyncManager"
import { useSessionOperations } from "./hooks/useSessionOperations"
import { useProgramOperations } from "./hooks/useProgramOperations"
import { useServerSync } from "./hooks/useServerSync"

const WorkoutContext = createContext()

export const useWorkout = () => {
  const context = useContext(WorkoutContext)
  if (!context) {
    throw new Error("useWorkout must be used within a WorkoutProvider")
  }
  return context
}

export const WorkoutProvider = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id

  // ========================================
  // STATE
  // ========================================
  const [workoutData, setWorkoutData] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [completedDays, setCompletedDays] = useState({})
  const [lockedDays, setLockedDays] = useState({})
  const [unlockedOverrides, setUnlockedOverrides] = useState({})
  const [lastResetDate, setLastResetDate] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Time settings
  const [timeBetweenSets, setTimeBetweenSets] = useState(120)
  const [useManualTime, setUseManualTime] = useState(false)

  // Session state
  const [workoutStartTime, setWorkoutStartTime] = useState(null)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [lastSetEndTime, setLastSetEndTime] = useState(null)
  const [lastActivityTime, setLastActivityTime] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Analytics
  const [serverAnalytics, setServerAnalytics] = useState(null)

  // Sync state
  const [pendingSyncs, setPendingSyncs] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)

  const hasSyncedRef = useRef(false)

  // ========================================
  // FETCH ANALYTICS
  // ========================================
  const fetchAnalytics = async () => {
    try {
      const { getAnalytics } = require("../services/api")
      const analytics = await getAnalytics(selectedPerson, currentDay)
      if (analytics) {
        setServerAnalytics(analytics)
        if (!useManualTime && analytics.averageTimeBetweenSets > 0) {
          setTimeBetweenSets(analytics.averageTimeBetweenSets)
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    }
  }

  // ========================================
  // HOOKS
  // ========================================
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

  // ========================================
  // SAVE FUNCTIONS
  // ========================================
  const saveWorkoutData = async (data) => {
    await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, data, userId)
    setWorkoutData(data)
  }

  const saveSelectedPerson = async (person) => {
    await saveToStorage(STORAGE_KEYS.SELECTED_PERSON, person, userId)
    setSelectedPerson(person)
  }

  const saveCurrentDay = async (day) => {
    // Clear active workout when changing days
    if (day !== currentDay && workoutStartTime) {
      console.log(
        `Switching from day ${currentDay} to day ${day}, clearing active workout`,
      )
      await sessionOps.clearActiveWorkout()
    }

    await saveToStorage(STORAGE_KEYS.CURRENT_DAY, day.toString(), userId)
    setCurrentDay(day)
  }

  const saveCompletedDays = async (completed) => {
    await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, completed, userId)
    setCompletedDays(completed)
  }

  const saveLockedDays = async (locked) => {
    await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, locked, userId)
    setLockedDays(locked)
  }

  const saveUnlockedOverrides = async (overrides) => {
    await saveToStorage(STORAGE_KEYS.UNLOCKED_OVERRIDES, overrides, userId)
    setUnlockedOverrides(overrides)

    // Clear completed sets for any newly unlocked days
    const newCompletedDays = { ...completedDays }
    let changed = false
    Object.keys(overrides).forEach((dayNumber) => {
      if (newCompletedDays[dayNumber]) {
        delete newCompletedDays[dayNumber]
        changed = true
      }
    })
    if (changed) {
      await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, newCompletedDays, userId)
      setCompletedDays(newCompletedDays)
    }
  }

  const saveTimeBetweenSets = async (seconds) => {
    await saveToStorage(
      STORAGE_KEYS.TIME_BETWEEN_SETS,
      seconds.toString(),
      userId,
    )
    setTimeBetweenSets(seconds)
  }

  const toggleUseManualTime = async (enabled) => {
    await saveToStorage(
      STORAGE_KEYS.USE_MANUAL_TIME,
      enabled.toString(),
      userId,
    )
    setUseManualTime(enabled)

    if (!enabled && selectedPerson) {
      await fetchAnalytics()
    }
  }

  const toggleDemoMode = async (enabled) => {
    await saveToStorage(STORAGE_KEYS.IS_DEMO_MODE, enabled.toString(), userId)
    setIsDemoMode(enabled)

    if (!enabled) {
      const { clearDemoSessions } = require("../services/api")
      try {
        await clearDemoSessions()
      } catch (error) {
        console.error("Failed to clear demo sessions (offline):", error)
      }
    }
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
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
      let loadedLastReset = null

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

      if (data) setWorkoutData(data)
      if (person) setSelectedPerson(person)
      if (day) setCurrentDay(parseInt(day))
      if (completed) setCompletedDays(completed)
      if (locked) setLockedDays(locked)
      if (overrides) setUnlockedOverrides(overrides)
      if (lastReset) {
        setLastResetDate(lastReset)
        loadedLastReset = lastReset
      }
      if (timeBetween) setTimeBetweenSets(parseInt(timeBetween))
      if (startTime) setWorkoutStartTime(startTime)
      if (sessionId) setCurrentSessionId(sessionId)
      if (demoMode) setIsDemoMode(demoMode === "true")
      if (manualTime) setUseManualTime(manualTime === "true")
      if (syncs) setPendingSyncs(syncs)
      if (activity) setLastActivityTime(activity)
      await checkMondayReset(loadedLastReset)
    } catch (error) {
      console.error("Error loading saved data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkMondayReset = async (resetDate) => {
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

  const checkAndEndStaleSession = async () => {
    if (!workoutStartTime || !lastActivityTime || !currentSessionId)
      return false

    if (isSessionInactive(lastActivityTime)) {
      console.log("🔍 Detected stale session from previous app session")

      const dayAlreadyLocked = lockedDays[currentDay]

      if (!dayAlreadyLocked) {
        console.log("   → Locking day", currentDay)
        await sessionOps.lockDay(currentDay)
      }

      if (currentSessionId && !currentSessionId.startsWith("local_")) {
        console.log("   → Ending session on server")
        try {
          const { endSession } = require("../services/api")
          await endSession(currentSessionId, getLocalISOString())
          console.log("   ✅ Stale session ended successfully")
        } catch (error) {
          console.error("   ⚠️ Failed to end stale session:", error.message)
        }
      }

      await sessionOps.clearActiveWorkout()
      console.log("   ✅ Stale session cleaned up")

      return true
    }

    return false
  }

  const clearAllData = async () => {
    if (!userId) return

    const keys = Object.values(STORAGE_KEYS)
    await removeMultipleFromStorage(keys, userId)
    resetAllState()
  }

  const hasActiveSession = () => !!workoutStartTime

  // ========================================
  // TIME ESTIMATION FUNCTIONS
  // ========================================
  const getEstimatedTimeRemainingForDay = (dayNumber) => {
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

  const getEstimatedEndTimeForDay = (dayNumber) => {
    if (!workoutStartTime) return null

    const remainingSeconds = getEstimatedTimeRemainingForDay(dayNumber)
    return getEstimatedEndTime(remainingSeconds)
  }

  // ========================================
  // SESSION STATISTICS FUNCTIONS
  // ========================================
  const getTotalSessionTime = () => calculateSessionTime(workoutStartTime)

  const getCurrentRestTime = () => calculateRestTime(lastSetEndTime)

  const getSessionAverageRestTime = (dayNumber) =>
    calculateSessionAverageRest(
      completedDays,
      dayNumber,
      workoutStartTime,
      timeBetweenSets,
    )

  const getSessionStats = (dayNumber) =>
    getSessionStatistics(
      workoutStartTime,
      lastSetEndTime,
      completedDays,
      dayNumber,
      workoutData,
      selectedPerson,
      timeBetweenSets,
    )

  // ========================================
  // DAY COMPLETION FUNCTIONS
  // ========================================
  const isSetCompleteFunc = (dayNumber, exerciseIndex, setIndex) =>
    isSetComplete(completedDays, dayNumber, exerciseIndex, setIndex)

  const getSetDetailsFunc = (dayNumber, exerciseIndex, setIndex) =>
    getSetDetails(completedDays, dayNumber, exerciseIndex, setIndex)

  const getExerciseCompletedSetsFunc = (dayNumber, exerciseIndex) =>
    getExerciseCompletedSets(completedDays, dayNumber, exerciseIndex)

  const isDayCompleteFunc = (dayNumber) =>
    isDayComplete(
      lockedDays,
      dayNumber,
      workoutData,
      selectedPerson,
      completedDays,
    )

  const isDayLockedFunc = (dayNumber) => isDayLocked(lockedDays, dayNumber)

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    if (userId) {
      loadSavedData()
    } else {
      resetAllState()
    }
  }, [userId])

  useEffect(() => {
    if (selectedPerson && !useManualTime && userId) {
      fetchAnalytics()
    }
  }, [selectedPerson, currentDay, useManualTime, userId])

  useEffect(() => {
    if (!userId) return

    const syncInterval = setInterval(() => {
      if (pendingSyncs.length > 0 && !isSyncing) {
        syncManager.syncPendingData()
      }
    }, 30000)

    return () => clearInterval(syncInterval)
  }, [pendingSyncs, isSyncing, userId])

  useEffect(() => {
    if (!isLoading && userId && pendingSyncs.length > 0) {
      syncManager.cleanupInvalidSyncs()
    }
  }, [isLoading, userId])

  useEffect(() => {
    const checkStaleSessionOnStart = async () => {
      if (isLoading) return

      const hadStaleSession = await checkAndEndStaleSession()

      if (hadStaleSession && !useManualTime && selectedPerson) {
        await fetchAnalytics()
      }
    }

    checkStaleSessionOnStart()
  }, [isLoading])

  useEffect(() => {
    if (isLoading) return
    if (!userId || !selectedPerson || !workoutData) return
    if (hasSyncedRef.current) return

    hasSyncedRef.current = true
    serverSync.syncFromServer()
  }, [isLoading, userId, selectedPerson])

  useEffect(() => {
    hasSyncedRef.current = false
  }, [selectedPerson, userId])

  useEffect(() => {
    if (!workoutStartTime || !currentSessionId) return

    const interval = setInterval(async () => {
      await checkAndEndStaleSession()
    }, 60 * 1000) // check every minute

    return () => clearInterval(interval)
  }, [workoutStartTime, currentSessionId])
  // ========================================
  // CONTEXT VALUE
  // ========================================
  const value = {
    // State
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

    // Save functions
    saveWorkoutData,
    saveSelectedPerson,
    saveCurrentDay,
    saveCompletedDays,
    saveLockedDays,
    saveUnlockedOverrides,
    saveTimeBetweenSets,
    toggleUseManualTime,
    toggleDemoMode,

    // Session operations
    hasActiveSession,
    startWorkout: sessionOps.startWorkout,
    endWorkout: sessionOps.endWorkout,
    saveSetDetails: sessionOps.saveSetDetails,
    deleteSetDetails: sessionOps.deleteSetDetails,
    lockDay: sessionOps.lockDay,
    clearActiveWorkout: sessionOps.clearActiveWorkout,

    // Day completion
    isSetComplete: isSetCompleteFunc,
    getSetDetails: getSetDetailsFunc,
    getExerciseCompletedSets: getExerciseCompletedSetsFunc,
    isDayComplete: isDayCompleteFunc,
    isDayLocked: isDayLockedFunc,

    // Time estimation
    getEstimatedTimeRemaining: getEstimatedTimeRemainingForDay,
    getEstimatedEndTime: getEstimatedEndTimeForDay,

    // Session statistics
    getTotalSessionTime,
    getCurrentRestTime,
    getSessionAverageRestTime,
    getSessionStats,

    // Program operations
    updateExerciseName: programOps.updateExerciseName,
    addExtraSetsToExercise: programOps.addExtraSetsToExercise,
    addNewExercise: programOps.addNewExercise,

    // Server sync
    fetchAnalytics,
    fetchSessionHistory: serverSync.fetchSessionHistory,
    syncFromServer: serverSync.syncFromServer,

    // Sync manager
    syncPendingData: syncManager.syncPendingData,
    cleanupInvalidSyncs: syncManager.cleanupInvalidSyncs,

    // Utilities
    clearAllData,
    checkAndEndStaleSession,
  }

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  )
}
