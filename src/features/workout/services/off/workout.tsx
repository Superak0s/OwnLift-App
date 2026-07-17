import * as DocumentPicker from "expo-document-picker"
import {
  nextId,
  nowIso,
  offlineUnsupported,
  readJSON,
  writeJSON,
} from "@shared/services/offlineHelpers"
import type {
  SetTiming,
  WorkoutSession,
  FullSessionWithGroups,
} from "@shared/types"
import type {
  RenameExerciseResult,
  UpdateSetParams,
  WorkoutAnalytics,
} from "../on/workout"

import { programApi } from "@features/plan/services/index"

// ─── Storage shape ──────────────────────────────────────────────────────────

interface StoredSession extends Omit<WorkoutSession, "end_time"> {
  person: string
  end_time: string | null
  set_timings: SetTiming[]
  is_demo: boolean
}

const SESSIONS_KEY = "@offline:workout:sessions"
const SESSION_ID_COUNTER = "@offline:workout:session_id_counter"
const SET_ID_COUNTER = "@offline:workout:set_id_counter"

const DEFAULT_PERSON = "local"

async function getAllSessions(): Promise<StoredSession[]> {
  return readJSON<StoredSession[]>(SESSIONS_KEY, [])
}

async function saveAllSessions(sessions: StoredSession[]): Promise<void> {
  await writeJSON(SESSIONS_KEY, sessions)
}

/** Used by endSession/getSessionHistory — matches on/workout's WorkoutSession return type. */
function toPublicSession(
  s: StoredSession,
  includeTimings: boolean,
): WorkoutSession & { set_timings?: SetTiming[] } {
  const { is_demo: _isDemo, set_timings, end_time, ...rest } = s
  const publicEndTime = end_time ?? undefined
  if (includeTimings) return { ...rest, end_time: publicEndTime, set_timings }
  return { ...rest, end_time: publicEndTime, set_count: set_timings.length }
}

/** Used by getSession — matches on/workout's FullSessionWithGroups return type. */
function toFullSession(s: StoredSession): FullSessionWithGroups {
  return {
    id: s.id,
    day_number: s.day_number ?? 0,
    end_time: s.end_time ?? undefined,
    set_timings: s.set_timings,
    start_time: s.start_time,
    day_title: s.day_title,
    // total_duration / completed_sets / muscle_groups / groupedExercises
    // aren't tracked offline; left undefined, same as the server response
    // before the client builds groupedExercises itself.
  }
}

// ─── API ────────────────────────────────────────────────────────────────────

