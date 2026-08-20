import * as DocumentPicker from "expo-document-picker";
import {
  nextId,
  nowIso,
  createRecordStore,
} from "@shared/services/offlineHelpers";
import type {
  SetTiming,
  WorkoutSession,
  FullSessionWithGroups,
} from "@shared/types";
import type {
  RenameExerciseResult,
  UpdateSetParams,
  WorkoutAnalytics,
} from "../on/workout";

import { programApi } from "@features/plan/services/index";
import { computeWorkoutAnalytics } from "./workoutAnalytics";

export { computeWorkoutAnalytics };


interface StoredSession extends Omit<WorkoutSession, "end_time"> {
  split: string;
  end_time: string | null;
  set_timings: SetTiming[];
  is_demo: boolean;
}

const SESSIONS_KEY = "@offline:workout:sessions";
const SESSION_ID_COUNTER = "@offline:workout:session_id_counter";
const SET_ID_COUNTER = "@offline:workout:set_id_counter";

const DEFAULT_SPLIT = "local";

const sessionsStore = createRecordStore<StoredSession>(
  "workout_sessions",
  SESSIONS_KEY,
  (s) => s.id,
  (s) => s.start_time ?? "",
);

/** Used by endSession/getSessionHistory — matches on/workout's WorkoutSession return type. */
function toPublicSession(
  s: StoredSession,
  includeTimings: boolean,
): WorkoutSession & { set_timings?: SetTiming[] } {
  const { is_demo: _isDemo, set_timings, end_time, ...rest } = s;
  const publicEndTime = end_time ?? undefined;
  if (includeTimings) return { ...rest, end_time: publicEndTime, set_timings };
  return { ...rest, end_time: publicEndTime, set_count: set_timings.length };
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
  };
}


export const workoutApi = {
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
      });

      if (result.canceled) return null;
      if (result.assets && result.assets.length > 0)
        return result.assets[0].uri;
      return (result as any).uri || null;
    } catch (error) {
      console.error("Error picking file:", error);
      throw error;
    }
  },


  startSession: async (
    split: string | null,
    dayNumber: number,
    dayTitle?: string,
    _muscleGroups?: string[],
    isDemo: boolean = false,
    startTime: string | null = null,
  ): Promise<number | string> => {
    const id = await nextId(SESSION_ID_COUNTER);
    const session: StoredSession = {
      id,
      split: split ?? DEFAULT_SPLIT,
      day_number: dayNumber,
      day_title: dayTitle,
      start_time: startTime ?? nowIso(),
      end_time: null,
      set_timings: [],
      is_demo: isDemo,
    };
    await sessionsStore.put(session);
    return id;
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
    const session = await sessionsStore.getOne(sessionId);
    if (!session) throw new Error("Failed to record set: session not found");

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
    };
    session.set_timings.push(timing);
    await sessionsStore.put(session);
    return timing;
  },

  updateSet: async (
    sessionId: number | string,
    setId: number | string,
    updates: UpdateSetParams,
  ): Promise<SetTiming> => {
    const session = await sessionsStore.getOne(sessionId);
    if (!session) throw new Error("Failed to update set: session not found");

    const timing = session.set_timings.find(
      (t) => String(t.id) === String(setId),
    );
    if (!timing) throw new Error("Failed to update set: set not found");

    if (updates.exerciseName !== undefined)
      timing.exercise_name = updates.exerciseName;
    if (updates.muscleGroup !== undefined)
      timing.exercise_muscle_group = updates.muscleGroup ?? undefined;
    if (updates.weight !== undefined) timing.weight = updates.weight;
    if (updates.reps !== undefined) timing.reps = updates.reps;
    if (updates.startTime !== undefined) timing.start_time = updates.startTime;
    if (updates.endTime !== undefined) timing.end_time = updates.endTime;
    if (updates.note !== undefined) timing.note = updates.note;
    if (updates.isWarmup !== undefined) timing.is_warmup = updates.isWarmup;

    await sessionsStore.put(session);
    return timing;
  },

  renameExercise: async (
    split: string,
    oldName: string,
    updates: { newName?: string; muscleGroup?: string | null },
  ): Promise<RenameExerciseResult> => {
    const sessions = await sessionsStore.getAll();
    let updatedCount = 0;
    const changedSessions: StoredSession[] = [];

    for (const session of sessions) {
      if (session.split !== split) continue;
      let changed = false;
      for (const timing of session.set_timings) {
        if (timing.exercise_name !== oldName) continue;
        if (updates.newName !== undefined)
          timing.exercise_name = updates.newName;
        if (updates.muscleGroup !== undefined)
          timing.exercise_muscle_group = updates.muscleGroup ?? undefined;
        updatedCount += 1;
        changed = true;
      }
      if (changed) changedSessions.push(session);
    }

    await sessionsStore.putMany(changedSessions);
    return { updatedCount };
  },

  endSession: async (
    sessionId: number | string,
    endTime: string | null = null,
  ): Promise<WorkoutSession> => {
    const session = await sessionsStore.getOne(sessionId);
    if (!session) throw new Error("Failed to end session: session not found");

    session.end_time = endTime ?? nowIso();
    await sessionsStore.put(session);
    return toPublicSession(session, true);
  },

  getAnalytics: async (
    split: string | null = null,
    dayNumber: number | null = null,
  ): Promise<WorkoutAnalytics> => {
    const sessions = await sessionsStore.getAll();
    const filtered = sessions.filter(
      (s) =>
        (!split || s.split === split) &&
        (!dayNumber || s.day_number === dayNumber),
    );

    return computeWorkoutAnalytics(filtered);
  },

  getSessionHistory: async (
    split: string | null = null,
    dayNumber: number | null = null,
    limit: number = 10,
    includeTimings: boolean = false,
  ): Promise<WorkoutSession[]> => {
    const sessions =
      split == null && dayNumber == null
        ? await sessionsStore.getRecent(limit)
        : await sessionsStore.getAll();
    const filtered = sessions
      .filter(
        (s) =>
          (!split || s.split === split) &&
          (!dayNumber || s.day_number === dayNumber),
      )
      .sort(
        (a, b) =>
          new Date(b.start_time ?? 0).getTime() -
          new Date(a.start_time ?? 0).getTime(),
      )
      .slice(0, limit);

    return filtered.map((s) => toPublicSession(s, includeTimings));
  },

  getSession: async (
    sessionId: number | string,
  ): Promise<FullSessionWithGroups> => {
    const session = await sessionsStore.getOne(sessionId);
    if (!session) throw new Error("Failed to get session: session not found");
    return toFullSession(session);
  },

  clearDemoSessions: async (): Promise<unknown> => {
    const sessions = await sessionsStore.getAll();
    const demoIds = sessions.filter((s) => s.is_demo).map((s) => s.id);
    await sessionsStore.removeMany(demoIds);
    return { success: true, deletedCount: demoIds.length };
  },

  deleteAllSessionsForSplit: async (split: string): Promise<unknown> => {
    const sessions = await sessionsStore.getAll();
    const toDelete = sessions.filter((s) => s.split === split).map((s) => s.id);
    await programApi.deleteProgram();
    await sessionsStore.removeMany(toDelete);
    return { success: true, deletedCount: toDelete.length };
  },

  deleteAllUserData: async (): Promise<unknown> => {
    // Serverless equivalent of the server-side wipe: drop all locally stored
    // sessions and the imported program.
    await sessionsStore.clear();
    await programApi.deleteProgram();
    return { success: true };
  },
};
