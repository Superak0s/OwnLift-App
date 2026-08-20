import type { WorkoutData } from "@shared/types";
import { EXERCISES } from "../../../data/exercises";
import { matchExercise, type ExerciseCandidate } from "@utils/exerciseDb";
import { perfLog, startTimer } from "@utils/perf";

export interface UnresolvedExercise {
  dayNumber: number;
  split: string;
  exerciseIndex: number;
  name: string;
  muscleGroup?: string;
  candidates: ExerciseCandidate[];
}

export interface MatchProgramResult {
  program: WorkoutData;
  unresolved: UnresolvedExercise[];
}

// Programs name a body part ("Legs", "Arms"); the database names individual
// muscles. Anything not listed is passed through, so "glutes" or "chest"
// still work without an entry.
const MUSCLE_GROUPS: Record<string, string[]> = {
  legs: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  quads: ["quadriceps"],
  hams: ["hamstrings"],
  back: ["lats", "middle back", "lower back", "traps"],
  arms: ["biceps", "triceps", "forearms"],
  abs: ["abdominals"],
  core: ["abdominals"],
  delts: ["shoulders"],
};

const KNOWN_MUSCLES = new Set(
  EXERCISES.flatMap((exercise) =>
    exercise.primaryMuscles.map((primary) => primary.toLowerCase()),
  ),
);

// A label the database has no muscle for ("Push", "Upper") says nothing about
// the exercise, so it must not filter anything out.
const targetMuscles = (muscleGroup: string | undefined): string[] | null => {
  const key = muscleGroup?.trim().toLowerCase();
  if (!key) return null;
  const muscles = MUSCLE_GROUPS[key] ?? [key];
  return muscles.every((muscle) => KNOWN_MUSCLES.has(muscle)) ? muscles : null;
};

const hitsMuscle = (candidate: ExerciseCandidate, muscles: string[]): boolean =>
  candidate.exercise.primaryMuscles.some((primary) =>
    muscles.includes(primary.toLowerCase()),
  );

// "Machine Hip Thrust" scores highest against "Smith Machine Hip Raise", an
// abdominal exercise. A name match that works the wrong muscle is the wrong
// exercise, so it is not worth offering at all.
const onStatedMuscle = (
  candidates: ExerciseCandidate[],
  muscles: string[] | null,
): ExerciseCandidate[] =>
  muscles ? candidates.filter((c) => hitsMuscle(c, muscles)) : candidates;

// `rematch` throws away the ids already on the program and scores every
// exercise again, so auto-accepted guesses can be reviewed after the fact.
export const matchProgram = (
  program: WorkoutData,
  rematch = false,
): MatchProgramResult => {
  const timer = startTimer();
  const cloneTimer = startTimer();
  const cloned = structuredClone(program);
  perfLog("matchProgram.clone", cloneTimer());
  const unresolved: UnresolvedExercise[] = [];
  let scanned = 0;
  let matched = 0;

  cloned.days?.forEach((day, dayIdx) => {
    const dayNumber = day.dayNumber ?? dayIdx + 1;
    Object.entries(day.split ?? {}).forEach(([split, splitWorkout]) => {
      splitWorkout?.exercises?.forEach((exercise, exerciseIndex) => {
        scanned += 1;
        if (rematch) exercise.exerciseId = undefined;
        if (exercise.exerciseId || !exercise.name) return;
        matched += 1;
        const { status, candidates: raw } = matchExercise(exercise.name);
        const muscles = targetMuscles(exercise.muscleGroup);
        const candidates = onStatedMuscle(raw, muscles);
        const topSurvived = raw[0] === candidates[0];

        if (
          status === "confident" &&
          topSurvived &&
          (!rematch || candidates[0].score === 1)
        ) {
          exercise.exerciseId = candidates[0].exercise.id;
          return;
        }
        // A re-check exists to expose guesses, so the weaker signals that are
        // good enough on import are not allowed to auto-accept here.
        if (!rematch && muscles && candidates.length === 1) {
          exercise.exerciseId = candidates[0].exercise.id;
          return;
        }
        unresolved.push({
          dayNumber,
          split,
          exerciseIndex,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          candidates,
        });
      });
    });
  });

  perfLog(
    "matchProgram",
    timer(),
    `scanned=${scanned} matched=${matched} unresolved=${unresolved.length}`,
  );

  return { program: cloned, unresolved };
};

export const applyResolution = (
  program: WorkoutData,
  targets: UnresolvedExercise | UnresolvedExercise[],
  exerciseId: string | null,
): WorkoutData => {
  const cloned = structuredClone(program);
  if (exerciseId === null) return cloned;

  for (const target of Array.isArray(targets) ? targets : [targets]) {
    const day = cloned.days?.find(
      (d, idx) => (d.dayNumber ?? idx + 1) === target.dayNumber,
    );
    const exercise =
      day?.split?.[target.split]?.exercises?.[target.exerciseIndex];
    if (exercise) exercise.exerciseId = exerciseId;
  }

  return cloned;
};

// The same exercise usually appears on several days, and answering for one is
// answering for all of them.
export const sameExercise = (
  a: UnresolvedExercise,
  b: UnresolvedExercise,
): boolean =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  (a.muscleGroup ?? "").trim().toLowerCase() ===
    (b.muscleGroup ?? "").trim().toLowerCase();
