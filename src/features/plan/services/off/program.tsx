// features/plan/services/off/program.tsx
import type { SavedProgram, ExercisePayload } from "../../types"
import type { WorkoutDay, WorkoutData } from "@shared/types"
import { parseWorkoutFileClient } from "@utils/clientWorkoutParser"
import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  STORAGE_KEYS,
} from "@shared/services/storage"

const loadProgram = async (
  userId: string | null = null,
): Promise<SavedProgram | null> => {
  return loadFromStorage<SavedProgram>(STORAGE_KEYS.WORKOUT_DATA, userId)
}

const saveProgram = async (
  program: SavedProgram,
  userId: string | null = null,
): Promise<void> => {
  const ok = await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, program, userId)
  if (!ok) throw new Error("Failed to save program to storage")
}

/**
 * Offline Workout Program API — same method names/signatures as
 * services/on/program.tsx, backed by AsyncStorage (via utils/storage.ts)
 * instead of the server. `userId` is optional/trailing on every method so
 * existing call sites that don't pass it keep working unchanged.
 */
export const programApi = {
  uploadAndSave: async (
    fileUri: string,
    userId: string | null = null,
  ): Promise<unknown> => {
    try {
      const parsed: WorkoutData = await parseWorkoutFileClient(fileUri)
      const program: SavedProgram = {
        success: true,
        totalDays: parsed.days.length,
        people: parsed.people ?? [],
        days: parsed.days,
      }
      await saveProgram(program, userId)
      return { success: true, program }
    } catch (error) {
      console.warn(
        "programApi.uploadAndSave (offline) failed:",
        (error as Error).message,
      )
      throw error
    }
  },

  fetchSavedProgram: async (
    userId: string | null = null,
  ): Promise<SavedProgram | null> => {
    return loadProgram(userId)
  },

  deleteProgram: async (userId: string | null = null): Promise<unknown> => {
    try {
      console.log(STORAGE_KEYS)
      await removeFromStorage(STORAGE_KEYS.WORKOUT_DATA, null)
      return { success: true, message: "Program deleted successfully" }
    } catch (error) {
      console.error("Error deleting offline program:", error)
      throw error
    }
  },

  renameExercise: async (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
    userId: string | null = null,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram(userId)
      if (!program) return null

      const days = program.days as WorkoutDay[]
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const personData = day.people?.[person]
      const exercise = personData?.exercises?.[exerciseIndex]
      if (!exercise) return null

      exercise.name = newName
      if (newMuscleGroup !== undefined) exercise.muscleGroup = newMuscleGroup

      await saveProgram(program, userId)
      return { success: true, program }
    } catch (error) {
      console.warn(
        "programApi.renameExercise (offline) failed:",
        (error as Error).message,
      )
      return null
    }
  },

  addExercise: async (
    dayNumber: number,
    person: string,
    exercise: ExercisePayload,
    userId: string | null = null,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram(userId)
      if (!program) return null

      const days = program.days as WorkoutDay[]
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const personData = day.people?.[person]
      if (!personData) return null
      if (!personData.exercises) personData.exercises = []
      personData.exercises.push(exercise)

      await saveProgram(program, userId)
      return { success: true, program }
    } catch (error) {
      console.warn(
        "programApi.addExercise (offline) failed:",
        (error as Error).message,
      )
      return null
    }
  },

  patchExerciseSets: async (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    additionalSets: number,
    userId: string | null = null,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram(userId)
      if (!program) return null

      const days = program.days as WorkoutDay[]
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const personData = day.people?.[person]
      const exercise = personData?.exercises?.[exerciseIndex]
      if (!exercise) return null

      exercise.sets = exercise.sets + additionalSets

      await saveProgram(program, userId)
      return { success: true, program }
    } catch (error) {
      console.warn(
        "programApi.patchExerciseSets (offline) failed:",
        (error as Error).message,
      )
      return null
    }
  },
}
