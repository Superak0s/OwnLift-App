/**
 * Shared types for the workout application
 */

export interface Exercise {
  name: string
  muscleGroup?: string
  sets: number
}

export interface PersonWorkout {
  exercises: Exercise[]
  totalSets: number
}

export interface WorkoutDay {
  dayNumber: number
  dayTitle?: string
  muscleGroups?: string[]
  people: Record<string, PersonWorkout>
}

export interface WorkoutData {
  days: WorkoutDay[]
}

export interface ServerAnalytics {
  averageTimeBetweenSets?: number
}

export interface PendingSync {
  type: "startSession" | "recordSet" | "endSession"
  localSessionId?: string
  data: Record<string, unknown>
  timestamp: string
}

export interface SessionStatistics {
  totalTime: number
  averageRest: number
  currentRest: number
  completedSets: number
  totalSets: number
}

export interface SetDetail {
  weight: number
  reps: number
  completedAt: string
  note: string
  isWarmup: boolean
  source?: string
}

export type CompletedSets = Record<number, SetDetail>
export type CompletedExercises = Record<number, CompletedSets>
export type CompletedDays = Record<number, CompletedExercises>
export type LockedDays = Record<number, boolean>
