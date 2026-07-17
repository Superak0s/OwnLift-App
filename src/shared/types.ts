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
export interface ExerciseWithSets {
  name: string
  muscleGroup: string
  setsByPerson: Record<string, number>
}
export interface WorkoutDay {
  dayNumber: number
  dayTitle?: string
  exercises?: ExerciseWithSets[]
  muscleGroups?: string[]
  split: Record<string, PersonWorkout>
}

export interface WorkoutData {
  days: WorkoutDay[]
  /** Total number of days — may be present on the object returned by uploadAndSave */
  totalDays?: number
  /** Splits listed in the program — may be present on the object returned by uploadAndSave */
  split?: string[]
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
  /** May be present on summary rows */
  set_count?: number // already there — check your import, might be using a stale type
  total_duration?: number
  completed_sets?: number
  day_title?: string
  muscle_groups?: string[]
}

/** Full session detail returned by getSession */
/** Full session detail returned by getSession */
/** Full session detail returned by getSession */
export interface SetTiming {
  id?: string | number
  exercise_name?: string
  set_index: number
  start_time?: string
  end_time: string
  weight?: number
  reps?: number
  note?: string
  is_warmup?: boolean
  /** Duration in seconds for the set */
  set_duration?: number
  exercise_id?: string | number
  exercise_index?: number
  exercise_muscle_group?: string
}

export interface FullSession {
  id: string | number
  day_number: number
  end_time?: string
  set_timings?: SetTiming[]
}

/** Enriched session detail with grouped exercises — built client-side */
export interface GroupedExercise {
  exerciseName: string
  sets: SetTiming[]
}

export interface FullSessionWithGroups extends FullSession {
  groupedExercises?: GroupedExercise[]
  start_time?: string
  total_duration?: number
  completed_sets?: number
  day_title?: string
  muscle_groups?: string[]
}

/** Server-side workout day shape returned by programApi.fetchSavedProgram */
export interface ServerDay {
  dayNumber: number
  split: Record<string, PersonWorkout>
}

/**
 * Program as persisted/returned by programApi.fetchSavedProgram (both the
 * server and the offline store build this exact shape). `days` holds full
 * WorkoutDay objects.
 */
export interface SavedProgram {
  success: boolean
  totalDays: number
  split: string[]
  days: WorkoutDay[]
  originalFilename?: string
  uploadedAt?: string
}

// ─── Reminder location ────────────────────────────────────────────────────────

export interface ReminderLocation {
  lat: number
  lng: number
  address: string
  radius: number
}

// ─── Body tracking ────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string | number
  weight_kg: string | number
  recorded_at: string
  unit?: string
}

export interface WeightHistoryResponse {
  entries: WeightEntry[]
}

export interface HeightData {
  height_cm: number
  unit?: string
}

export interface MacrosEntry {
  id: string | number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  calories?: number | null
  logged_at?: string
  name?: string
  meal_error_margin?: number | null
}

// NOTE: MacrosGoals is defined in features/tracking/types.ts (the only
// consumer). It is intentionally NOT duplicated here.

export interface MacrosStat {
  value: number | null
  goal: number | null
  percent: number | null
}

export interface DailyMacrosStats {
  protein: MacrosStat
  carbs: MacrosStat
  fat: MacrosStat
  calories: MacrosStat
}

export interface BodyFatEntry {
  id: string | number
  body_fat_percentage?: number
  date?: string
  waist_cm?: number
  neck_cm?: number
  hip_cm?: number
  measurement_unit?: string
  gender?: string
}

export interface ProgressPhoto {
  id: string | number
  takenAt?: string
  taken_at?: string
  uri?: string
}

// ─── Pending sync — discriminated union ───────────────────────────────────────

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

// app/types.ts
export type RootStackParamList = {
  Home: undefined
  Login: undefined
  Signup: undefined
  Workout: undefined
  Tracking: undefined
  Friends: undefined
  Settings: undefined
  Analytics: undefined
  Supplements: undefined
  Plan: undefined
  // + any params any of these actually take, e.g. Tracking: { sessionId: string }
}
