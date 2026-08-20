import { useCallback } from "react"
import { programApi } from "@features/plan/services/index"
import type { WorkoutData } from "../../types"


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
    split: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ) => Promise<void>
  addExtraSetsToExercise: (
    dayNumber: number,
    split: string,
    exerciseIndex: number,
    additionalSets: number,
  ) => Promise<void>
  addNewExercise: (
    dayNumber: number,
    split: string,
    exerciseData: {
        name: string
        exerciseId?: string
        muscleGroup?: string
        sets: number
      },
  ) => Promise<void>
}

/** Deep-clone WorkoutData so nested mutations never touch the original state. */
function cloneWorkoutData(data: WorkoutData): WorkoutData {
  return structuredClone(data)
}

export const useProgramOperations = ({
  workoutData,
  setWorkoutData,
  userId,
  saveToStorage,
  STORAGE_KEYS,
}: UseProgramOperationsOptions): UseProgramOperationsReturn => {
  const updateExerciseName = useCallback(
    async (
      dayNumber: number,
      split: string,
      exerciseIndex: number,
      newName: string,
      newMuscleGroup?: string,
    ): Promise<void> => {
      try {
        if (!workoutData?.days) return

        const updatedData = cloneWorkoutData(workoutData)
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )
        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.split[split]?.exercises?.[exerciseIndex]) return

        day.split[split].exercises[exerciseIndex].name = newName
        if (newMuscleGroup !== undefined) {
          day.split[split].exercises[exerciseIndex].muscleGroup =
            newMuscleGroup
        }

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.renameExercise(
            dayNumber,
            split,
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

  const addExtraSetsToExercise = useCallback(
    async (
      dayNumber: number,
      split: string,
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
        if (!day.split[split]?.exercises?.[exerciseIndex]) return

        day.split[split].exercises[exerciseIndex].sets += additionalSets
        day.split[split].totalSets += additionalSets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.patchExerciseSets(
            dayNumber,
            split,
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

  const addNewExercise = useCallback(
    async (
      dayNumber: number,
      split: string,
      exerciseData: {
        name: string
        exerciseId?: string
        muscleGroup?: string
        sets: number
      },
    ): Promise<void> => {
      try {
        if (!workoutData?.days) return

        const updatedData = cloneWorkoutData(workoutData)
        const dayIndex = updatedData.days.findIndex(
          (d) => d.dayNumber === dayNumber,
        )
        if (dayIndex === -1) return

        const day = updatedData.days[dayIndex]
        if (!day.split[split]) {
          day.split[split] = { exercises: [], totalSets: 0 }
        }

        const newExercise = {
          name: exerciseData.name,
          exerciseId: exerciseData.exerciseId,
          muscleGroup: exerciseData.muscleGroup || "",
          sets: exerciseData.sets,
        }

        day.split[split].exercises.push(newExercise)
        day.split[split].totalSets += exerciseData.sets

        await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, updatedData, userId)
        setWorkoutData(updatedData)

        try {
          await programApi.addExercise(dayNumber, split, newExercise)
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
