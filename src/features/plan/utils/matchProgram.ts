import type { WorkoutData } from "@shared/types";
import { matchExercise, type ExerciseCandidate } from "@utils/exerciseDb";

export interface UnresolvedExercise {
  dayNumber: number;
  person: string;
  exerciseIndex: number;
  name: string;
  candidates: ExerciseCandidate[];
}

export interface MatchProgramResult {
  program: WorkoutData;
  unresolved: UnresolvedExercise[];
}

export const matchProgram = (program: WorkoutData): MatchProgramResult => {
  const cloned = structuredClone(program);
  const unresolved: UnresolvedExercise[] = [];

  cloned.days?.forEach((day, dayIdx) => {
    const dayNumber = day.dayNumber ?? dayIdx + 1;
    Object.entries(day.split ?? {}).forEach(([person, personWorkout]) => {
      personWorkout?.exercises?.forEach((exercise, exerciseIndex) => {
        if (exercise.exerciseId || !exercise.name) return;
        const { status, candidates } = matchExercise(exercise.name);
        if (status === "confident") {
          exercise.exerciseId = candidates[0].exercise.id;
          return;
        }
        unresolved.push({
          dayNumber,
          person,
          exerciseIndex,
          name: exercise.name,
          candidates,
        });
      });
    });
  });

  return { program: cloned, unresolved };
};

export const applyResolution = (
  program: WorkoutData,
  target: UnresolvedExercise,
  exerciseId: string | null,
): WorkoutData => {
  const cloned = structuredClone(program);
  if (exerciseId === null) return cloned;

  const day = cloned.days?.find(
    (d, idx) => (d.dayNumber ?? idx + 1) === target.dayNumber,
  );
  const exercise =
    day?.split?.[target.person]?.exercises?.[target.exerciseIndex];
  if (exercise) exercise.exerciseId = exerciseId;

  return cloned;
};
