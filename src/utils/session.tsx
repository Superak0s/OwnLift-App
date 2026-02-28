/**
 * Session Management Utilities
 * Handles workout session operations
 */

import type { WorkoutData } from "../types/index"
import type { CompletedDays } from "./dayCompletion"

export const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

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
  selectedPerson: string | null,
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
  const totalSets = day?.people?.[selectedPerson ?? ""]?.totalSets || 0

  return {
    totalTime,
    averageRest,
    currentRest,
    completedSets: completedSetsCount,
    totalSets,
  }
}
