import { useCallback, useEffect, useRef } from "react"
import { programApi } from "@features/plan/services/index"
import { workoutApi } from "@features/workout/services/index"
import type {
  WorkoutData,
  CompletedDays,
  LockedDays,
  WorkoutSession,
  FullSession,
  SavedProgram,
} from "../../types"

/**
 * Server Sync Hook
 * Handles syncing state from server (session history, program updates)
 */

export interface UseServerSyncOptions {
  userId: string | null
  selectedSplit: string | null
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
  /**
   * Clears the locally-held active workout session (workoutStartTime,
   * currentSessionId, etc). Called when syncFromServer discovers that the
   * session the client still thinks is "active" was actually already ended
   * server-side (e.g. by the stale-session cleanup job after the app was
   * closed for 30+ minutes).
   */
  clearActiveWorkout: () => Promise<void>
}

export interface UseServerSyncReturn {
  fetchSessionHistory: (
    limit?: number,
    includeTimings?: boolean,
  ) => Promise<WorkoutSession[]>
  syncFromServer: () => Promise<CompletedDays | undefined>
}

/**
 * Returns the most recent Monday at 00:00:00 local time as a Date.
 */
function getCurrentWeekMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysFromMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export const useServerSync = ({
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
  clearActiveWorkout,
}: UseServerSyncOptions): UseServerSyncReturn => {
  // syncFromServer awaits a network round-trip (programApi.fetchSavedProgram)
  // before it merges and calls setWorkoutData. If local state changes while
  // that request is in flight — e.g. the user inserts/starts a template —
  // the closed-over `workoutData` param is stale by the time the merge
  // runs, so the merge (and the setWorkoutData it produces) would silently
  // discard whatever changed locally in the meantime. This ref always holds
  // the latest workoutData so the merge can be based on current state
  // instead of a snapshot from when the request started.
  const workoutDataRef = useRef(workoutData)
  useEffect(() => {
    workoutDataRef.current = workoutData
  }, [workoutData])

  // Mirrors currentSessionId so the async syncFromServer callback always
  // compares against the freshest value, not one captured when the sync
  // started (the same staleness concern as workoutDataRef above).
  const currentSessionIdRef = useRef(currentSessionId)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  /**
   * Fetch session history
   */
  const fetchSessionHistory = useCallback(
    async (
      limit: number = 30,
      includeTimings: boolean = false,
    ): Promise<WorkoutSession[]> => {
      try {
        const sessions = await workoutApi.getSessionHistory(
          selectedSplit,
          null,
          limit,
          includeTimings,
        )
        return (sessions as WorkoutSession[]) || []
      } catch (error) {
        console.error("Error fetching session history:", error)
        return []
      }
    },
    [selectedSplit],
  )

  /**
   * Sync completed days from server.
   */
  const syncFromServer = useCallback(async (): Promise<
    CompletedDays | undefined
  > => {
    if (!userId || !selectedSplit || !workoutDataRef.current?.days) return

    console.log("🔄 Syncing completedDays from server...")

    try {
      let currentWorkoutData = workoutDataRef.current

      // ── Refresh program from server ──────────────────────────────────────
      try {
        const savedProgram =
          (await programApi.fetchSavedProgram()) as SavedProgram | null

        if (savedProgram?.days) {
          // Rebase on whatever is in state RIGHT NOW, not on the
          // `currentWorkoutData` snapshot from when this function started —
          // fetchSavedProgram is a network call, and local state (e.g. a
          // template insert) may have moved on while we were waiting.
          const latestWorkoutData = workoutDataRef.current ?? currentWorkoutData
          const serverDayCount = savedProgram.days.length
          const localDayCount = latestWorkoutData.days.length

          if (serverDayCount >= localDayCount) {
            const mergedData: WorkoutData = {
              ...latestWorkoutData,
              days: latestWorkoutData.days.map((localDay) => {
                const serverDay = savedProgram.days.find(
                  (d) => d.dayNumber === localDay.dayNumber,
                )
                if (!serverDay) return localDay

                const mergedPeople = { ...localDay.split }
                Object.keys(serverDay.split || {}).forEach((person) => {
                  const serverPersonWorkout = serverDay.split[person]
                  const localPersonWorkout = localDay.split[person]

                  if (!localPersonWorkout) {
                    mergedPeople[person] = serverPersonWorkout
                    return
                  }

                  const serverExCount =
                    serverPersonWorkout?.exercises?.length ?? 0
                  const localExCount =
                    localPersonWorkout?.exercises?.length ?? 0

                  // Exercise count is only a crude proxy for "which side is
                  // newer". On a tie, prefer the LOCAL copy: an equal count can
                  // hide an un-pushed local rename or set-change, and taking the
                  // server copy would silently revert it. Only let the server
                  // win when it strictly has more exercises.
                  // TODO: replace this heuristic with real program versioning /
                  // updatedAt timestamps for a correct last-writer-wins merge.
                  mergedPeople[person] =
                    serverExCount > localExCount
                      ? serverPersonWorkout
                      : localPersonWorkout
                })

                return { ...localDay, split: mergedPeople }
              }),
            }

            currentWorkoutData = mergedData
            await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, mergedData, userId)
            setWorkoutData(mergedData)
            console.log("✅ Program refreshed from server")
          } else {
            // Local already has more days than the server (e.g. a template
            // insert that hasn't been pushed yet) — nothing to merge, but
            // the rest of this function should still reason about the
            // freshest local state, not the pre-await snapshot.
            currentWorkoutData = latestWorkoutData
          }
        }
      } catch (programErr) {
        console.warn(
          "Could not refresh program from server:",
          (programErr as Error).message,
        )
      }

      // ── Fetch session list ───────────────────────────────────────────────
      const allSessions = (await workoutApi.getSessionHistory(
        selectedSplit,
        null,
        100,
      )) as WorkoutSession[]

      if (!allSessions || allSessions.length === 0) {
        console.log("No server sessions found")
        return
      }

      // Only consider sessions from the current week (Monday 00:00 onwards).
      const weekStart = getCurrentWeekMonday()
      const sessions = allSessions.filter((s) => {
        const raw = s.start_time ?? s.created_at
        if (!raw) return false
        return new Date(raw) >= weekStart
      })

      if (sessions.length === 0) {
        console.log(
          "No server sessions found for the current week — skipping lock/completion sync",
        )
        return
      }

      // ── Fetch full session details in parallel ───────────────────────────
      const sessionResults = await Promise.all(
        sessions.map(async (session) => {
          try {
            const full = await workoutApi.getSession(String(session.id))
            return full as FullSession
          } catch (err) {
            console.warn(
              `Failed to fetch session ${session.id}:`,
              (err as Error).message,
            )
            return null
          }
        }),
      )

      // ── Build completed/locked maps ──────────────────────────────────────
      const newCompletedDays: CompletedDays = {}
      const newLockedDays: LockedDays = { ...lockedDays }

      // Set when we find that the session the client still thinks is
      // "active" already has an end_time server-side — i.e. it was closed
      // out from under the app (stale-session cleanup, another device,
      // manually via support, etc). Checked once after the loop so the
      // active-session cleanup happens exactly once per sync, regardless of
      // where in `sessionResults` the match turns up.
      let activeSessionWasEndedRemotely = false

      for (const fullSession of sessionResults) {
        if (!fullSession) continue

        const dayNumber = fullSession.day_number

        if (fullSession.end_time && !unlockedOverrides[dayNumber]) {
          newLockedDays[dayNumber] = true
        }

        if (
          fullSession.end_time &&
          currentSessionIdRef.current &&
          String(fullSession.id) === String(currentSessionIdRef.current)
        ) {
          activeSessionWasEndedRemotely = true
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

        const personWorkout = day.split[selectedSplit]
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
              weight: timing.weight ?? 0,
              reps: timing.reps ?? 0,
              completedAt: timing.end_time,
              note: timing.note ?? "",
              isWarmup: timing.is_warmup ?? false,
              source: "server",
            }
          }
        })
      }

      // ── Preserve in-progress local sets from current session ─────────────
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

      // ── Clear a locally "active" session that was actually already ended ──
      // Runs after storage/state above are settled so the day-lock state and
      // the active-session state land consistently rather than racing.
      if (activeSessionWasEndedRemotely) {
        console.log(
          "⚠ Current session was already ended server-side — clearing local active workout state",
        )
        try {
          await clearActiveWorkout()
        } catch (err) {
          console.warn(
            "Failed to clear locally-active workout after remote end:",
            (err as Error).message,
          )
        }
      }

      return newCompletedDays
    } catch (error) {
      console.error("❌ Sync failed:", error)
    }
  }, [
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
    clearActiveWorkout,
  ])

  return {
    fetchSessionHistory,
    syncFromServer,
  }
}
