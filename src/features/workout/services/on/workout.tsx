import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import { ApiError, parseApiResponse } from "@shared/services/apiClient"
import type {
  SetTiming,
  WorkoutSession,
  FullSessionWithGroups,
} from "@shared/types"


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

// parseApiResponse throws an ApiError whenever the call didn't succeed,
// so failures are never silently swallowed.


export const workoutApi = {
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

  startSession: async (
    split: string | null,
    dayNumber: number,
    dayTitle?: string,
    muscleGroups?: string[],
    isDemo: boolean = false,
    startTime: string | null = null,
  ): Promise<number | string> => {
    const res = await authenticatedFetch("/api/sessions/start", {
      method: "POST",
      body: JSON.stringify({
        split,
        dayNumber,
        dayTitle,
        muscleGroups,
        isDemo,
        startTime,
      }),
      headers: { "Content-Type": "application/json" },
    })
    // Server responds with { success, session: { ...session, id } }.
    const data = await parseApiResponse<{ session?: { id?: number | string } }>(
      res,
    )
    if (!data.session?.id) {
      throw new ApiError(
        "startSession succeeded but response had no session.id",
        res.status,
      )
    }
    return data.session.id
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
    const res = await authenticatedFetch(`/api/sessions/${sessionId}/set`, {
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
    })
    // Server responds with { success, timing }.
    const data = await parseApiResponse<{ timing?: SetTiming }>(res)
    if (!data.timing) {
      throw new ApiError(
        "recordSet succeeded but response had no timing",
        res.status,
      )
    }
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
    const data = await parseApiResponse<{ timing?: SetTiming }>(res)
    if (!data.timing) {
      throw new ApiError(
        "updateSet succeeded but response had no timing",
        res.status,
      )
    }
    return data.timing
  },

  renameExercise: async (
    split: string,
    oldName: string,
    updates: { newName?: string; muscleGroup?: string | null },
  ): Promise<RenameExerciseResult> => {
    const res = await authenticatedFetch("/api/sessions/rename-exercise", {
      method: "POST",
      body: JSON.stringify({ split, oldName, ...updates }),
      headers: { "Content-Type": "application/json" },
    })
    // Server responds with { success, updatedCount }.
    return parseApiResponse(res)
  },

  endSession: async (
    sessionId: number | string,
    endTime: string | null = null,
  ): Promise<WorkoutSession> => {
    const res = await authenticatedFetch(`/api/sessions/${sessionId}/end`, {
      method: "POST",
      body: JSON.stringify({ endTime }),
      headers: { "Content-Type": "application/json" },
    })
    // Server responds with { success, session }.
    const data = await parseApiResponse<{ session?: WorkoutSession }>(res)
    if (!data.session) {
      throw new ApiError(
        "endSession succeeded but response had no session",
        res.status,
      )
    }
    return data.session
  },

  getAnalytics: async (
    split: string | null = null,
    dayNumber: number | null = null,
  ): Promise<WorkoutAnalytics> => {
    const params = new URLSearchParams()
    if (split) params.set("split", split)
    if (dayNumber) params.set("dayNumber", String(dayNumber))
    const res = await authenticatedFetch(
      `/api/analytics?${params.toString()}`,
      { method: "GET" },
    )
    // Server responds with { success, ...analytics }.
    return parseApiResponse(res)
  },

  getSessionHistory: async (
    split: string | null = null,
    dayNumber: number | null = null,
    limit: number = 10,
    includeTimings: boolean = false,
  ): Promise<WorkoutSession[]> => {
    const params = new URLSearchParams()
    if (split) params.set("split", split)
    if (dayNumber) params.set("dayNumber", String(dayNumber))
    params.set("limit", String(limit))
    params.set("includeTimings", String(includeTimings))
    const res = await authenticatedFetch(`/api/sessions?${params.toString()}`, {
      method: "GET",
    })
    // Server responds with { success, sessions, total }; callers expect the array.
    const data = await parseApiResponse<{ sessions?: WorkoutSession[] }>(res)
    return data.sessions ?? []
  },

  getSession: async (
    sessionId: number | string,
  ): Promise<FullSessionWithGroups> => {
    const res = await authenticatedFetch(`/api/sessions/${sessionId}`, {
      method: "GET",
    })
    // Server responds with { success, session }; callers expect the session.
    const data = await parseApiResponse<{ session?: FullSessionWithGroups }>(
      res,
    )
    if (!data.session) {
      throw new ApiError(
        "getSession succeeded but response had no session",
        res.status,
      )
    }
    return data.session
  },

  clearDemoSessions: async (): Promise<unknown> => {
    const res = await authenticatedFetch("/api/sessions/admin", {
      method: "DELETE",
    })
    return parseApiResponse(res)
  },

  deleteAllSessionsForSplit: async (split: string): Promise<unknown> => {
    const res = await authenticatedFetch(
      `/api/sessions/split/${encodeURIComponent(split)}`,
      { method: "DELETE" },
    )
    return parseApiResponse(res)
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
    return parseApiResponse(res)
  },
}