export interface User {
  id: string
  username: string
  email?: string
  name?: string
  [key: string]: unknown
}


export interface Exercise {
  name: string
  /** Canonical free-exercise-db id. Absent means a custom exercise. */
  exerciseId?: string
  muscleGroup?: string
  sets: number
}

export interface SplitWorkout {
  exercises: Exercise[]
  totalSets: number
}
export interface ExerciseWithSets {
  name: string
  exerciseId?: string
  muscleGroup: string
  setsBySplit: Record<string, number>
}
export interface WorkoutDay {
  dayNumber: number
  dayTitle?: string
  exercises?: ExerciseWithSets[]
  muscleGroups?: string[]
  split: Record<string, SplitWorkout>
}

export interface WorkoutData {
  days: WorkoutDay[]
  /** Total number of days — may be present on the object returned by uploadAndSave */
  totalDays?: number
  /** Splits listed in the program — may be present on the object returned by uploadAndSave */
  split?: string[]
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


export interface SessionStatistics {
  totalTime: number
  averageRest: number
  currentRest: number
  completedSets: number
  totalSets: number
}


/** Lightweight session row returned by getSessionHistory */
export interface WorkoutSession {
  id: string | number
  day_number?: number
  start_time?: string
  created_at?: string
  end_time?: string
  /** May be present on summary rows */
  set_count?: number
  total_duration?: number
  completed_sets?: number
  day_title?: string
  muscle_groups?: string[]
}

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
  muscleGroup?: string
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

export interface SavedProgram {
  success: boolean
  totalDays: number
  split: string[]
  days: WorkoutDay[]
  originalFilename?: string
  uploadedAt?: string
}


export interface ReminderLocation {
  lat: number
  lng: number
  address: string
  radius: number
}


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

export interface MacrosStat {
  value: number | null
  goal: number | null
  percent: number | null
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


export interface StartSessionSyncData {
  split: string
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

export type RootStackParamList = {
  Home: undefined
  Login: undefined
  Signup: undefined
  PrivacyPolicy: undefined
  Workout: undefined
  Tracking: undefined
  Friends: undefined
  Settings: undefined
  Analytics: undefined
  Supplements: undefined
  Plan: undefined
}

export type WidgetSize = "small" | "medium" | "large"

export interface WidgetDefinition<T extends string = string> {
  type: T
  title?: string
  description: string
  icon?: string
  availableSizes: WidgetSize[]
  defaultSize: WidgetSize
  /** Only meaningful in server mode (e.g. friend-based widgets later) */
  requiresServer?: boolean
  /** If true, only one instance of this widget can be added */
  singleton?: boolean
}

export interface WidgetInstance<T extends string = string> {
  /** stable unique id for this placed instance, not the widget type */
  id: string
  type: T
  size: WidgetSize
  order: number
}

export const RECOVERY_MUSCLE_GROUPS = [
  "chest_upper",
  "chest_lower",
  "back_upper",
  "back_lower",
  "lats",
  "traps",
  "neck",
  "shoulders_front",
  "shoulders_side",
  "shoulders_rear",
  "biceps",
  "triceps",
  "forearms",
  "abs_upper",
  "abs_lower",
  "obliques",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "adductors",
  "abductors",
  "hip_flexors",
] as const

export type RecoveryMuscleGroup = (typeof RECOVERY_MUSCLE_GROUPS)[number]

/** Human-readable labels for recovery muscle groups. */
export const MUSCLE_GROUP_LABELS: Record<RecoveryMuscleGroup, string> = {
  chest_upper: "Upper Chest",
  chest_lower: "Lower Chest",
  back_upper: "Upper Back",
  back_lower: "Lower Back",
  lats: "Lats",
  traps: "Traps",
  neck: "Neck",
  shoulders_front: "Front Delts",
  shoulders_side: "Side Delts",
  shoulders_rear: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs_upper: "Upper Abs",
  abs_lower: "Lower Abs",
  obliques: "Obliques",
  lower_back: "Lower Back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  adductors: "Adductors",
  abductors: "Abductors",
  hip_flexors: "Hip Flexors",
} as const

