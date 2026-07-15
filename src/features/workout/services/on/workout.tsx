// features/workout/services/on/workout.tsx
//
// Server-backed workout API. Talks to the Express/MySQL backend via
// authenticatedFetch.

import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import type {
  SetTiming,
  WorkoutSession,
  FullSessionWithGroups,
} from "@shared/types"

// ─── Types local to this service (not shared elsewhere) ────────────────────

export interface WorkoutAnalytics {
  averageTimeBetweenSets: number
  totalSessions: number
  totalSetsCompleted: number
  totalVolume: number
  averageRestTime: number
  averageSetDuration: number
}

export interface UpdateSetParams {
  exerciseName?: string
  muscleGroup?: string | null
  weight?: number
  reps?: number
  startTime?: string
  endTime?: string
  note?: string
  isWarmup?: boolean
}

export interface RenameExerciseResult {
  updatedCount: number
}

// ─── API ────────────────────────────────────────────────────────────────────

export const workoutApi = {
  uploadWorkoutFile: async (fileUri: string): Promise<unknown> => {
    const formData = new FormData()
    // Server route: POST /api/program/upload, multer field name "workoutFile".
    formData.append("workoutFile", {
      uri: fileUri,
      name: "workout-plan",
      type: "application/octet-stream",
    } as any)
    // Do NOT set Content-Type manually — fetch must add the multipart boundary.
    const res = await authenticatedFetch("/api/program/upload", {
      method: "POST",
      body: formData,
    })
    return res.json()
  },

  pickWorkoutFile: async (): Promise<string | null> => {
    const DocumentPicker = await import("expo-document-picker")
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
        "*/*",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled) return null
    if (result.assets && result.assets.length > 0) return result.assets[0].uri
    return (result as any).uri || null
  },

  getPersonWeeklyPlan: async (
    fileUri: string,
    personName: string,
  ): Promise<unknown> => {
    const res = await authenticatedFetch(
      `/api/workout/plan?person=${encodeURIComponent(personName)}`,
      { method: "GET" },
    )
    return res.json()
  },

  getDayWorkout: async (
    fileUri: string,
    dayNumber: number,
  ): Promise<unknown> => {
    const res = await authenticatedFetch(`/api/workout/day/${dayNumber}`, {
      method: "GET",
    })
    return res.json()
  },

  healthCheck: async (): Promise<unknown> => {
    const res = await authenticatedFetch("/api/health", { method: "GET" })
    return res.json()
  },

  startSession: async (
    person: string | null,
    dayNumber: number,
    dayTitle?: string,
    muscleGroups?: string[],
    isDemo: boolean = false,
    startTime: string | null = null,
  ): Promise<number | string> => {
    const res = await authenticatedFetch("/api/sessions/start", {
      method: "POST",
      body: JSON.stringify({
        person,
        dayNumber,
        dayTitle,
        muscleGroups,
        isDemo,
        startTime,
      }),
      headers: { "Content-Type": "application/json" },
    })
    // Server responds with { success, session: { ...session, id } }.
    const data = await res.json()
    return data.session?.id
  },

  recordSet: async (
    sessionId: number | string,
    exerciseName: string,
    setIndex: number,
    startTime: string,
    endTime: string,
    weight: number,
    reps: number,
    note: string = "",
    isWarmup: boolean = false,
    muscleGroup: string | null = null,
  ): Promise<SetTiming> => {
    const res = await authenticatedFetch(
      `/api/sessions/${sessionId}/set`,
      {
        method: "POST",
        body: JSON.stringify({
          exerciseName,
          setIndex,
          startTime,
          endTime,
          weight,
          reps,
          note,
          isWarmup,
          muscleGroup,
        }),
        headers: { "Content-Type": "application/json" },
      },
    )
    // Server responds with { success, timing }.
    const data = await res.json()
    return data.timing
  },

  updateSet: async (
    sessionId: number | string,
    setId: number | string,
    updates: UpdateSetParams,
  ): Promise<SetTiming> => {
    const res = await authenticatedFetch(
      `/api/sessions/${sessionId}/sets/${setId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      },
    )
    // Server responds with { success, timing }.
    const data = await res.json()
    return data.timing
  },

  renameExercise: async (
    person: string,
    oldName: string,
    updates: { newName?: string; muscleGroup?: string | null },
  ): Promise<RenameExerciseResult> => {
    const res = await authenticatedFetch("/api/sessions/rename-exercise", {
      method: "POST",
      body: JSON.stringify({ person, oldName, ...updates }),
      headers: { "Content-Type": "application/json" },
    })
    // Server responds with { success, updatedCount }.
    return res.json()
  },

  endSession: async (
    sessionId: number | string,
    endTime: string | null = null,
  ): Promise<WorkoutSession> => {
    const res = await authenticatedFetch(
      `/api/sessions/${sessionId}/end`,
      {
        method: "POST",
        body: JSON.stringify({ endTime }),
        headers: { "Content-Type": "application/json" },
      },
    )
    // Server responds with { success, session }.
    const data = await res.json()
    return data.session
  },

  getAnalytics: async (
    person: string | null = null,
    dayNumber: number | null = null,
  ): Promise<WorkoutAnalytics> => {
    const params = new URLSearchParams()
    if (person) params.set("person", person)
    if (dayNumber) params.set("dayNumber", String(dayNumber))
    const res = await authenticatedFetch(
      `/api/analytics?${params.toString()}`,
      { method: "GET" },
    )
    // Server responds with { success, ...analytics }.
    return res.json()
  },

  getSessionHistory: async (
    person: string | null = null,
    dayNumber: number | null = null,
    limit: number = 10,
    includeTimings: boolean = false,
  ): Promise<WorkoutSession[]> => {
    const params = new URLSearchParams()
    if (person) params.set("person", person)
    if (dayNumber) params.set("dayNumber", String(dayNumber))
    params.set("limit", String(limit))
    params.set("includeTimings", String(includeTimings))
    const res = await authenticatedFetch(
      `/api/sessions?${params.toString()}`,
      { method: "GET" },
    )
    // Server responds with { success, sessions, total }; callers expect the array.
    const data = await res.json()
    return data.sessions ?? []
  },

  getSession: async (
    sessionId: number | string,
  ): Promise<FullSessionWithGroups> => {
    const res = await authenticatedFetch(`/api/sessions/${sessionId}`, {
      method: "GET",
    })
    // Server responds with { success, session }; callers expect the session.
    const data = await res.json()
    return data.session
  },

  clearDemoSessions: async (): Promise<unknown> => {
    const res = await authenticatedFetch("/api/sessions/demo", {
      method: "DELETE",
    })
    return res.json()
  },

  deleteAllSessions: async (): Promise<unknown> => {
    // Server requires an explicit confirmation token in the body.
    const res = await authenticatedFetch("/api/sessions", {
      method: "DELETE",
      body: JSON.stringify({ confirmDelete: "DELETE_ALL_SESSIONS" }),
      headers: { "Content-Type": "application/json" },
    })
    return res.json()
  },

  deleteAllSessionsForPerson: async (person: string): Promise<unknown> => {
    const res = await authenticatedFetch(
      `/api/sessions/person/${encodeURIComponent(person)}`,
      { method: "DELETE" },
    )
    return res.json()
  },

  deleteAllUserData: async (): Promise<unknown> => {
    // Wipes every piece of the user's data server-side (workouts, tracking,
    // social) while keeping the account. Requires an explicit confirmation
    // token in the body.
    const res = await authenticatedFetch("/api/auth/account/data", {
      method: "DELETE",
      body: JSON.stringify({ confirmDelete: "DELETE_ALL_DATA" }),
      headers: { "Content-Type": "application/json" },
    })
    return res.json()
  },
}
