import { computeWorkoutAnalytics } from "../workoutAnalytics";
import type { SetTiming } from "@shared/types";

function set(overrides: Partial<SetTiming>): SetTiming {
  return {
    set_index: 0,
    end_time: "2024-01-01T10:00:30.000Z",
    weight: 100,
    reps: 10,
    is_warmup: false,
    ...overrides,
  };
}

describe("computeWorkoutAnalytics", () => {
  it("returns zeroed stats for no sessions", () => {
    const result = computeWorkoutAnalytics([]);
    expect(result).toEqual({
      averageTimeBetweenSets: 120,
      totalSessions: 0,
      totalSetsCompleted: 0,
      totalVolume: 0,
      averageRestTime: 0,
      averageSetDuration: 0,
    });
  });

  it("excludes warmup sets from volume and set count", () => {
    const result = computeWorkoutAnalytics([
      {
        set_timings: [
          set({ start_time: "2024-01-01T10:00:00.000Z", end_time: "2024-01-01T10:00:30.000Z", weight: 100, reps: 10, is_warmup: true }),
          set({ start_time: "2024-01-01T10:01:00.000Z", end_time: "2024-01-01T10:01:30.000Z", weight: 100, reps: 10 }),
        ],
      },
    ]);
    expect(result.totalSetsCompleted).toBe(1);
    expect(result.totalVolume).toBe(1000);
  });

  it("computes rest gaps between consecutive working sets", () => {
    const result = computeWorkoutAnalytics([
      {
        set_timings: [
          set({ start_time: "2024-01-01T10:00:00.000Z", end_time: "2024-01-01T10:00:30.000Z" }),
          set({ start_time: "2024-01-01T10:01:30.000Z", end_time: "2024-01-01T10:02:00.000Z" }),
        ],
      },
    ]);
    expect(result.averageRestTime).toBe(60);
    expect(result.averageSetDuration).toBe(30);
    expect(result.totalSessions).toBe(1);
  });
});
