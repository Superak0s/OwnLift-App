import type { SavedProgram, ExercisePayload } from "../../types"
import type { WorkoutDay, WorkoutData } from "@shared/types"
import { parseWorkoutFileClient } from "@utils/clientWorkoutParser"
import { migrateLegacyProgram } from "@utils/legacyProgram"
import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  STORAGE_KEYS,
} from "@shared/services/storage"

const loadProgram = async (): Promise<SavedProgram | null> => {
  const program = await loadFromStorage<SavedProgram>(
    STORAGE_KEYS.WORKOUT_DATA,
    null,
  )
  return program ? migrateLegacyProgram(program) : program
}

const saveProgram = async (program: SavedProgram): Promise<void> => {
  const ok = await saveToStorage(STORAGE_KEYS.WORKOUT_DATA, program, null)
  if (!ok) throw new Error("Failed to save program to storage")
}

export const programApi = {
  uploadAndSave: async (fileUri: string): Promise<unknown> => {
    try {
      const parsed: WorkoutData = await parseWorkoutFileClient(fileUri)
      const program: SavedProgram = {
        success: true,
        totalDays: parsed.days.length,
        split: parsed.split ?? [],
        days: parsed.days,
      }
      await saveProgram(program)
      return { success: true, program }
    } catch (error) {
      console.warn(
        "programApi.uploadAndSave (offline) failed:",
        (error as Error).message,
      )
      throw error
    }
  },

  saveProgram: async (program: WorkoutData): Promise<unknown> => {
    try {
      const toSave: SavedProgram = {
        success: true,
        totalDays: program.days.length,
        split: program.split ?? [],
        days: program.days,
      }
      await saveProgram(toSave)
      return { success: true, program: toSave }
    } catch (error) {
      console.warn(
        "programApi.saveProgram (offline) failed:",
        (error as Error).message,
      )
      throw error
    }
  },

  fetchSavedProgram: async (): Promise<SavedProgram | null> => {
    return loadProgram()
  },

  deleteProgram: async (): Promise<unknown> => {
    try {
      await removeFromStorage(STORAGE_KEYS.WORKOUT_DATA, null)
      return { success: true, message: "Program deleted successfully" }
    } catch (error) {
      console.error("Error deleting offline program:", error)
      throw error
    }
  },

  renameExercise: async (
    dayNumber: number,
    split: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram()
      if (!program) return null

      const days = program.days
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const splitData = day.split?.[split]
      const exercise = splitData?.exercises?.[exerciseIndex]
      if (!exercise) return null

      exercise.name = newName
      if (newMuscleGroup !== undefined) exercise.muscleGroup = newMuscleGroup

      await saveProgram(program)
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
    split: string,
    exercise: ExercisePayload,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram()
      if (!program) return null

      const days = program.days
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const splitData = day.split?.[split]
      if (!splitData) return null
      if (!splitData.exercises) splitData.exercises = []
      splitData.exercises.push(exercise)

      await saveProgram(program)
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
    split: string,
    exerciseIndex: number,
    additionalSets: number,
  ): Promise<unknown> => {
    try {
      const program = await loadProgram()
      if (!program) return null

      const days = program.days
      const day = days.find((d) => d.dayNumber === dayNumber)
      if (!day) return null

      const splitData = day.split?.[split]
      const exercise = splitData?.exercises?.[exerciseIndex]
      if (!exercise) return null

      exercise.sets = exercise.sets + additionalSets

      await saveProgram(program)
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
