/**
 * Day Completion Utilities
 * Handles day completion checks and validations
 */

import type { WorkoutData } from "../types/index"

export type CompletedSets = Record<number, Record<number, SetDetails>>
export type CompletedDays = Record<number, CompletedSets>
export type LockedDays = Record<number, boolean>

export interface SetDetails {
  weight: number
  reps: number
  completedAt: string
  note: string
  isWarmup: boolean
  source?: string
}

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
  selectedPerson: string | null,
  dayNumber: number,
  completedDays: CompletedDays,
): boolean => {
  if (!workoutData?.days || !selectedPerson) return false

  const day = workoutData.days.find((d) => d.dayNumber === dayNumber)
  if (!day || !day.people[selectedPerson]) return false

  const exercises = day.people[selectedPerson].exercises || []
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
  selectedPerson: string | null,
  completedDays: CompletedDays,
): boolean => {
  if (lockedDays[dayNumber]) {
    return true
  }

  return areAllExercisesComplete(
    workoutData,
    selectedPerson,
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

  if (!lastResetDate || lastResetDate < thisMondayString) {
    if (dayOfWeek === 1) {
      return thisMondayString
    }
  }

  return null
}
