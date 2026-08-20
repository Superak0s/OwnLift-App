import { useCallback, useRef } from "react"
import {
  filterOutLocalSessionSyncs,
  getLocalISOString,
  isLocalSessionId,
} from "../../../utils/session"
import { generateId } from "../../../utils/format"
import { workoutApi } from "@features/workout/services/index"
import logger from "../../services/logger"
import type { WorkoutData } from "../../types"
import type { CompletedDays, LockedDays } from "../../../utils/dayCompletion"
import type { PendingSync } from "../../types"

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
  selectedSplit: string | null
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
    LAST_SET_END_TIME: string
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
  addPendingSync,
  useManualTime,
  fetchAnalytics,
  syncPendingData,
  pendingSyncs,
  setPendingSyncs,
}: UseSessionOperationsOptions): UseSessionOperationsReturn => {
  const updateLastActivityTime = useCallback(async (): Promise<void> => {
    const now = Date.now()
    await saveToStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, now, userId)
    setLastActivityTime(now)
  }, [saveToStorage, STORAGE_KEYS, userId, setLastActivityTime])

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

  const clearActiveWorkout = useCallback(async (): Promise<void> => {
    try {
      logger.debug("Clearing active workout session...")

      await removeFromStorage(STORAGE_KEYS.WORKOUT_START_TIME, userId)
      await removeFromStorage(STORAGE_KEYS.CURRENT_SESSION_ID, userId)
      await removeFromStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, userId)
      await removeFromStorage(STORAGE_KEYS.LAST_SET_END_TIME, userId)

      setWorkoutStartTime(null)
      setCurrentSessionId(null)
      setLastSetEndTime(null)
      setLastActivityTime(null)

      logger.info("✓ Active workout session cleared")
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

  // Guards against a double-tap (or any other concurrent caller) firing two
  // overlapping calls before the first one's setState has re-rendered —
  // both would otherwise read stale null currentSessionId/workoutStartTime
  // and each start a session on the server.
  const startWorkoutInFlightRef = useRef<Promise<string | null> | null>(null)
  const startWorkoutImplRef = useRef<(() => Promise<string | null>) | null>(
    null,
  )

  const startWorkout = useCallback((): Promise<string | null> => {
    if (startWorkoutInFlightRef.current) {
      return startWorkoutInFlightRef.current
    }
    const promise = startWorkoutImplRef.current!().finally(() => {
      startWorkoutInFlightRef.current = null
    })
    startWorkoutInFlightRef.current = promise
    return promise
  }, [])

  const startWorkoutImpl = useCallback(async (): Promise<string | null> => {
    try {
      if (workoutStartTime && currentSessionId) {
        logger.debug(
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

      if (!day) {
        console.error(
          "startWorkout: no matching day found for currentDay —",
          "workoutData may not be loaded yet, or currentDay is stale.",
          {
            currentDay,
            hasWorkoutData: !!workoutData,
            dayCount: workoutData?.days?.length,
          },
        )
        await removeFromStorage(STORAGE_KEYS.LAST_SET_END_TIME, userId)
        setLastSetEndTime(null)
        return null
      }

      const localSessionId = generateId("local")

      try {
        const sessionId = await workoutApi.startSession(
          selectedSplit,
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
          logger.info("✓ Session started, ID:", newSessionId)
        } else {
          console.error(
            "startSession resolved without a usable session ID — falling back to local session.",
            { sessionId },
          )
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
              split: selectedSplit ?? "",
              dayNumber: currentDay,
              dayTitle: day.dayTitle,
              muscleGroups: day.muscleGroups,
              isDemo: isDemoMode,
            },
            timestamp: startTime,
          })
          logger.warn(
            "⚠ Session queued for sync with local ID (no id returned):",
            newSessionId,
          )
        }
      } catch (error) {
        console.error("Failed to start session:", error)
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
            split: selectedSplit ?? "",
            dayNumber: currentDay,
            dayTitle: day.dayTitle,
            muscleGroups: day.muscleGroups,
            isDemo: isDemoMode,
          },
          timestamp: startTime,
        })
        logger.warn("⚠ Session queued for sync with local ID:", newSessionId)
      }

      await removeFromStorage(STORAGE_KEYS.LAST_SET_END_TIME, userId)
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
    selectedSplit,
    workoutData,
    isDemoMode,
    saveToStorage,
    removeFromStorage,
    setWorkoutStartTime,
    setCurrentSessionId,
    setLastSetEndTime,
    updateLastActivityTime,
    addPendingSync,
    userId,
    STORAGE_KEYS,
  ])
  startWorkoutImplRef.current = startWorkoutImpl

  const endWorkout = useCallback(
    async (autoCompleted: boolean = false): Promise<boolean> => {
      try {
        await lockDay(currentDay)

        const sessionIdToEnd = currentSessionId

        if (isLocalSessionId(sessionIdToEnd)) {
          logger.debug(
            "🧹 Cleaning up pending syncs for local session:",
            sessionIdToEnd,
          )

          // Drop only the endSession marker for this local session; queued
          // recordSet syncs are kept so they can be remapped to the real
          // server id once the startSession sync completes.
          const cleanedSyncs = filterOutLocalSessionSyncs(pendingSyncs, {
            sessionId: sessionIdToEnd,
            types: ["endSession"],
          })

          await saveToStorage(STORAGE_KEYS.PENDING_SYNCS, cleanedSyncs, userId)
          setPendingSyncs(cleanedSyncs)
          logger.debug(
            `🧹 Cleaned ${pendingSyncs.length - cleanedSyncs.length} invalid syncs`,
          )
        }

        if (sessionIdToEnd && !isLocalSessionId(sessionIdToEnd)) {
          try {
            await workoutApi.endSession(sessionIdToEnd, getLocalISOString())
            logger.info("✓ Session ended")
          } catch (error) {
            console.error("Failed to end session:", error)

            if (
              !(error as Error).message?.includes("not found") &&
              !(error as Error).message?.includes("unauthorized")
            ) {
              await addPendingSync({
                type: "endSession",
                data: { sessionId: sessionIdToEnd },
                timestamp: getLocalISOString(),
              })
              logger.warn("⚠ endSession queued for sync")
            } else {
              logger.warn(
                "⚠ Session doesn't exist anymore - not queuing sync",
              )
            }
          }
        } else if (isLocalSessionId(sessionIdToEnd)) {
          logger.warn("⚠ Local session - will be ended when startSession syncs")
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
        const startingNewSession = !workoutStartTime || !sessionId
        if (startingNewSession) {
          logger.debug("Starting new workout session...")
          sessionId = await startWorkout()
          logger.debug("Workout session started, session ID:", sessionId)
        }

        // startWorkout() already stamps activity time when it starts a new
        // session — avoid writing it twice in the same action.
        if (!startingNewSession) await updateLastActivityTime()

        const setStartTime =
          lastSetEndTime || workoutStartTime || getLocalISOString()
        const setEndTime = getLocalISOString()

        const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
        const exercise =
          day?.split?.[selectedSplit ?? ""]?.exercises?.[exerciseIndex]
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
            await workoutApi.recordSet(
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
            logger.debug("✓ Set recorded")
          } catch (error) {
            console.error("Failed to record set:", error)
            await addPendingSync({
              type: "recordSet",
              data: {
                sessionId,
                exerciseName,
                muscleGroup: muscleGroup ?? undefined,
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
            logger.warn("⚠ Set queued for sync")
          }
        } else {
          console.error("No session ID available - this should not happen!")
        }

        await saveToStorage(STORAGE_KEYS.LAST_SET_END_TIME, setEndTime, userId)
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
      selectedSplit,
      userId,
      STORAGE_KEYS,
    ],
  )

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
