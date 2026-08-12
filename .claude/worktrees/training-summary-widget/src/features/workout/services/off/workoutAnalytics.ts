import type { SetTiming } from "@shared/types";
import type { WorkoutAnalytics } from "../on/workout";

export function computeWorkoutAnalytics(
  sessions: { set_timings: SetTiming[] }[],
): WorkoutAnalytics {
  const allSets = sessions.flatMap((s) => s.set_timings);
  const workingSets = allSets.filter((t) => !t.is_warmup);

  const totalVolume = workingSets.reduce(
    (sum, t) => sum + (t.weight ?? 0) * (t.reps ?? 0),
    0,
  );

  const setDurations: number[] = [];
  const restGaps: number[] = [];
  const sortedSets = [...workingSets].sort(
    (a, b) =>
      new Date(a.start_time ?? 0).getTime() -
      new Date(b.start_time ?? 0).getTime(),
  );
  for (let i = 0; i < sortedSets.length; i++) {
    const t = sortedSets[i];
    const duration =
      (new Date(t.end_time).getTime() - new Date(t.start_time ?? 0).getTime()) /
      1000;
    if (Number.isFinite(duration) && duration >= 0) setDurations.push(duration);

    if (i > 0) {
      const gap =
        (new Date(t.start_time ?? 0).getTime() -
          new Date(sortedSets[i - 1].end_time).getTime()) /
        1000;
      if (Number.isFinite(gap) && gap >= 0) restGaps.push(gap);
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    averageTimeBetweenSets: restGaps.length ? avg(restGaps) : 120,
    totalSessions: sessions.length,
    totalSetsCompleted: workingSets.length,
    totalVolume,
    averageRestTime: avg(restGaps),
    averageSetDuration: avg(setDurations),
  };
}
