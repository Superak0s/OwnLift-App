/**
 * Day Completion Utilities
 * Handles day completion checks and validations
 */

/**
 * Check if a specific set is complete
 */
export const isSetComplete = (completedDays, dayNumber, exerciseIndex, setIndex) => {
  return !!completedDays[dayNumber]?.[exerciseIndex]?.[setIndex]
}

/**
 * Get details of a specific set
 */
export const getSetDetails = (completedDays, dayNumber, exerciseIndex, setIndex) => {
  return completedDays[dayNumber]?.[exerciseIndex]?.[setIndex] || null
}

/**
 * Get count of completed sets for an exercise
 */
export const getExerciseCompletedSets = (completedDays, dayNumber, exerciseIndex) => {
  return Object.keys(completedDays[dayNumber]?.[exerciseIndex] || {}).length
}

/**
 * Check if all exercises in a day are complete
 */
export const areAllExercisesComplete = (
  workoutData,
  selectedPerson,
  dayNumber,
  completedDays,
) => {
  if (!workoutData?.days || !selectedPerson) return false

  const day = workoutData.days.find((d) => d.dayNumber === dayNumber)
  if (!day || !day.people[selectedPerson]) return false

  const exercises = day.people[selectedPerson].exercises || []
  if (exercises.length === 0) return false

  // Check if all sets of all exercises are completed
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
  lockedDays,
  dayNumber,
  workoutData,
  selectedPerson,
  completedDays,
) => {
  // Primary indicator: day is locked
  if (lockedDays[dayNumber]) {
    return true
  }

  // Secondary check: all sets completed
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
export const isDayLocked = (lockedDays, dayNumber) => {
  return !!lockedDays[dayNumber]
}

/**
 * Check Monday reset condition
 */
export const shouldResetForMonday = (lastResetDate) => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Get the Monday of this week (at midnight)
  const thisMonday = new Date(today)
  const daysFromMonday = (dayOfWeek + 6) % 7 // Days since last Monday
  thisMonday.setDate(today.getDate() - daysFromMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const thisMondayString = thisMonday.toISOString().split("T")[0]

  // Only reset if:
  // 1. We haven't reset since this Monday AND
  // 2. It's currently Monday (to avoid resetting mid-week)
  if (!lastResetDate || lastResetDate < thisMondayString) {
    if (dayOfWeek === 1) {
      // Only reset on Mondays
      return thisMondayString
    }
  }

  return null
}
