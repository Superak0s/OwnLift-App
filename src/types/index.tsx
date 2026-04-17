/**
 * Shared types for the workout application
 */

// ─── Core workout data ────────────────────────────────────────────────────────

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

// ─── Session completion tracking ──────────────────────────────────────────────

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

// ─── Session statistics ───────────────────────────────────────────────────────

export interface SessionStatistics {
  totalTime: number
  averageRest: number
  currentRest: number
  completedSets: number
  totalSets: number
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface ServerAnalytics {
  averageTimeBetweenSets?: number
}

// ─── Server session shapes ────────────────────────────────────────────────────

/** Lightweight session row returned by getSessionHistory */
export interface WorkoutSession {
  id: string | number
  day_number?: number
  start_time?: string
  created_at?: string
  end_time?: string
}

/** Full session detail returned by getSession */
export interface SetTiming {
  exercise_name?: string
  set_index: number
  end_time: string
  weight?: number
  reps?: number
  note?: string
  is_warmup?: boolean
}

export interface FullSession {
  id: string | number
  day_number: number
  end_time?: string
  set_timings?: SetTiming[]
}

/** Server-side workout day shape returned by programApi.fetchSavedProgram */
export interface ServerDay {
  dayNumber: number
  people: Record<string, PersonWorkout>
}

export interface SavedProgram {
  days: ServerDay[]
}

// ─── Pending sync — discriminated union ───────────────────────────────────────
//
// Each variant carries only the fields that its sync type actually needs.
// This eliminates all `unknown` casts in useSyncManager and useSessionOperations.

export interface StartSessionSyncData {
  person: string
  dayNumber: number
  dayTitle?: string
  muscleGroups?: string[]
  isDemo: boolean
}

export interface RecordSetSyncData {
  sessionId: string | number
  exerciseName?: string
  exerciseIndex?: number
  muscleGroup?: string
  setIndex: number
  startTime: string
  endTime: string
  weight: number
  reps: number
  note?: string
  isWarmup?: boolean
}

export interface EndSessionSyncData {
  sessionId: string | number
}

export type PendingSync =
  | {
      type: "startSession"
      localSessionId?: string
      data: StartSessionSyncData
      timestamp: string
    }
  | {
      type: "recordSet"
      localSessionId?: string
      data: RecordSetSyncData
      timestamp: string
    }
  | {
      type: "endSession"
      localSessionId?: string
      data: EndSessionSyncData
      timestamp: string
    }
