import { useCallback } from "react"
import type { WorkoutData } from "../../types/index"
import type { CompletedDays, LockedDays } from "../../utils/dayCompletion"

/**
 * Server Sync Hook
 * Handles syncing state from server (session history, program updates)
 */

export interface UseServerSyncOptions {
  userId: string | null
  selectedPerson: string | null
  workoutData: WorkoutData | null
  setWorkoutData: (data: WorkoutData) => void
  completedDays: CompletedDays
  lockedDays: LockedDays
  setCompletedDays: (days: CompletedDays) => void
  setLockedDays: (days: LockedDays) => void
  currentSessionId: string | null
  workoutStartTime: string | null
  unlockedOverrides: Record<number, boolean>
  saveToStorage: (
    key: string,
    value: unknown,
    userId: string | null,
  ) => Promise<boolean>
  STORAGE_KEYS: {
    WORKOUT_DATA: string
    COMPLETED_DAYS: string
    LOCKED_DAYS: string
  }
}

export interface UseServerSyncReturn {
  fetchSessionHistory: (
    limit?: number,
    includeTimings?: boolean,
  ) => Promise<unknown[]>
  syncFromServer: () => Promise<CompletedDays | undefined>
}

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
}: UseServerSyncOptions): UseServerSyncReturn => {
  /**
   * Fetch session history
   */
  const fetchSessionHistory = useCallback(
    async (
      limit: number = 30,
      includeTimings: boolean = false,
    ): Promise<unknown[]> => {
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
   */
  const syncFromServer = useCallback(async (): Promise<
    CompletedDays | undefined
  > => {
    if (!userId || !selectedPerson || !workoutData?.days) return

    console.log("🔄 Syncing completedDays from server...")

    try {
      const {
        getSessionHistory,
        getSession,
        programApi,
      } = require("../../services/api")

      let currentWorkoutData = workoutData
      try {
        const savedProgram = await programApi.fetchSavedProgram()
        if (savedProgram?.days) {
          const serverDayCount = savedProgram.days.length
          const localDayCount = currentWorkoutData.days.length

          if (serverDayCount >= localDayCount) {
            const mergedData: WorkoutData = {
              ...currentWorkoutData,
              days: currentWorkoutData.days.map((localDay) => {
                const serverDay = savedProgram.days.find(
                  (d: { dayNumber: number }) =>
                    d.dayNumber === localDay.dayNumber,
                )
                if (!serverDay) return localDay

                const mergedPeople = { ...localDay.people }
                Object.keys(serverDay.people || {}).forEach(
                  (person: string) => {
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
                  },
                )

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
          (programErr as Error).message,
        )
      }

      const sessions = await getSessionHistory(selectedPerson, null, 100)

      if (!sessions || sessions.length === 0) {
        console.log("No server sessions found")
        return
      }

      const newCompletedDays: CompletedDays = {}
      const newLockedDays: LockedDays = { ...lockedDays }

      for (const session of sessions) {
        let fullSession: {
          day_number: number
          end_time?: string
          set_timings?: Array<{
            exercise_name?: string
            set_index: number
            end_time: string
            weight?: number
            reps?: number
            note?: string
            is_warmup?: boolean
          }>
        }

        try {
          fullSession = await getSession(session.id)
        } catch (err) {
          console.warn(
            `Failed to fetch session ${session.id}:`,
            (err as Error).message,
          )
          continue
        }

        const dayNumber = fullSession.day_number

        if (fullSession.end_time && !unlockedOverrides[dayNumber]) {
          newLockedDays[dayNumber] = true
        }

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

      if (currentSessionId && !currentSessionId.startsWith("local_")) {
        Object.keys(completedDays).forEach((dayNumberStr) => {
          const dayNumber = Number(dayNumberStr)
          if (unlockedOverrides[dayNumber]) return

          Object.keys(completedDays[dayNumber] || {}).forEach(
            (exerciseIndexStr) => {
              const exerciseIndex = Number(exerciseIndexStr)
              Object.keys(
                completedDays[dayNumber][exerciseIndex] || {},
              ).forEach((setIndexStr) => {
                const setIndex = Number(setIndexStr)
                const localSet =
                  completedDays[dayNumber][exerciseIndex][setIndex]
                const setTime = new Date(localSet.completedAt).getTime()
                const sessionStart = new Date(workoutStartTime ?? "").getTime()

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
