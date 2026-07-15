import { useCallback } from "react"
import { programApi } from "@features/plan/services/index"
import type { WorkoutData } from "../../types"

/**
 * Program Operations Hook
 * Handles workout program modifications (rename exercises, add sets, etc.)
 *
 * Fixes applied:
 * - Removed require() inside callbacks — programApi is imported at the top
 * - Fixed shallow-spread + deep-mutation bug: workoutData is now deep-cloned
 *   via JSON.parse/JSON.stringify before any nested mutation so the original
 *   state objects are never touched
 */

export interface UseProgramOperationsOptions {
  workoutData: WorkoutData | null
  setWorkoutData: (data: WorkoutData) => void
  userId: string | null
  saveToStorage: (
    key: string,
    value: unknown,
    userId: string | null,
  ) => Promise<boolean>
  STORAGE_KEYS: { WORKOUT_DATA: string }
}

export interface UseProgramOperationsReturn {
  updateExerciseName: (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ) => Promise<void>
  addExtraSetsToExercise: (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    additionalSets: number,
  ) => Promise<void>
  addNewExercise: (
    dayNumber: number,
    person: string,
    exerciseData: { name: string; muscleGroup?: string; sets: number },
  ) => Promise<void>
}

/** Deep-clone WorkoutData so nested mutations never touch the original state. */
function cloneWorkoutData(data: WorkoutData): WorkoutData {
  return JSON.parse(JSON.stringify(data)) as WorkoutData
}

export const useProgramOperations = ({
  workoutData,
  setWorkoutData,
  userId,
  saveToStorage,
  STORAGE_KEYS,
}: UseProgramOperationsOptions): UseProgramOperationsReturn => {
  /**
   * Update exercise name
   */
  const updateExerciseName = useCallback(
    async (
      dayNumber: number,
      person: string,
      exerciseIndex: number,
      newName: string,
      newMuscleGroup?: string,
    ): Promise<void> => {
      try {
        if (!workoutData?.days) return

        // Deep clone so we never mutate the existing state tree
        const updatedData = cloneWorkoutData(workoutData)
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )
        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.people[person]?.exercises?.[exerciseIndex]) return

        day.people[person].exercises[exerciseIndex].name = newName
        if (newMuscleGroup !== undefined) {
          day.people[person].exercises[exerciseIndex].muscleGroup =
            newMuscleGroup
        }

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.renameExercise(
            dayNumber,
            person,
            exerciseIndex,
            newName,
            newMuscleGroup,
          )
        } catch (err) {
          console.warn(
            "Could not sync exercise rename to server:",
            (err as Error).message,
          )
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
    async (
      dayNumber: number,
      person: string,
      exerciseIndex: number,
      additionalSets: number,
    ): Promise<void> => {
      try {
        if (!workoutData?.days) return

        const updatedData = cloneWorkoutData(workoutData)
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )
        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.people[person]?.exercises?.[exerciseIndex]) return

        day.people[person].exercises[exerciseIndex].sets += additionalSets
        day.people[person].totalSets += additionalSets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.patchExerciseSets(
            dayNumber,
            person,
            exerciseIndex,
            additionalSets,
          )
        } catch (err) {
          console.warn(
            "Could not sync set count change to server:",
            (err as Error).message,
          )
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
    async (
      dayNumber: number,
      person: string,
      exerciseData: { name: string; muscleGroup?: string; sets: number },
    ): Promise<void> => {
      try {
        if (!workoutData?.days) return

        const updatedData = cloneWorkoutData(workoutData)
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

        day.people[person].exercises.push(newExercise)
        day.people[person].totalSets += exerciseData.sets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.addExercise(dayNumber, person, newExercise)
        } catch (err) {
          console.warn(
            "Could not sync new exercise to server:",
            (err as Error).message,
          )
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
