/**
 * Time Estimation Utilities
 * Handles workout time estimation and calculations
 */

import type { WorkoutData } from "@shared/types"
import type { CompletedDays } from "./dayCompletion"

/**
 * Count remaining sets for a day
 */
export const countRemainingSets = (
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  dayNumber: number,
  completedDays: CompletedDays,
): number => {
  if (!workoutData?.days || !selectedSplit) return 0

  const day = workoutData.days.find((d) => d.dayNumber === dayNumber)
  if (!day || !day.people[selectedSplit]) return 0

  const exercises = day.people[selectedSplit].exercises || []

  let remainingSets = 0
  exercises.forEach((exercise, exerciseIndex) => {
    const completedSets = getCompletedExerciseSets(
      completedDays,
      dayNumber,
      exerciseIndex,
    )
    const plannedSets = exercise.sets
    remainingSets += Math.max(0, plannedSets - completedSets)
  })

  return remainingSets
}

/**
 * Get completed sets count for an exercise
 */
export const getCompletedExerciseSets = (
  completedDays: CompletedDays,
  dayNumber: number,
  exerciseIndex: number,
): number => {
  return Object.keys(completedDays[dayNumber]?.[exerciseIndex] || {}).length
}

/**
 * Get estimated time remaining in seconds
 */
export const getEstimatedTimeRemaining = (
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  dayNumber: number,
  completedDays: CompletedDays,
  timeBetweenSets: number,
  workoutStartTime: string | null,
  sessionAverageRest: number,
  useManualTime: boolean,
  serverAnalytics: { averageTimeBetweenSets?: number } | null | undefined,
): number => {
  if (!workoutData?.days || !selectedSplit) return 0

  const remainingSets = countRemainingSets(
    workoutData,
    selectedSplit,
    dayNumber,
    completedDays,
  )

  let avgTimeBetweenSets = timeBetweenSets

  if (workoutStartTime && sessionAverageRest > 0) {
    avgTimeBetweenSets = sessionAverageRest
  } else if (
    !useManualTime &&
    (serverAnalytics?.averageTimeBetweenSets ?? 0) > 0
  ) {
    avgTimeBetweenSets = serverAnalytics!.averageTimeBetweenSets!
  }

  return remainingSets * avgTimeBetweenSets
}

/**
 * Get estimated end time as Date object
 */
export const getEstimatedEndTime = (
  estimatedSecondsRemaining: number,
): Date => {
  const now = new Date()
  return new Date(now.getTime() + estimatedSecondsRemaining * 1000)
}

/**
 * Format a duration in seconds to a human readable string (e.g. "1h 5m", "45s").
 *
 * @param seconds  Duration in seconds.
 * @param fallback Optional string returned when `seconds` is falsy (0/NaN/undefined).
 *                 Pass "N/A" to reproduce the old per-screen behaviour; omit to
 *                 render "0s".
 */
export const formatTime = (
  seconds: number,
  fallback?: string,
): string => {
  if (fallback !== undefined && !seconds) return fallback

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}
