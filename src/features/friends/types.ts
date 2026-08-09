import type { SetTiming, GroupedExercise } from "@shared/types"

// Re-export GroupedExercise so it can be imported from "./types"
export type { GroupedExercise } from "@shared/types"

export interface Friend {
  id: number | string
  username: string
  createdAt: string
}
/**
 * Program types for the friends feature.
 *
 * These mirror shared types (`Exercise`, `WorkoutDay`, `WorkoutData`) but
 * have subtly different shapes:
 *   - `ProgramExercise` is flatter (name, muscleGroup, sets) vs `Exercise`
 *     (name, muscleGroup, sets) — same shape, kept separate because
 *     `ProgramExercise` also allows `setsByPerson` and `muscle_group` aliases.
 *   - `ProgramDay` allows `people` and `split` with `ProgramExercise[]`
 *     vs `WorkoutDay` which uses `ExerciseWithSets[]` and `PersonWorkout`.
 *   - `ProgramData` has `name`, `split`, `people` arrays vs `WorkoutData`
 *     which only has `days` + optional `totalDays`, `split`.
 *
 * These are the shapes returned by the permission system when a friend
 * shares their program — they differ from the local program types.
 */
export interface ProgramExercise {
  name?: string
  muscleGroup?: string
  muscle_group?: string
  sets?: number
  setsByPerson?: Record<string, number | string>
}

export interface ProgramDay {
  dayNumber?: number
  dayTitle?: string
  exercises?: ProgramExercise[]
  split?: Record<string, { exercises?: ProgramExercise[] }>
  people?: Record<string, { exercises?: ProgramExercise[] }>
}

export interface ProgramData {
  name?: string
  totalDays?: number
  split?: string[]
  people?: string[]
  days?: ProgramDay[]
}

export interface ReceivedProgram {
  id: number | string
  senderId: number | string
  senderUsername: string
  sharedAt: string
  message: string | null
  programData: ProgramData
}

export interface LiveData {
  start_time?: string
  day_number?: number
  day_title?: string
  set_timings?: SetTiming[]
  muscle_groups?: unknown[]
}

export type Phase =
  | "idle"
  | "checking"
  | "watching"
  | "no_session"
  | "ended"
  | "error"

export interface ExerciseEntry {
  exerciseName: string
  muscleGroup: string | null
  totalSets: number
  completedSetMap: Record<number, SetTiming>
}

export interface FriendSessionStatus {
  id: number | string
  active: boolean
}

/**
 * SessionRecord extends the shared WorkoutSession with extra fields
 * needed for the friends screen (live session details, grouped exercises).
 *
 * Shared WorkoutSession fields:
 *   id, day_number, start_time, end_time, set_count, total_duration,
 *   completed_sets, day_title, muscle_groups, created_at
 *
 * Friends-specific additions:
 *   set_timings (full SetTiming[] for detailed view),
 *   groupedExercises (enriched by client),
 *   start_time accepts number (epoch from server)
 *
 * Kept as a separate type because it carries extra fields not in the
 * shared WorkoutSession shape.
 */
export interface SessionRecord {
  id: number | string
  day_number?: number
  day_title?: string
  start_time?: string | number
  total_duration?: number
  completed_sets?: number
  muscle_groups?: unknown[]
  set_timings?: SetTiming[]
  groupedExercises?: GroupedExercise[]
}

export interface UserSearchResult {
  id: number | string
  username: string
  email?: string
}

export interface PendingFriendRequest {
  id: number | string
  senderId: number | string
  senderUsername: string
  senderName?: string
  createdAt: string
}

export interface SentFriendRequest {
  id: number | string
  receiverId: number | string
  receiverUsername: string
  receiverName?: string
  createdAt: string
}

export interface ContactFriendSuggestion {
  id: number | string
  username: string
  name?: string
}

export type PermissionType =
  | "history"
  | "analytics"
  | "program"
  | "joint_session"
  | "watch_session"

export interface GrantedPermission {
  id: number | string
  toUserId: number | string
  toUsername: string
  permissionType: PermissionType
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface ReceivedPermission {
  id: number | string
  fromUserId: number | string
  fromUsername: string
  permissionType: PermissionType
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface JointInviteParams {
  toUserId: number | string
  fromSessionId: string
}
