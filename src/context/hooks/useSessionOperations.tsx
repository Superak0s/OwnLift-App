import { useCallback } from "react"
import { generateLocalSessionId, isLocalSessionId } from "../../utils/session"
import { startSession, recordSet, endSession } from "../../services/api"
import type { WorkoutData } from "../../types/index"
import type { CompletedDays, LockedDays } from "../../utils/dayCompletion"
import type { PendingSync } from "../../types/index"

/**
 * Returns the current local time as an ISO-8601 string that preserves the
 * user's timezone offset (e.g. "2026-02-19T14:30:00.000+02:00").
 */
const getLocalISOString = (): string => {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  const localTime = new Date(now.getTime() - offsetMs)
  const offsetMinutes = Math.abs(now.getTimezoneOffset())
  const sign = now.getTimezoneOffset() <= 0 ? "+" : "-"
  const hh = String(Math.floor(offsetMinutes / 60)).padStart(2, "0")
  const mm = String(offsetMinutes % 60).padStart(2, "0")
  return localTime.toISOString().replace("Z", `${sign}${hh}:${mm}`)
}

export interface UseSessionOperationsOptions {
  workoutStartTime: string | null
  setWorkoutStartTime: (time: string | null) => void
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
  lastSetEndTime: string | null
  setLastSetEndTime: (time: string | null) => void
  lastActivityTime: number | null
  setLastActivityTime: (time: number | null) => void
  currentDay: number
  selectedPerson: string | null
  workoutData: WorkoutData | null
  isDemoMode: boolean
  completedDays: CompletedDays
  setCompletedDays: (days: CompletedDays) => void
  lockedDays: LockedDays
  setLockedDays: (days: LockedDays) => void
  unlockedOverrides: Record<number, boolean>
  setUnlockedOverrides: (overrides: Record<number, boolean>) => void
  userId: string | null
  saveToStorage: (
    key: string,
    value: unknown,
    userId: string | null,
  ) => Promise<boolean>
  removeFromStorage: (key: string, userId: string | null) => Promise<boolean>
  STORAGE_KEYS: {
    LAST_ACTIVITY_TIME: string
    LOCKED_DAYS: string
    UNLOCKED_OVERRIDES: string
    WORKOUT_START_TIME: string
    CURRENT_SESSION_ID: string
    COMPLETED_DAYS: string
    PENDING_SYNCS: string
  }
  addPendingSync: (sync: PendingSync) => Promise<void>
  useManualTime: boolean
  fetchAnalytics?: (() => Promise<void>) | null
  syncPendingData?: (() => Promise<void>) | null
  pendingSyncs: PendingSync[]
  setPendingSyncs: (syncs: PendingSync[]) => void
}

export interface UseSessionOperationsReturn {
  updateLastActivityTime: () => Promise<void>
  lockDay: (dayNumber: number) => Promise<void>
  clearActiveWorkout: () => Promise<void>
  startWorkout: () => Promise<string | null>
  endWorkout: (autoCompleted?: boolean) => Promise<boolean>
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
}

