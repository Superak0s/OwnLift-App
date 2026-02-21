/**
 * Time Estimation Utilities
 * Handles workout time estimation and calculations
 */

/**
 * Count remaining sets for a day
 */
export const countRemainingSets = (
  workoutData,
  selectedPerson,
  dayNumber,
  completedDays,
) => {
  if (!workoutData?.days || !selectedPerson) return 0

  const day = workoutData.days.find((d) => d.dayNumber === dayNumber)
  if (!day || !day.people[selectedPerson]) return 0

  const exercises = day.people[selectedPerson].exercises || []

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
  completedDays,
  dayNumber,
  exerciseIndex,
) => {
  return Object.keys(completedDays[dayNumber]?.[exerciseIndex] || {}).length
}

/**
 * Get estimated time remaining in seconds
 */
export const getEstimatedTimeRemaining = (
  workoutData,
  selectedPerson,
  dayNumber,
  completedDays,
  timeBetweenSets,
  workoutStartTime,
  sessionAverageRest,
  useManualTime,
  serverAnalytics,
) => {
  if (!workoutData?.days || !selectedPerson) return 0

  const remainingSets = countRemainingSets(
    workoutData,
    selectedPerson,
    dayNumber,
    completedDays,
  )

  // Determine which time to use
  let avgTimeBetweenSets = timeBetweenSets

  // Priority 1: Session average if workout is active
  if (workoutStartTime && sessionAverageRest > 0) {
    avgTimeBetweenSets = sessionAverageRest
  }
  // Priority 2: Server analytics if not using manual time
  else if (!useManualTime && serverAnalytics?.averageTimeBetweenSets > 0) {
    avgTimeBetweenSets = serverAnalytics.averageTimeBetweenSets
  }

  // Calculate estimated seconds
  return remainingSets * avgTimeBetweenSets
}

/**
 * Get estimated end time as Date object
 */
export const getEstimatedEndTime = (estimatedSecondsRemaining) => {
  const now = new Date()
  return new Date(now.getTime() + estimatedSecondsRemaining * 1000)
}

/**
 * Format seconds to human readable string
 */
export const formatTime = (seconds) => {
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

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}
