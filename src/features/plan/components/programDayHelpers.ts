export {
  getDayExerciseList,
  getDayLabelAndTitle,
  getPersonEntries,
} from "@shared/components/ProgramDayCardBase";

export function allDayIndices(workoutData: unknown): Set<number> {
  const days = (workoutData as { days?: unknown[] } | null)?.days;
  return new Set(days ? days.map((_, i) => i) : []);
}
