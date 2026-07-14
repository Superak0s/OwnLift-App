// features/plan/types.ts

export interface SavedProgram {
  success: boolean
  totalDays: number
  people: string[]
  days: unknown[]
  originalFilename?: string
  uploadedAt?: string
}

export interface ExercisePayload {
  name: string
  muscleGroup?: string
  sets: number
}
