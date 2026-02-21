import { useCallback } from "react"

/**
 * Server Sync Hook
 * Handles syncing state from server (session history, program updates)
 */

export const useServerSync = ({
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
}) => {
  /**
   * Fetch session history
   */
  const fetchSessionHistory = useCallback(
    async (limit = 30, includeTimings = false) => {
      try {
        const { getSessionHistory } = require("../../services/api")
        const sessions = await getSessionHistory(
          selectedPerson,
          null,
          limit,
          includeTimings,
        )
        return sessions || []
      } catch (error) {
        console.error("Error fetching session history:", error)
        return []
      }
    },
    [selectedPerson],
  )
  /**
   * Sync completed days from server.
   *
   * KEY BEHAVIOUR: Days that are in unlockedOverrides are treated as
   * intentionally unlocked by the user (e.g. via Settings → Unlock Day).
   * For those days we do NOT re-lock them and do NOT re-populate their
   * completed sets from server history, so the Workout screen shows them
   * as fresh/empty after the user unlocks.
   */
  const syncFromServer = useCallback(async () => {
    if (!userId || !selectedPerson || !workoutData?.days) return

    console.log("🔄 Syncing completedDays from server...")

    try {
      const {
        getSessionHistory,
        getSession,
        programApi,
      } = require("../../services/api")

      // Step 1: Refresh program from server
      let currentWorkoutData = workoutData
      try {
        const savedProgram = await programApi.fetchSavedProgram()
        if (savedProgram?.days) {
          const serverDayCount = savedProgram.days.length
          const localDayCount = currentWorkoutData.days.length

          if (serverDayCount >= localDayCount) {
            const mergedData = {
              ...currentWorkoutData,
              days: currentWorkoutData.days.map((localDay) => {
                const serverDay = savedProgram.days.find(
                  (d) => d.dayNumber === localDay.dayNumber,
                )
                if (!serverDay) return localDay

                const mergedPeople = { ...localDay.people }
                Object.keys(serverDay.people || {}).forEach((person) => {
                  const serverPersonWorkout = serverDay.people[person]
                  const localPersonWorkout = localDay.people[person]

                  if (!localPersonWorkout) {
                    mergedPeople[person] = serverPersonWorkout
                    return
                  }

                  const serverExCount =
                    serverPersonWorkout?.exercises?.length || 0
                  const localExCount =
                    localPersonWorkout?.exercises?.length || 0

                  mergedPeople[person] =
                    serverExCount >= localExCount
                      ? serverPersonWorkout
                      : localPersonWorkout
                })

                return { ...localDay, people: mergedPeople }
              }),
            }

            currentWorkoutData = mergedData
            await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, mergedData, userId)
            setWorkoutData(mergedData)
            console.log("✅ Program refreshed from server")
          }
        }
      } catch (programErr) {
        console.warn(
          "Could not refresh program from server:",
          programErr.message,
        )
      }

      // Step 2: Fetch sessions and rebuild completedDays
      const sessions = await getSessionHistory(selectedPerson, null, 100)

      if (!sessions || sessions.length === 0) {
        console.log("No server sessions found")
        return
      }

      const newCompletedDays = {}
      const newLockedDays = { ...lockedDays }

      for (const session of sessions) {
        let fullSession
        try {
          fullSession = await getSession(session.id)
        } catch (err) {
          console.warn(`Failed to fetch session ${session.id}:`, err.message)
          continue
        }

        const dayNumber = fullSession.day_number

        // Don't re-lock days the user has intentionally unlocked
        if (fullSession.end_time && !unlockedOverrides[dayNumber]) {
          newLockedDays[dayNumber] = true
        }

        // Skip repopulating sets for days the user has manually unlocked.
        // This ensures the Workout screen stays empty/fresh after an unlock.
        if (unlockedOverrides[dayNumber]) {
          console.log(`↩ Skipping set sync for unlocked day ${dayNumber}`)
          continue
        }

        if (!fullSession.set_timings || fullSession.set_timings.length === 0) {
          continue
        }

        const day = currentWorkoutData.days.find(
          (d) => d.dayNumber === dayNumber,
        )
        if (!day) continue

        const personWorkout = day.people[selectedPerson]
        if (!personWorkout?.exercises) continue

        if (!newCompletedDays[dayNumber]) {
          newCompletedDays[dayNumber] = {}
        }

        fullSession.set_timings.forEach((timing, fallbackIndex) => {
          // Resolve local exerciseIndex by matching exercise_name from the
          // server JOIN. Fall back to timing position if no match found.
          const exerciseName = timing.exercise_name
          let exerciseIndex = fallbackIndex

          if (exerciseName) {
            const idx = personWorkout.exercises.findIndex(
              (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase(),
            )
            if (idx !== -1) exerciseIndex = idx
          }

          const setIndex = timing.set_index

          if (!newCompletedDays[dayNumber][exerciseIndex]) {
            newCompletedDays[dayNumber][exerciseIndex] = {}
          }

          const existing = newCompletedDays[dayNumber][exerciseIndex][setIndex]
          const serverTime = new Date(timing.end_time).getTime()
          const existingTime = existing
            ? new Date(existing.completedAt).getTime()
            : 0

          if (!existing || serverTime > existingTime) {
            newCompletedDays[dayNumber][exerciseIndex][setIndex] = {
              weight: timing.weight || 0,
              reps: timing.reps || 0,
              completedAt: timing.end_time,
              note: timing.note || "",
              isWarmup: timing.is_warmup || false,
              source: "server",
            }
          }
        })
      }

      // Step 3: Merge local sets from the current active session
      if (currentSessionId && !currentSessionId.startsWith("local_")) {
        Object.keys(completedDays).forEach((dayNumber) => {
          // Don't re-merge sets for unlocked days either
          if (unlockedOverrides[dayNumber]) return

          Object.keys(completedDays[dayNumber] || {}).forEach(
            (exerciseIndex) => {
              Object.keys(
                completedDays[dayNumber][exerciseIndex] || {},
              ).forEach((setIndex) => {
                const localSet =
                  completedDays[dayNumber][exerciseIndex][setIndex]
                const setTime = new Date(localSet.completedAt).getTime()
                const sessionStart = new Date(workoutStartTime).getTime()

                if (setTime >= sessionStart) {
                  if (!newCompletedDays[dayNumber])
                    newCompletedDays[dayNumber] = {}
                  if (!newCompletedDays[dayNumber][exerciseIndex])
                    newCompletedDays[dayNumber][exerciseIndex] = {}
                  if (!newCompletedDays[dayNumber][exerciseIndex][setIndex]) {
                    newCompletedDays[dayNumber][exerciseIndex][setIndex] =
                      localSet
                  }
                }
              })
            },
          )
        })
      }

      await saveToStorage(STORAGE_KEYS.COMPLETED_DAYS, newCompletedDays, userId)
      await saveToStorage(STORAGE_KEYS.LOCKED_DAYS, newLockedDays, userId)
      setCompletedDays(newCompletedDays)
      setLockedDays(newLockedDays)

      console.log(
        "✅ Sync complete:",
        Object.keys(newCompletedDays).length,
        "days synced,",
        Object.keys(newLockedDays).length,
        "days locked",
      )

      return newCompletedDays
    } catch (error) {
      console.error("❌ Sync failed:", error)
    }
  }, [
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
  ])

  return {
    fetchSessionHistory,
    syncFromServer,
  }
}
