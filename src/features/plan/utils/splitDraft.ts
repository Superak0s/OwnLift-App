import type {
  ExerciseWithSets,
  WorkoutData,
  WorkoutDay,
} from "@shared/types";
import { visibleDaysForSplit } from "@utils/programDays";
import type { SplitDayDraft } from "../types";

const DEFAULT_SETS = 3;

const setsFor = (exercise: ExerciseWithSets, split: string): number =>
  Number(exercise.setsBySplit?.[split] ?? 0);

export function draftsFromProgram(
  days: readonly WorkoutDay[],
  split: string,
): SplitDayDraft[] {
  return visibleDaysForSplit(days, split).map(({ day, dayIdx }) => ({
    dayIdx,
    dayTitle: day.dayTitle ?? "",
    exercises: (day.exercises ?? [])
      .filter((ex) => setsFor(ex, split) > 0)
      .map((ex) => ({
        name: ex.name,
        exerciseId: ex.exerciseId ?? "",
        muscleGroup: ex.muscleGroup ?? "",
        sets: String(setsFor(ex, split)),
      })),
  }));
}

function writeDraft(
  day: WorkoutDay,
  split: string,
  draft: SplitDayDraft,
  splits: readonly string[],
): WorkoutDay {
  const exercises = [...(day.exercises ?? [])];
  const splitExercises = draft.exercises.map((d) => {
    const sets = Number(d.sets) || DEFAULT_SETS;
    const existing = exercises.findIndex((e) =>
      d.exerciseId ? e.exerciseId === d.exerciseId : e.name === d.name,
    );
    if (existing >= 0) {
      exercises[existing] = {
        ...exercises[existing],
        setsBySplit: { ...exercises[existing].setsBySplit, [split]: sets },
      };
    } else {
      exercises.push({
        name: d.name,
        exerciseId: d.exerciseId || undefined,
        muscleGroup: d.muscleGroup,
        setsBySplit: Object.fromEntries(
          splits.map((s) => [s, s === split ? sets : 0]),
        ),
      });
    }
    return {
      name: d.name,
      exerciseId: d.exerciseId || undefined,
      muscleGroup: d.muscleGroup,
      sets,
    };
  });

  return {
    ...day,
    dayTitle: draft.dayTitle || day.dayTitle,
    muscleGroups: Array.from(
      new Set(
        [...(day.muscleGroups ?? []), ...draft.exercises.map((e) => e.muscleGroup)].filter(
          Boolean,
        ),
      ),
    ),
    exercises,
    split: {
      ...day.split,
      [split]: {
        exercises: splitExercises,
        totalSets: splitExercises.reduce((sum, e) => sum + e.sets, 0),
      },
    },
  };
}

/**
 * Days are shared across every split, so editing one split never deletes a day
 * outright: it only zeroes that split's sets. A day that ends up with no sets
 * for any split is dropped, which is how removing a day actually happens.
 */
export function applySplitDraft(
  workoutData: WorkoutData,
  split: string,
  drafts: readonly SplitDayDraft[],
): WorkoutData {
  const splits = workoutData.split ?? [split];
  const edits = new Map(
    drafts
      .filter((d) => d.dayIdx !== undefined)
      .map((d) => [d.dayIdx as number, d]),
  );

  const cleared = (workoutData.days ?? []).map((day) => ({
    ...day,
    exercises: (day.exercises ?? []).map((e) => ({
      ...e,
      setsBySplit: { ...e.setsBySplit, [split]: 0 },
    })),
    split: { ...day.split, [split]: { exercises: [], totalSets: 0 } },
  }));

  let nextDayNumber = cleared.reduce(
    (max, d) => Math.max(max, d.dayNumber ?? 0),
    0,
  );

  const edited = cleared.map((day, idx) => {
    const draft = edits.get(idx);
    return draft ? writeDraft(day, split, draft, splits) : day;
  });

  const added = drafts
    .filter((d) => d.dayIdx === undefined)
    .map((draft) => {
      nextDayNumber += 1;
      const blank: WorkoutDay = {
        dayNumber: nextDayNumber,
        dayTitle: draft.dayTitle,
        muscleGroups: [],
        exercises: [],
        split: Object.fromEntries(
          splits.map((s) => [s, { exercises: [], totalSets: 0 }]),
        ),
      };
      return writeDraft(blank, split, draft, splits);
    });

  const days = [...edited, ...added].filter((day) =>
    (day.exercises ?? []).some((e) =>
      Object.values(e.setsBySplit ?? {}).some((s) => Number(s) > 0),
    ),
  );

  return { ...workoutData, days, totalDays: days.length, split: splits };
}
