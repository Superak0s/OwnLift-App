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
