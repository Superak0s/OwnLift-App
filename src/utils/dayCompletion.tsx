/**
 * Day Completion Utilities
 * Handles day completion checks and validations
 */

import type { WorkoutData } from "@shared/types"
import type {
  CompletedDays,
  CompletedExercises,
  LockedDays,
  SetDetail,
} from "@shared/types"

// Single source of truth lives in @shared/types. These re-exports/aliases keep
// the historical names this module (and its importers) have always used:
//   • CompletedSets here = the per-day exercise→set map (shared CompletedExercises)
//   • SetDetails         = shared SetDetail
export type { CompletedDays, LockedDays }
export type CompletedSets = CompletedExercises
export type SetDetails = SetDetail

/**
 * Check if a specific set is complete
 */
export const isSetComplete = (
  completedDays: CompletedDays,
  dayNumber: number,
  exerciseIndex: number,
  setIndex: number,
): boolean => {
  return !!completedDays[dayNumber]?.[exerciseIndex]?.[setIndex]
}

/**
 * Get details of a specific set
 */
export const getSetDetails = (
  completedDays: CompletedDays,
  dayNumber: number,
  exerciseIndex: number,
  setIndex: number,
): SetDetails | null => {
  return completedDays[dayNumber]?.[exerciseIndex]?.[setIndex] || null
}

/**
 * Get count of completed sets for an exercise
 */
export const getExerciseCompletedSets = (
  completedDays: CompletedDays,
  dayNumber: number,
  exerciseIndex: number,
): number => {
  return Object.keys(completedDays[dayNumber]?.[exerciseIndex] || {}).length
}

/**
 * Check if all exercises in a day are complete
 */
export const areAllExercisesComplete = (
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  dayNumber: number,
  completedDays: CompletedDays,
): boolean => {
  if (!workoutData?.days || !selectedSplit) return false

  const day = workoutData.days.find((d) => d.dayNumber === dayNumber)
  if (!day || !day.split[selectedSplit]) return false

  const exercises = day.split[selectedSplit].exercises || []
  if (exercises.length === 0) return false

  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i]
    const completedSets = getExerciseCompletedSets(completedDays, dayNumber, i)
    if (completedSets < exercise.sets) {
      return false
    }
  }

  return true
}

/**
 * Check if a day is complete (locked or all sets done)
 */
export const isDayComplete = (
  lockedDays: LockedDays,
  dayNumber: number,
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  completedDays: CompletedDays,
): boolean => {
  if (lockedDays[dayNumber]) {
    return true
  }

  return areAllExercisesComplete(
    workoutData,
    selectedSplit,
    dayNumber,
    completedDays,
  )
}

/**
 * Check if a day is locked
 */
export const isDayLocked = (
  lockedDays: LockedDays,
  dayNumber: number,
): boolean => {
  return !!lockedDays[dayNumber]
}

/**
 * Check Monday reset condition
 */
export const shouldResetForMonday = (
  lastResetDate: string | null,
): string | null => {
  const today = new Date()
  const dayOfWeek = today.getDay()

  const thisMonday = new Date(today)
  const daysFromMonday = (dayOfWeek + 6) % 7
  thisMonday.setDate(today.getDate() - daysFromMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const thisMondayString = thisMonday.toISOString().split("T")[0]

  // Reset whenever we've crossed into a new week (i.e. the most recent Monday
  // is newer than the last reset), regardless of which day the app is opened.
  // Guarding on `dayOfWeek === 1` meant the reset only fired if the app was
  // opened *on* Monday — miss that day and everything stayed locked all week.
  if (!lastResetDate || lastResetDate < thisMondayString) {
    return thisMondayString
  }

  return null
}
