// features/workout/services/on/workout.tsx
//
// Server-backed workout API. Talks to the Express/MySQL backend via
// authenticatedFetch. This is a RECONSTRUCTION based on the off-mode
// mirror's function signatures — replace endpoint paths/response shapes
// with your actual server routes before using.

import { authenticatedFetch } from "@shared/services/authenticatedFetch"
// ─── Types ──────────────────────────────────────────────────────────────────

export interface SetTiming {
  id: number | string
  exercise_name: string
  exercise_muscle_group?: string
  set_index: number
  start_time: string
  end_time: string
  weight?: number
  reps?: number
  note?: string
  is_warmup: boolean
}

export interface WorkoutSession {
  id: number | string
  person: string
  day_number: number
  day_title?: string
  start_time: string
  end_time: string | null
  set_timings?: SetTiming[]
  set_count?: number
}

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
    formData.append("file", {
      uri: fileUri,
      name: "workout-plan",
      type: "application/octet-stream",
    } as any)
    const res = await authenticatedFetch("/api/workout/upload", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "multipart/form-data" },
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
    const res = await authenticatedFetch("/api/workout/sessions", {
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
    const data = await res.json()
    return data.id
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
      `/api/workout/sessions/${sessionId}/sets`,
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
    return res.json()
  },

  updateSet: async (
    sessionId: number | string,
    setId: number | string,
    updates: UpdateSetParams,
  ): Promise<SetTiming> => {
    const res = await authenticatedFetch(
      `/api/workout/sessions/${sessionId}/sets/${setId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      },
    )
    return res.json()
  },

  renameExercise: async (
    person: string,
    oldName: string,
    updates: { newName?: string; muscleGroup?: string | null },
  ): Promise<RenameExerciseResult> => {
    const res = await authenticatedFetch("/api/workout/rename-exercise", {
      method: "POST",
      body: JSON.stringify({ person, oldName, ...updates }),
      headers: { "Content-Type": "application/json" },
    })
    return res.json()
  },

  endSession: async (
    sessionId: number | string,
    endTime: string | null = null,
  ): Promise<WorkoutSession> => {
    const res = await authenticatedFetch(
      `/api/workout/sessions/${sessionId}/end`,
      {
        method: "POST",
        body: JSON.stringify({ endTime }),
        headers: { "Content-Type": "application/json" },
      },
    )
    return res.json()
  },

  getAnalytics: async (
    person: string | null = null,
    dayNumber: number | null = null,
  ): Promise<WorkoutAnalytics> => {
    const params = new URLSearchParams()
    if (person) params.set("person", person)
    if (dayNumber) params.set("dayNumber", String(dayNumber))
    const res = await authenticatedFetch(
      `/api/workout/analytics?${params.toString()}`,
      { method: "GET" },
    )
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
      `/api/workout/sessions?${params.toString()}`,
      { method: "GET" },
    )
    return res.json()
  },

  getSession: async (sessionId: number | string): Promise<WorkoutSession> => {
    const res = await authenticatedFetch(`/api/workout/sessions/${sessionId}`, {
      method: "GET",
    })
    return res.json()
  },

  clearDemoSessions: async (): Promise<unknown> => {
    const res = await authenticatedFetch("/api/workout/sessions/demo", {
      method: "DELETE",
    })
    return res.json()
  },

  deleteAllSessions: async (): Promise<unknown> => {
    const res = await authenticatedFetch("/api/workout/sessions", {
      method: "DELETE",
    })
    return res.json()
  },

  deleteAllSessionsForPerson: async (person: string): Promise<unknown> => {
    const res = await authenticatedFetch(
      `/api/workout/sessions/person/${encodeURIComponent(person)}`,
      { method: "DELETE" },
    )
    return res.json()
  },
}
