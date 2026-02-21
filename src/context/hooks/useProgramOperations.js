import { useCallback } from "react"

/**
 * Program Operations Hook
 * Handles workout program modifications (rename exercises, add sets, etc.)
 */

export const useProgramOperations = ({
  workoutData,
  setWorkoutData,
  userId,
  saveToStorage,
  STORAGE_KEYS,
}) => {
  /**
   * Update exercise name
   */
  const updateExerciseName = useCallback(
    async (
      dayNumber,
      person,
      exerciseIndex,
      newName,
      newMuscleGroup = undefined,
    ) => {
      try {
        if (!workoutData?.days) return

        const updatedData = { ...workoutData }
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )

        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.people[person]?.exercises?.[exerciseIndex]) return

        // Update local state immediately
        day.people[person].exercises[exerciseIndex].name = newName
        if (newMuscleGroup !== undefined) {
          day.people[person].exercises[exerciseIndex].muscleGroup = newMuscleGroup
        }

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        // Push to server
        try {
          const { programApi } = require("../../services/api")
          await programApi.renameExercise(
            dayNumber,
            person,
            exerciseIndex,
            newName,
            newMuscleGroup,
          )
        } catch (err) {
          console.warn("Could not sync exercise rename to server:", err.message)
        }
      } catch (error) {
        console.error("Error updating exercise name:", error)
      }
    },
    [workoutData, setWorkoutData, userId, saveToStorage, STORAGE_KEYS],
  )

  /**
   * Add extra sets to exercise
   */
  const addExtraSetsToExercise = useCallback(
    async (dayNumber, person, exerciseIndex, additionalSets) => {
      try {
        if (!workoutData?.days) return

        const updatedData = { ...workoutData }
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )

        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.people[person]?.exercises?.[exerciseIndex]) return

        // Update local state immediately
        day.people[person].exercises[exerciseIndex].sets += additionalSets
        day.people[person].totalSets += additionalSets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        // Push to server
        try {
          const { programApi } = require("../../services/api")
          await programApi.patchExerciseSets(
            dayNumber,
            person,
            exerciseIndex,
            additionalSets,
          )
        } catch (err) {
          console.warn("Could not sync set count change to server:", err.message)
        }
      } catch (error) {
        console.error("Error adding extra sets:", error)
      }
    },
    [workoutData, setWorkoutData, userId, saveToStorage, STORAGE_KEYS],
  )

  /**
   * Add new exercise
   */
  const addNewExercise = useCallback(
    async (dayNumber, person, exerciseData) => {
      try {
        if (!workoutData?.days) return

        const updatedData = { ...workoutData }
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )

        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.people[person]) {
          day.people[person] = { exercises: [], totalSets: 0 }
        }

        const newExercise = {
          name: exerciseData.name,
          muscleGroup: exerciseData.muscleGroup || "",
          sets: exerciseData.sets,
        }

        // Update local state immediately
        day.people[person].exercises.push(newExercise)
        day.people[person].totalSets += exerciseData.sets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        // Push to server
        try {
          const { programApi } = require("../../services/api")
          await programApi.addExercise(dayNumber, person, newExercise)
        } catch (err) {
          console.warn("Could not sync new exercise to server:", err.message)
        }
      } catch (error) {
        console.error("Error adding new exercise:", error)
      }
    },
    [workoutData, setWorkoutData, userId, saveToStorage, STORAGE_KEYS],
  )

  return {
    updateExerciseName,
    addExtraSetsToExercise,
    addNewExercise,
  }
}
