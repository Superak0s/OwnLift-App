export interface CompletedSetData {
  weight?: number
  reps?: number
  completedAt?: string
  isWarmup?: boolean
}

export type CompletedDays = Record<
  string | number,
  Record<number, Record<string | number, CompletedSetData>>
>

export interface ExerciseMeta {
  name: string
  exerciseName: string
  machineName: string | null
  muscleGroup: string | null
  days: Array<{ dayNumber: number; exerciseIndex: number }>
  totalSets: number
}

export interface ExerciseHistoryEntry {
  date: Date
  weight: number
  reps: number
  volume: number
  dayNumber: number
  setNumber: number
  source: "server" | "local" | "demo"
  isAssisted: boolean
}

export interface ExerciseStats {
  totalSets: number
  totalWorkouts: number
  extremeWeight: number
  extremeWeightLabel: string
  maxReps: number
  avgWeight: number
  avgReps: number
  totalVolume: number
  lastWorkout: Date | null
  isAssisted: boolean
}
