/**
 * Session Management Utilities
 * Handles workout session operations
 */

/**
 * Constants
 */
export const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check if session is inactive
 */
export const isSessionInactive = (lastActivityTime) => {
  if (!lastActivityTime) return false
  const elapsed = Date.now() - new Date(lastActivityTime).getTime()
  return elapsed > INACTIVITY_THRESHOLD_MS
}

/**
 * Generate local session ID
 */
export const generateLocalSessionId = () => {
  return `local_${Date.now()}`
}

/**
 * Check if session ID is local
 */
export const isLocalSessionId = (sessionId) => {
  return sessionId?.startsWith("local_")
}

/**
 * Calculate total session time in seconds
 */
export const calculateSessionTime = (workoutStartTime) => {
  if (!workoutStartTime) return 0

  const now = Date.now()
  const start = new Date(workoutStartTime).getTime()
  return Math.floor((now - start) / 1000)
}

/**
 * Calculate rest time since last set in seconds
 */
export const calculateRestTime = (lastSetEndTime) => {
  if (!lastSetEndTime) return 0

  const now = Date.now()
  const lastEnd = new Date(lastSetEndTime).getTime()
  return Math.floor((now - lastEnd) / 1000)
}

/**
 * Calculate session average rest time
 */
export const calculateSessionAverageRest = (
  completedDays,
  dayNumber,
  workoutStartTime,
  fallbackTime = 120,
) => {
  if (!workoutStartTime || !completedDays[dayNumber]) return fallbackTime

  const dayData = completedDays[dayNumber]
  const setTimes = []

  // Collect all set completion times for this session
  Object.keys(dayData).forEach((exerciseIndex) => {
    const exerciseSets = dayData[exerciseIndex]
    Object.keys(exerciseSets).forEach((setIndex) => {
      const setData = exerciseSets[setIndex]
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

  // Sort by time
  setTimes.sort((a, b) => a.time - b.time)

  // Calculate rest times between consecutive sets
  const allRestTimes = []
  for (let i = 1; i < setTimes.length; i++) {
    const restTime = Math.floor(
      (setTimes[i].time - setTimes[i - 1].time) / 1000,
    )
    // Only include reasonable rest times (between 10 seconds and 20 minutes)
    if (restTime >= 10 && restTime <= 1200) {
      allRestTimes.push(restTime)
    }
  }

  if (allRestTimes.length === 0) return fallbackTime

  // Calculate average
  const sum = allRestTimes.reduce((acc, time) => acc + time, 0)
  return Math.round(sum / allRestTimes.length)
}

/**
 * Count completed sets for a day
 */
export const countCompletedSets = (completedDays, dayNumber) => {
  if (!completedDays[dayNumber]) return 0

  let count = 0
  const dayData = completedDays[dayNumber]

  Object.keys(dayData).forEach((exerciseIndex) => {
    const exerciseSets = dayData[exerciseIndex]
    if (exerciseSets) {
      count += Object.keys(exerciseSets).length
    }
  })

  return count
}

/**
 * Get comprehensive session statistics
 */
export const getSessionStatistics = (
  workoutStartTime,
  lastSetEndTime,
  completedDays,
  dayNumber,
  workoutData,
  selectedPerson,
  timeBetweenSets,
) => {
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
  const totalSets = day?.people?.[selectedPerson]?.totalSets || 0

  return {
    totalTime,
    averageRest,
    currentRest,
    completedSets: completedSetsCount,
    totalSets,
  }
}
