/**
 * Session Management Utilities
 * Handles workout session operations
 */

import type { PendingSync, WorkoutData } from "@shared/types"
import type { CompletedDays } from "./dayCompletion"

export const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Remove pending-sync operations that reference a *local* (un-synced) session
 * id — they can't be replayed against the server as-is.
 *
 * Only `recordSet` and `endSession` syncs carry a session id; `startSession`
 * syncs are always kept (they're what mints the real server id).
 *
 * - With no `sessionId`, every sync pointing at any `local_…` session is
 *   dropped (bulk cleanup of orphaned syncs).
 * - With a `sessionId`, only syncs pointing at that exact session are dropped.
 * - `types` narrows which sync kinds are eligible for removal. It defaults to
 *   both id-bearing kinds; pass `["endSession"]` to drop the end marker while
 *   keeping queued `recordSet`s so they can be remapped once the session syncs.
 */
export const filterOutLocalSessionSyncs = (
  syncs: PendingSync[],
  options: {
    sessionId?: string | null
    types?: Array<PendingSync["type"]>
  } = {},
): PendingSync[] => {
  const { sessionId, types = ["endSession", "recordSet"] } = options
  return syncs.filter((sync) => {
    if (!types.includes(sync.type)) return true
    // Narrow to the id-bearing variants so `sync.data.sessionId` is valid
    // (startSession's data has no sessionId).
    if (sync.type !== "endSession" && sync.type !== "recordSet") return true
    if (sessionId != null) return sync.data.sessionId !== sessionId
    return !String(sync.data.sessionId).startsWith("local_")
  })
}

/**
 * Current time as an ISO-8601 string that preserves the device's local
 * timezone offset (instead of the UTC "Z" that Date.toISOString() emits).
 */
export const getLocalISOString = (): string => {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  const localTime = new Date(now.getTime() - offsetMs)
  const offsetMinutes = Math.abs(now.getTimezoneOffset())
  const sign = now.getTimezoneOffset() <= 0 ? "+" : "-"
  const hh = String(Math.floor(offsetMinutes / 60)).padStart(2, "0")
  const mm = String(offsetMinutes % 60).padStart(2, "0")
  return localTime.toISOString().replace("Z", `${sign}${hh}:${mm}`)
}

/**
 * Check if session is inactive
 */
export const isSessionInactive = (
  lastActivityTime: string | number | null,
): boolean => {
  if (!lastActivityTime) return false
  const elapsed = Date.now() - new Date(lastActivityTime).getTime()
  return elapsed > INACTIVITY_THRESHOLD_MS
}

/**
 * Generate local session ID
 */
export const generateLocalSessionId = (): string => {
  return `local_${Date.now()}`
}

/**
 * Check if session ID is local
 */
export const isLocalSessionId = (
  sessionId: string | null | undefined,
): boolean => {
  return sessionId?.startsWith("local_") ?? false
}

/**
 * Calculate total session time in seconds
 */
export const calculateSessionTime = (
  workoutStartTime: string | null,
): number => {
  if (!workoutStartTime) return 0

  const now = Date.now()
  const start = new Date(workoutStartTime).getTime()
  return Math.floor((now - start) / 1000)
}

/**
 * Calculate rest time since last set in seconds
 */
export const calculateRestTime = (lastSetEndTime: string | null): number => {
  if (!lastSetEndTime) return 0

  const now = Date.now()
  const lastEnd = new Date(lastSetEndTime).getTime()
  return Math.floor((now - lastEnd) / 1000)
}

/**
 * Calculate session average rest time
 */
export const calculateSessionAverageRest = (
  completedDays: CompletedDays,
  dayNumber: number,
  workoutStartTime: string | null,
  fallbackTime: number = 120,
): number => {
  if (!workoutStartTime || !completedDays[dayNumber]) return fallbackTime

  const dayData = completedDays[dayNumber]
  const setTimes: { time: number; isWarmup: boolean }[] = []

  Object.keys(dayData).forEach((exerciseIndex) => {
    const exerciseSets = dayData[Number(exerciseIndex)]
    Object.keys(exerciseSets).forEach((setIndex) => {
      const setData = exerciseSets[Number(setIndex)]
      const setTime = new Date(setData.completedAt).getTime()
      const sessionStart = new Date(workoutStartTime).getTime()

      if (setTime >= sessionStart) {
        setTimes.push({
          time: setTime,
          isWarmup: setData.isWarmup || false,
        })
      }
    })
  })

  setTimes.sort((a, b) => a.time - b.time)

  const allRestTimes: number[] = []
  for (let i = 1; i < setTimes.length; i++) {
    const restTime = Math.floor(
      (setTimes[i].time - setTimes[i - 1].time) / 1000,
    )
    if (restTime >= 10 && restTime <= 1200) {
      allRestTimes.push(restTime)
    }
  }

  if (allRestTimes.length === 0) return fallbackTime

  const sum = allRestTimes.reduce((acc, time) => acc + time, 0)
  return Math.round(sum / allRestTimes.length)
}

/**
 * Count completed sets for a day
 */
export const countCompletedSets = (
  completedDays: CompletedDays,
  dayNumber: number,
): number => {
  if (!completedDays[dayNumber]) return 0

  let count = 0
  const dayData = completedDays[dayNumber]

  Object.keys(dayData).forEach((exerciseIndex) => {
    const exerciseSets = dayData[Number(exerciseIndex)]
    if (exerciseSets) {
      count += Object.keys(exerciseSets).length
    }
  })

  return count
}

export interface SessionStatisticsResult {
  totalTime: number
  averageRest: number
  currentRest: number
  completedSets: number
  totalSets: number
}

/**
 * Get comprehensive session statistics
 */
export const getSessionStatistics = (
  workoutStartTime: string | null,
  lastSetEndTime: string | null,
  completedDays: CompletedDays,
  dayNumber: number,
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  timeBetweenSets: number,
): SessionStatisticsResult | null => {
  if (!workoutStartTime) return null

  const totalTime = calculateSessionTime(workoutStartTime)
  const averageRest = calculateSessionAverageRest(
    completedDays,
    dayNumber,
    workoutStartTime,
    timeBetweenSets,
  )
  const currentRest = calculateRestTime(lastSetEndTime)
  const completedSetsCount = countCompletedSets(completedDays, dayNumber)

  const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
  const totalSets = day?.people?.[selectedSplit ?? ""]?.totalSets || 0

  return {
    totalTime,
    averageRest,
    currentRest,
    completedSets: completedSetsCount,
    totalSets,
  }
}