export const workoutApi = {
  // ── Spreadsheet import — server-only, no offline equivalent ──────────────

  uploadWorkoutFile: async (_fileUri: string): Promise<unknown> => {
    offlineUnsupported("Importing a workout file")
  },

  pickWorkoutFile: async (): Promise<string | null> => {
    try {
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
    } catch (error) {
      console.error("Error picking file:", error)
      throw error
    }
  },

  getPersonWeeklyPlan: async (
    _fileUri: string,
    _personName: string,
  ): Promise<unknown> => {
    offlineUnsupported("Reading a person's weekly plan from a file")
  },

  getDayWorkout: async (
    _fileUri: string,
    _dayNumber: number,
  ): Promise<unknown> => {
    offlineUnsupported("Reading a day's workout from a file")
  },

  healthCheck: async (): Promise<unknown> => {
    return { status: "ok", offline: true }
  },

  // ── Session management ────────────────────────────────────────────────────

  startSession: async (
    person: string | null,
    dayNumber: number,
    dayTitle?: string,
    _muscleGroups?: string[],
    isDemo: boolean = false,
    startTime: string | null = null,
  ): Promise<number | string> => {
    const sessions = await getAllSessions()
    const id = await nextId(SESSION_ID_COUNTER)
    const session: StoredSession = {
      id,
      person: person ?? DEFAULT_PERSON,
      day_number: dayNumber,
      day_title: dayTitle,
      start_time: startTime ?? nowIso(),
      end_time: null,
      set_timings: [],
      is_demo: isDemo,
    }
    sessions.push(session)
    await saveAllSessions(sessions)
    return id
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
    const sessions = await getAllSessions()
    const session = sessions.find((s) => String(s.id) === String(sessionId))
    if (!session) throw new Error("Failed to record set: session not found")

    const timing: SetTiming = {
      id: await nextId(SET_ID_COUNTER),
      exercise_name: exerciseName,
      exercise_muscle_group: muscleGroup ?? undefined,
      set_index: setIndex,
      start_time: startTime,
      end_time: endTime,
      weight,
      reps,
      note,
      is_warmup: isWarmup,
    }
    session.set_timings.push(timing)
    await saveAllSessions(sessions)
    return timing
  },

  updateSet: async (
    sessionId: number | string,
    setId: number | string,
    updates: UpdateSetParams,
  ): Promise<SetTiming> => {
    const sessions = await getAllSessions()
    const session = sessions.find((s) => String(s.id) === String(sessionId))
    if (!session) throw new Error("Failed to update set: session not found")

    const timing = session.set_timings.find(
      (t) => String(t.id) === String(setId),
    )
    if (!timing) throw new Error("Failed to update set: set not found")

    if (updates.exerciseName !== undefined)
      timing.exercise_name = updates.exerciseName
    if (updates.muscleGroup !== undefined)
      timing.exercise_muscle_group = updates.muscleGroup ?? undefined
    if (updates.weight !== undefined) timing.weight = updates.weight
    if (updates.reps !== undefined) timing.reps = updates.reps
    if (updates.startTime !== undefined) timing.start_time = updates.startTime
    if (updates.endTime !== undefined) timing.end_time = updates.endTime
    if (updates.note !== undefined) timing.note = updates.note
    if (updates.isWarmup !== undefined) timing.is_warmup = updates.isWarmup

    await saveAllSessions(sessions)
    return timing
  },

  renameExercise: async (
    person: string,
    oldName: string,
    updates: { newName?: string; muscleGroup?: string | null },
  ): Promise<RenameExerciseResult> => {
    const sessions = await getAllSessions()
    let updatedCount = 0

    for (const session of sessions) {
      if (session.person !== person) continue
      for (const timing of session.set_timings) {
        if (timing.exercise_name !== oldName) continue
        if (updates.newName !== undefined)
          timing.exercise_name = updates.newName
        if (updates.muscleGroup !== undefined)
          timing.exercise_muscle_group = updates.muscleGroup ?? undefined
        updatedCount += 1
      }
    }

    await saveAllSessions(sessions)
    return { updatedCount }
  },

  endSession: async (
    sessionId: number | string,
    endTime: string | null = null,
  ): Promise<WorkoutSession> => {
    const sessions = await getAllSessions()
    const session = sessions.find((s) => String(s.id) === String(sessionId))
    if (!session) throw new Error("Failed to end session: session not found")

    session.end_time = endTime ?? nowIso()
    await saveAllSessions(sessions)
    return toPublicSession(session, true)
  },

  getAnalytics: async (
    person: string | null = null,
    dayNumber: number | null = null,
  ): Promise<WorkoutAnalytics> => {
    const sessions = await getAllSessions()
    const filtered = sessions.filter(
      (s) =>
        (!person || s.person === person) &&
        (!dayNumber || s.day_number === dayNumber),
    )

    const allSets = filtered.flatMap((s) => s.set_timings)
    const workingSets = allSets.filter((t) => !t.is_warmup)

    const totalVolume = workingSets.reduce(
      (sum, t) => sum + (t.weight ?? 0) * (t.reps ?? 0),
      0,
    )

    const setDurations: number[] = []
    const restGaps: number[] = []
    const sortedSets = [...workingSets].sort(
      (a, b) =>
        new Date(a.start_time ?? 0).getTime() -
        new Date(b.start_time ?? 0).getTime(),
    )
    for (let i = 0; i < sortedSets.length; i++) {
      const t = sortedSets[i]
      const duration =
        (new Date(t.end_time).getTime() -
          new Date(t.start_time ?? 0).getTime()) /
        1000
      if (Number.isFinite(duration) && duration >= 0)
        setDurations.push(duration)

      if (i > 0) {
        const gap =
          (new Date(t.start_time ?? 0).getTime() -
            new Date(sortedSets[i - 1].end_time).getTime()) /
          1000
        if (Number.isFinite(gap) && gap >= 0) restGaps.push(gap)
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    return {
      averageTimeBetweenSets: restGaps.length ? avg(restGaps) : 120,
      totalSessions: filtered.length,
      totalSetsCompleted: workingSets.length,
      totalVolume,
      averageRestTime: avg(restGaps),
      averageSetDuration: avg(setDurations),
    }
  },

  getSessionHistory: async (
    person: string | null = null,
    dayNumber: number | null = null,
    limit: number = 10,
    includeTimings: boolean = false,
  ): Promise<WorkoutSession[]> => {
    const sessions = await getAllSessions()
    const filtered = sessions
      .filter(
        (s) =>
          (!person || s.person === person) &&
          (!dayNumber || s.day_number === dayNumber),
      )
      .sort(
        (a, b) =>
          new Date(b.start_time ?? 0).getTime() -
          new Date(a.start_time ?? 0).getTime(),
      )
      .slice(0, limit)

    return filtered.map((s) => toPublicSession(s, includeTimings))
  },

  getSession: async (
    sessionId: number | string,
  ): Promise<FullSessionWithGroups> => {
    const sessions = await getAllSessions()
    const session = sessions.find((s) => String(s.id) === String(sessionId))
    if (!session) throw new Error("Failed to get session: session not found")
    return toFullSession(session)
  },

  clearDemoSessions: async (): Promise<unknown> => {
    const sessions = await getAllSessions()
    const remaining = sessions.filter((s) => !s.is_demo)
    const deletedCount = sessions.length - remaining.length
    await saveAllSessions(remaining)
    return { success: true, deletedCount }
  },

  deleteAllSessions: async (): Promise<unknown> => {
    await saveAllSessions([])
    return { success: true }
  },

  deleteAllSessionsForPerson: async (person: string): Promise<unknown> => {
    const sessions = await getAllSessions()
    const remaining = sessions.filter((s) => s.person !== person)
    const deletedCount = sessions.length - remaining.length
    await programApi.deleteProgram()
    await saveAllSessions(remaining)
    return { success: true, deletedCount }
  },

  deleteAllUserData: async (): Promise<unknown> => {
    // Serverless equivalent of the server-side wipe: drop all locally stored
    // sessions and the imported program.
    await saveAllSessions([])
    await programApi.deleteProgram()
    return { success: true }
  },
}
