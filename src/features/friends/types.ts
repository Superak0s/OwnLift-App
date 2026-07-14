import type { SetTiming } from "@shared/types"

export interface Friend {
  id: number | string
  username: string
}

// ─── Program sharing ──────────────────────────────────────────────────────
// NOTE: merged from two previously-conflicting definitions
// (FriendsScreen.tsx used dayTitle + ProgramExercise.setsByPerson: Record<string, number>,
//  LiveSessionTab.tsx used `people` + Exercise.setsByPerson: Record<string, number | string>).
// Verify this against the actual sharingApi payload before treating it as final.

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
  people?: Record<string, { exercises?: ProgramExercise[] }>
}

export interface ProgramData {
  name?: string
  totalDays?: number
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

// SEE FLAG #3 BELOW — added to mirror ReceivedProgram for the sender-side
// list (getSentPrograms), rather than reusing a separate generic
// "SharedProgram" shape. Confirm field names (receiverId/receiverUsername)
// against the real API response.
export interface SentProgram {
  id: number | string
  receiverId: number | string
  receiverUsername: string
  sharedAt: string
  message: string | null
  programData: ProgramData
}

// ─── Live sessions ────────────────────────────────────────────────────────

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

// ─── Session history ──────────────────────────────────────────────────────

export interface GroupedExercise {
  exerciseName: string
  sets: SetTiming[]
}

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

// ─── Search ───────────────────────────────────────────────────────────────

export interface UserSearchResult {
  id: number | string
  username: string
  email?: string
}

// ─── Friend requests ──────────────────────────────────────────────────────
// Added for friends.tsx — not previously in this file.

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

// ─── Sharing permissions ──────────────────────────────────────────────────
// Added for sharing.tsx — not previously in this file.

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