export const useSessionOperations = ({
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
  addPendingSync,
  useManualTime,
  fetchAnalytics,
  syncPendingData,
  pendingSyncs,
  setPendingSyncs,
}: UseSessionOperationsOptions): UseSessionOperationsReturn => {
  /**
   * Update last activity time
   */
  const updateLastActivityTime = useCallback(async (): Promise<void> => {
    const now = Date.now()
    await saveToStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, now, userId)
    setLastActivityTime(now)
  }, [saveToStorage, STORAGE_KEYS, userId, setLastActivityTime])

  /**
   * Lock a day
   */
  const lockDay = useCallback(
    async (dayNumber: number): Promise<void> => {
      try {
        const newLockedDays = { ...lockedDays, [dayNumber]: true }
        await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, newLockedDays, userId)
        setLockedDays(newLockedDays)

        if (unlockedOverrides[dayNumber]) {
          const newOverrides = { ...unlockedOverrides }
          delete newOverrides[dayNumber]
          await saveToStorage(
            STORAGE_KEYS.UNLOCKED_OVERRIDES,
            newOverrides,
            userId,
          )
          setUnlockedOverrides(newOverrides)
        }
      } catch (error) {
        console.error("Error locking day:", error)
      }
    },
    [
      lockedDays,
      setLockedDays,
      unlockedOverrides,
      setUnlockedOverrides,
      userId,
      saveToStorage,
      STORAGE_KEYS,
    ],
  )

  /**
   * Clear active workout session
   */
  const clearActiveWorkout = useCallback(async (): Promise<void> => {
    try {
      console.log("Clearing active workout session...")

      await removeFromStorage(STORAGE_KEYS.WORKOUT_START_TIME, userId)
      await removeFromStorage(STORAGE_KEYS.CURRENT_SESSION_ID, userId)
      await removeFromStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, userId)

      setWorkoutStartTime(null)
      setCurrentSessionId(null)
      setLastSetEndTime(null)
      setLastActivityTime(null)

      console.log("✓ Active workout session cleared")
    } catch (error) {
      console.error("Error clearing active workout:", error)
    }
  }, [
    removeFromStorage,
    STORAGE_KEYS,
    userId,
    setWorkoutStartTime,
    setCurrentSessionId,
    setLastSetEndTime,
    setLastActivityTime,
  ])

  /**
   * Start workout session
   */
  const startWorkout = useCallback(async (): Promise<string | null> => {
    try {
      if (workoutStartTime && currentSessionId) {
        console.log(
          "Workout already started, returning existing session ID:",
          currentSessionId,
        )
        return currentSessionId
      }

      const startTime = getLocalISOString()
      await saveToStorage(STORAGE_KEYS.WORKOUT_START_TIME, startTime, userId)
      setWorkoutStartTime(startTime)

      await updateLastActivityTime()

      const day = workoutData?.days?.find((d) => d.dayNumber === currentDay)
      let newSessionId: string | null = null

      if (day) {
        const localSessionId = generateLocalSessionId()

        try {
          const sessionId = await startSession(
            selectedPerson,
            currentDay,
            day.dayTitle,
            day.muscleGroups,
            isDemoMode,
            startTime,
          )

          if (sessionId) {
            newSessionId = String(sessionId)
            await saveToStorage(
              STORAGE_KEYS.CURRENT_SESSION_ID,
              newSessionId,
              userId,
            )
            setCurrentSessionId(newSessionId)
            console.log("✓ Session started on server with ID:", newSessionId)
          }
        } catch (error) {
          console.error("Failed to start session on server (offline):", error)
          newSessionId = localSessionId
          await saveToStorage(
            STORAGE_KEYS.CURRENT_SESSION_ID,
            newSessionId,
            userId,
          )
          setCurrentSessionId(newSessionId)

          await addPendingSync({
            type: "startSession",
            localSessionId,
            data: {
              person: selectedPerson,
              dayNumber: currentDay,
              dayTitle: day.dayTitle,
              muscleGroups: day.muscleGroups,
              isDemo: isDemoMode,
            },
            timestamp: startTime,
          })
          console.log("⚠ Session queued for sync with local ID:", newSessionId)
        }
      }

      setLastSetEndTime(null)
      return newSessionId
    } catch (error) {
      console.error("Error starting workout:", error)
      return null
    }
  }, [
    workoutStartTime,
    currentSessionId,
    currentDay,
    selectedPerson,
    workoutData,
    isDemoMode,
    saveToStorage,
    setWorkoutStartTime,
    setCurrentSessionId,
    setLastSetEndTime,
    updateLastActivityTime,
    addPendingSync,
    userId,
    STORAGE_KEYS,
  ])

  /**
   * End workout session
   */
  const endWorkout = useCallback(
    async (autoCompleted: boolean = false): Promise<boolean> => {
      try {
        await lockDay(currentDay)

        const sessionIdToEnd = currentSessionId

        if (isLocalSessionId(sessionIdToEnd)) {
          console.log(
            "🧹 Cleaning up pending syncs for local session:",
            sessionIdToEnd,
          )

          const cleanedSyncs = pendingSyncs.filter((sync) => {
            if (
              sync.type === "endSession" &&
              sync.data.sessionId === sessionIdToEnd
            ) {
              console.log("  Removed: endSession for local session")
              return false
            }
            return true
          })

          await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, cleanedSyncs, userId)
          setPendingSyncs(cleanedSyncs)
          console.log(
            `🧹 Cleaned ${pendingSyncs.length - cleanedSyncs.length} invalid syncs`,
          )
        }

        if (sessionIdToEnd && !isLocalSessionId(sessionIdToEnd)) {
          try {
            await endSession(sessionIdToEnd, getLocalISOString())
            console.log("✓ Session ended on server")
          } catch (error) {
            console.error("Failed to end session on server:", error)

            if (
              !(error as Error).message?.includes("not found") &&
              !(error as Error).message?.includes("unauthorized")
            ) {
              await addPendingSync({
                type: "endSession",
                data: { sessionId: sessionIdToEnd },
                timestamp: getLocalISOString(),
              })
              console.log("⚠ endSession queued for sync")
            } else {
              console.log(
                "⚠ Session doesn't exist on server - not queuing sync",
              )
            }
          }
        } else if (isLocalSessionId(sessionIdToEnd)) {
          console.log("⚠ Local session - will be ended when startSession syncs")
        }

        await clearActiveWorkout()

        if (!useManualTime && fetchAnalytics) {
          await fetchAnalytics()
        }

        if (pendingSyncs.length > 0 && syncPendingData) {
          setTimeout(() => syncPendingData(), 1000)
        }

        return autoCompleted
      } catch (error) {
        console.error("Error ending workout:", error)
        return false
      }
    },
    [
      currentDay,
      currentSessionId,
      pendingSyncs,
      lockDay,
      clearActiveWorkout,
      addPendingSync,
      syncPendingData,
      useManualTime,
      fetchAnalytics,
      saveToStorage,
      setPendingSyncs,
      userId,
      STORAGE_KEYS,
    ],
  )

  /**
   * Save set details.
   */
  const saveSetDetails = useCallback(
    async (
      dayNumber: number,
      exerciseIndex: number,
      setIndex: number,
      weight: number,
      reps: number,
      note: string = "",
      isWarmup: boolean = false,
    ): Promise<void> => {
      try {
        let sessionId = currentSessionId
        if (!workoutStartTime || !sessionId) {
          console.log("Starting new workout session...")
          sessionId = await startWorkout()
          console.log("Workout session started, session ID:", sessionId)
        }

        await updateLastActivityTime()

        const setStartTime =
          lastSetEndTime || workoutStartTime || getLocalISOString()
        const setEndTime = getLocalISOString()

        const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
        const exercise =
          day?.people?.[selectedPerson ?? ""]?.exercises?.[exerciseIndex]
        const exerciseName = exercise?.name ?? `Exercise ${exerciseIndex}`
        const muscleGroup = exercise?.muscleGroup ?? null

        const newCompleted: CompletedDays = { ...completedDays }

        if (!newCompleted[dayNumber]) newCompleted[dayNumber] = {}
        if (!newCompleted[dayNumber][exerciseIndex])
          newCompleted[dayNumber][exerciseIndex] = {}

        newCompleted[dayNumber][exerciseIndex][setIndex] = {
          weight: weight || 0,
          reps: reps || 0,
          completedAt: setEndTime,
          note: note || "",
          isWarmup: isWarmup || false,
        }

        await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, newCompleted, userId)
        setCompletedDays(newCompleted)

        if (sessionId) {
          try {
            await recordSet(
              sessionId,
              exerciseName,
              setIndex,
              setStartTime,
              setEndTime,
              weight,
              reps,
              note,
              isWarmup,
              muscleGroup,
            )
            console.log("✓ Set recorded on server")
          } catch (error) {
            console.error("Failed to record set on server (offline):", error)
            await addPendingSync({
              type: "recordSet",
              data: {
                sessionId,
                exerciseName,
                muscleGroup,
                setIndex,
                startTime: setStartTime,
                endTime: setEndTime,
                weight: weight || 0,
                reps: reps || 0,
                note: note || "",
                isWarmup: isWarmup || false,
              },
              timestamp: setEndTime,
            })
            console.log("⚠ Set queued for sync")
          }
        } else {
          console.error("No session ID available - this should not happen!")
        }

        setLastSetEndTime(setEndTime)
      } catch (error) {
        console.error("Error saving set details:", error)
      }
    },
    [
      currentSessionId,
      workoutStartTime,
      lastSetEndTime,
      completedDays,
      setCompletedDays,
      setLastSetEndTime,
      startWorkout,
      updateLastActivityTime,
      addPendingSync,
      saveToStorage,
      workoutData,
      selectedPerson,
      userId,
      STORAGE_KEYS,
    ],
  )

  /**
   * Delete set details
   */
  const deleteSetDetails = useCallback(
    async (
      dayNumber: number,
      exerciseIndex: number,
      setIndex: number,
    ): Promise<boolean> => {
      try {
        const newCompletedDays: CompletedDays = { ...completedDays }

        if (newCompletedDays[dayNumber]?.[exerciseIndex]?.[setIndex]) {
          delete newCompletedDays[dayNumber][exerciseIndex][setIndex]

          if (
            Object.keys(newCompletedDays[dayNumber][exerciseIndex]).length === 0
          ) {
            delete newCompletedDays[dayNumber][exerciseIndex]
          }

          if (Object.keys(newCompletedDays[dayNumber]).length === 0) {
            delete newCompletedDays[dayNumber]
          }

          await saveToStorage(
            STORAGE_KEYS.COMPLETED_DAYS,
            newCompletedDays,
            userId,
          )
          setCompletedDays(newCompletedDays)
          return true
        }

        return false
      } catch (error) {
        console.error("Error deleting set details:", error)
        return false
      }
    },
    [completedDays, setCompletedDays, saveToStorage, userId, STORAGE_KEYS],
  )

  return {
    updateLastActivityTime,
    lockDay,
    clearActiveWorkout,
    startWorkout,
    endWorkout,
    saveSetDetails,
    deleteSetDetails,
  }
}
