import type { WorkoutData, SetTiming } from "@shared/types";
import type { CompletedDays } from "../types";

export type SummaryPeriod = "today" | "week" | "month" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TrainingSetEntry {
  date: Date;
  exerciseName: string;
  muscleGroup: string | null;
  weight: number;
  reps: number;
  dayNumber: number;
}

export interface SummaryMuscleGroupRow {
  muscleGroup: string;
  sets: number;
  volume: number;
}

export interface SummaryExerciseRow {
  exerciseName: string;
  muscleGroup: string | null;
  sets: number;
  volume: number;
}

export interface TrainingSummary {
  muscleGroups: SummaryMuscleGroupRow[];
  exercises: SummaryExerciseRow[];
}

const UNKNOWN_MUSCLE_GROUP = "Unknown";

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const startOfMonth = (date: Date): Date => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

export function getPeriodDateRange(
  period: SummaryPeriod,
  customRange: DateRange | null,
  now: Date = new Date(),
): DateRange {
  if (period === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (period === "week") return { start: startOfWeek(now), end: endOfDay(now) };
  if (period === "month") return { start: startOfMonth(now), end: endOfDay(now) };

  if (!customRange) return { start: startOfDay(now), end: endOfDay(now) };
  const [start, end] =
    customRange.start.getTime() <= customRange.end.getTime()
      ? [customRange.start, customRange.end]
      : [customRange.end, customRange.start];
  return { start: startOfDay(start), end: endOfDay(end) };
}

interface SessionLike {
  day_number?: number | null;
  start_time?: string | null;
  set_timings?: SetTiming[] | null;
}

interface RawSetEntry extends TrainingSetEntry {
  dayNumber: number;
  setNumber: number;
  source: "server" | "local";
}

function resolveExerciseName(
  timing: SetTiming,
  session: SessionLike,
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null | undefined,
): string {
  if (timing.exercise_name?.trim()) return timing.exercise_name.trim();

  if (workoutData?.days && selectedSplit && timing.exercise_index != null) {
    const day = workoutData.days.find((d) => d.dayNumber === session.day_number);
    const exercise = day?.split?.[selectedSplit]?.exercises?.[timing.exercise_index];
    if (exercise) {
      const ex = exercise as { machineName?: string; name: string };
      return ex.machineName ?? ex.name;
    }
  }

  return timing.exercise_index == null
    ? "Unknown Exercise"
    : `Exercise ${timing.exercise_index + 1}`;
}

/** Builds the deduped set-entry list that feeds aggregateTrainingSummary, from
 * the same two sources (live sessions + locally-completed days) ExerciseAnalytics
 * uses for its own exercise history. */
export function buildTrainingSetEntries(
  sessions: SessionLike[],
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null | undefined,
  completedDays: CompletedDays,
): TrainingSetEntry[] {
  const fromSessions: RawSetEntry[] = sessions.flatMap((session) =>
    (session.set_timings ?? []).map((timing) => ({
      date: new Date(timing.end_time ?? session.start_time ?? Date.now()),
      exerciseName: resolveExerciseName(timing, session, workoutData, selectedSplit),
      muscleGroup: timing.exercise_muscle_group ?? null,
      weight: Number.isFinite(timing.weight) ? (timing.weight as number) : 0,
      reps: Number.isFinite(timing.reps) ? (timing.reps as number) : 0,
      dayNumber: session.day_number ?? 0,
      setNumber: (timing.set_index ?? 0) + 1,
      source: "server" as const,
    })),
  );

  const fromCompletedDays: RawSetEntry[] =
    !workoutData?.days || !selectedSplit
      ? []
      : Object.keys(completedDays).flatMap((dayNumberKey) => {
          const dayNumber = Number.parseInt(dayNumberKey);
          const day = workoutData.days.find((d) => d.dayNumber === dayNumber);
          const splitWorkout = day?.split?.[selectedSplit];
          if (!splitWorkout?.exercises) return [];

          return splitWorkout.exercises.flatMap((exercise, exerciseIndex) => {
            const ex = exercise as {
              machineName?: string;
              name: string;
              muscleGroup?: string;
            };
            const exerciseName = ex.machineName ?? ex.name;
            const exerciseSets = completedDays[dayNumber]?.[exerciseIndex];
            if (!exerciseSets) return [];
            return Object.keys(exerciseSets)
              .filter((setIndex) => exerciseSets[Number(setIndex)])
              .map((setIndex) => {
                const setData = exerciseSets[Number(setIndex)] ?? {};
                return {
                  date: new Date(setData.completedAt ?? Date.now()),
                  exerciseName,
                  muscleGroup: ex.muscleGroup ?? null,
                  weight: Number.isFinite(setData.weight) ? (setData.weight as number) : 0,
                  reps: Number.isFinite(setData.reps) ? (setData.reps as number) : 0,
                  dayNumber,
                  setNumber: Number.parseInt(setIndex) + 1,
                  source: "local" as const,
                };
              });
          });
        });

  // Same identity/priority rule used for exercise history: a set can appear
  // in both sessions (server) and completedDays (local) during the sync
  // window — server entries win.
  const sorted = [...fromSessions, ...fromCompletedDays].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const seen = new Map<string, RawSetEntry>();
  sorted.forEach((entry) => {
    const key = `${entry.date.getTime()}-${entry.dayNumber}-${entry.exerciseName}-${entry.setNumber}`;
    const existing = seen.get(key);
    if (!existing || (entry.source === "server" && existing.source === "local")) {
      seen.set(key, entry);
    }
  });

  return Array.from(seen.values()).map(
    ({ date, exerciseName, muscleGroup, weight, reps, dayNumber }) => ({
      date,
      exerciseName,
      muscleGroup,
      weight,
      reps,
      dayNumber,
    }),
  );
}

export function aggregateTrainingSummary(
  entries: TrainingSetEntry[],
  range: DateRange,
): TrainingSummary {
  const muscleGroupMap = new Map<string, SummaryMuscleGroupRow>();
  const exerciseMap = new Map<string, SummaryExerciseRow>();

  entries.forEach((entry) => {
    if (entry.date.getTime() < range.start.getTime() || entry.date.getTime() > range.end.getTime()) {
      return;
    }
    const volume = entry.weight * entry.reps;
    const muscleGroup = entry.muscleGroup ?? UNKNOWN_MUSCLE_GROUP;

    const muscleRow = muscleGroupMap.get(muscleGroup) ?? { muscleGroup, sets: 0, volume: 0 };
    muscleRow.sets += 1;
    muscleRow.volume += volume;
    muscleGroupMap.set(muscleGroup, muscleRow);

    const exerciseRow = exerciseMap.get(entry.exerciseName) ?? {
      exerciseName: entry.exerciseName,
      muscleGroup: entry.muscleGroup,
      sets: 0,
      volume: 0,
    };
    exerciseRow.sets += 1;
    exerciseRow.volume += volume;
    exerciseMap.set(entry.exerciseName, exerciseRow);
  });

  return {
    muscleGroups: Array.from(muscleGroupMap.values()).sort((a, b) => b.sets - a.sets),
    exercises: Array.from(exerciseMap.values()).sort((a, b) => b.sets - a.sets),
  };
}

export type UndertrainedCalculationMode = "days_done" | "full_split";

export interface UndertrainedGroup {
  muscleGroup: string;
  actualSets: number;
  targetSets: number;
  completionPct: number;
  deltaFromAvg: number;
}

export const UNDERTRAINED_DELTA_THRESHOLD = 25;

function sumPlannedSetsByMuscleGroup(
  days: WorkoutData["days"],
  selectedSplit: string,
): Map<string, number> {
  const targets = new Map<string, number>();
  days.forEach((day) => {
    const exercises = day.split?.[selectedSplit]?.exercises ?? [];
    exercises.forEach((exercise) => {
      if (!exercise.muscleGroup?.trim()) return;
      const group = exercise.muscleGroup.trim();
      targets.set(group, (targets.get(group) ?? 0) + exercise.sets);
    });
  });
  return targets;
}

export function getUndertrainedMuscleGroups(
  entries: TrainingSetEntry[],
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  now: Date,
  calculationMode: UndertrainedCalculationMode,
): UndertrainedGroup[] {
  if (!workoutData?.days || !selectedSplit) return [];

  const weekRange = getPeriodDateRange("week", null, now);
  const weekEntries = entries.filter(
    (entry) =>
      entry.date.getTime() >= weekRange.start.getTime() &&
      entry.date.getTime() <= weekRange.end.getTime(),
  );

  let targetDays = workoutData.days;
  if (calculationMode === "days_done") {
    const loggedDayNumbers = new Set(weekEntries.map((e) => e.dayNumber));
    targetDays = workoutData.days.filter((day) =>
      loggedDayNumbers.has(day.dayNumber),
    );
  }
  if (targetDays.length === 0) return [];

  const targets = sumPlannedSetsByMuscleGroup(targetDays, selectedSplit);
  if (targets.size === 0) return [];

  const actuals = new Map<string, number>();
  weekEntries.forEach((entry) => {
    const group = (entry.muscleGroup ?? "").trim();
    if (!group || !targets.has(group)) return;
    actuals.set(group, (actuals.get(group) ?? 0) + 1);
  });

  const rows = Array.from(targets.entries()).map(([muscleGroup, targetSets]) => {
    const actualSets = actuals.get(muscleGroup) ?? 0;
    const completionPct = targetSets > 0 ? (actualSets / targetSets) * 100 : 0;
    return { muscleGroup, actualSets, targetSets, completionPct };
  });

  const avgCompletion =
    rows.reduce((sum, r) => sum + r.completionPct, 0) / rows.length;

  return rows
    .map((row) => ({ ...row, deltaFromAvg: avgCompletion - row.completionPct }))
    .sort((a, b) => b.deltaFromAvg - a.deltaFromAvg);
}
