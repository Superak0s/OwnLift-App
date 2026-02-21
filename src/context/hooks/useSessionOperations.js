import { useCallback } from "react"
import { generateLocalSessionId, isLocalSessionId } from "../utils/session"
import { startSession, recordSet, endSession } from "../../services/api"

/**
 * Returns the current local time as an ISO-8601 string that preserves the
 * user's timezone offset (e.g. "2026-02-19T14:30:00.000+02:00").
 * Using new Date().toISOString() always produces UTC ("…Z"), which is
 * why times appeared shifted for non-UTC users.
 */
const getLocalISOString = () => {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000 // offset in ms
  const localTime = new Date(now.getTime() - offsetMs) // shift to local
  const offsetMinutes = Math.abs(now.getTimezoneOffset())
  const sign = now.getTimezoneOffset() <= 0 ? "+" : "-"
  const hh = String(Math.floor(offsetMinutes / 60)).padStart(2, "0")
  const mm = String(offsetMinutes % 60).padStart(2, "0")
  // Replace the trailing "Z" with the real offset
  return localTime.toISOString().replace("Z", `${sign}${hh}:${mm}`)
}

/**
 * Session Operations Hook
 * Handles workout session start/end and set recording
 */

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
}) => {
  /**
   * Update last activity time
   */
  const updateLastActivityTime = useCallback(async () => {
    const now = Date.now()
    await saveToStorage(STORAGE_KEYS.LAST_ACTIVITY_TIME, now, userId)
    setLastActivityTime(now)
  }, [saveToStorage, STORAGE_KEYS, userId, setLastActivityTime])

  /**
   * Lock a day
   */
  const lockDay = useCallback(
    async (dayNumber) => {
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
  const clearActiveWorkout = useCallback(async () => {
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
  const startWorkout = useCallback(async () => {
    try {
      if (workoutStartTime && currentSessionId) {
        console.log(
          "Workout already started, returning existing session ID:",
          currentSessionId,
        )
        return currentSessionId
      }

      const startTime = getLocalISOString() // ← local time, not UTC
      await saveToStorage(STORAGE_KEYS.WORKOUT_START_TIME, startTime, userId)
      setWorkoutStartTime(startTime)

      await updateLastActivityTime()

      const day = workoutData?.days?.find((d) => d.dayNumber === currentDay)
      let newSessionId = null

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
            localSessionId: localSessionId,
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
    async (autoCompleted = false) => {
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
              !error.message?.includes("not found") &&
              !error.message?.includes("unauthorized")
            ) {
              await addPendingSync({
                type: "endSession",
                data: { sessionId: sessionIdToEnd },
                timestamp: getLocalISOString(), // ← local time, not UTC
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
   *
   * CHANGED: looks up the exercise name from workoutData by exerciseIndex
   * and sends that name (not the index) to the server.
   */
  const saveSetDetails = useCallback(
    async (
      dayNumber,
      exerciseIndex,
      setIndex,
      weight,
      reps,
      note = "",
      isWarmup = false,
    ) => {
      try {
        let sessionId = currentSessionId
        if (!workoutStartTime || !sessionId) {
          console.log("Starting new workout session...")
          sessionId = await startWorkout()
          console.log("Workout session started, session ID:", sessionId)
        }

        await updateLastActivityTime()

        const setStartTime =
          lastSetEndTime || workoutStartTime || getLocalISOString() // ← local time, not UTC
        const setEndTime = getLocalISOString() // ← local time, not UTC

        // Resolve exercise name from workoutData so the server gets a stable
        // string identifier rather than a positional index.
        const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
        const exercise =
          day?.people?.[selectedPerson]?.exercises?.[exerciseIndex]
        const exerciseName = exercise?.name ?? `Exercise ${exerciseIndex}`
        const muscleGroup = exercise?.muscleGroup ?? null

        const newCompleted = { ...completedDays }

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
              exerciseName, // ← name, not index
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
                exerciseName, // ← name, not index
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
    async (dayNumber, exerciseIndex, setIndex) => {
      try {
        const newCompletedDays = { ...completedDays }

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
