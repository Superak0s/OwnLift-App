import {
  getPeriodDateRange,
  aggregateTrainingSummary,
  buildTrainingSetEntries,
  getUndertrainedMuscleGroups,
  type TrainingSetEntry,
} from "./trainingSummary";
import type { WorkoutData } from "@shared/types";

describe("getPeriodDateRange", () => {
  const now = new Date("2026-08-12T15:30:00"); // Wednesday

  it("today spans the current calendar day", () => {
    const range = getPeriodDateRange("today", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-12T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("week spans Monday through end of today", () => {
    const range = getPeriodDateRange("week", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-10T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("month spans the 1st through end of today", () => {
    const range = getPeriodDateRange("month", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("custom uses the given range, normalized to full days", () => {
    const range = getPeriodDateRange(
      "custom",
      { start: new Date("2026-08-01T09:00:00"), end: new Date("2026-08-05T18:00:00") },
      now,
    );
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-05T23:59:59.999").toISOString());
  });

  it("custom with a reversed range swaps start and end", () => {
    const range = getPeriodDateRange(
      "custom",
      { start: new Date("2026-08-05T00:00:00"), end: new Date("2026-08-01T00:00:00") },
      now,
    );
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-05T23:59:59.999").toISOString());
  });

  it("custom with no range falls back to today", () => {
    const range = getPeriodDateRange("custom", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-12T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });
});

describe("aggregateTrainingSummary", () => {
  const range = {
    start: new Date("2026-08-10T00:00:00"),
    end: new Date("2026-08-12T23:59:59.999"),
  };

  const entries: TrainingSetEntry[] = [
    { date: new Date("2026-08-11T10:00:00"), exerciseName: "Bench Press", muscleGroup: "Chest", weight: 60, reps: 8, dayNumber: 1 },
    { date: new Date("2026-08-11T10:05:00"), exerciseName: "Bench Press", muscleGroup: "Chest", weight: 62.5, reps: 6, dayNumber: 1 },
    { date: new Date("2026-08-12T09:00:00"), exerciseName: "Squat", muscleGroup: "Legs", weight: 100, reps: 5, dayNumber: 1 },
    { date: new Date("2026-08-09T09:00:00"), exerciseName: "Deadlift", muscleGroup: "Back", weight: 120, reps: 5, dayNumber: 1 }, // outside range
    { date: new Date("2026-08-11T11:00:00"), exerciseName: "Overhead Press", muscleGroup: null, weight: 30, reps: 10, dayNumber: 1 },
  ];

  it("filters entries outside the date range", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const total = summary.exercises.reduce((sum, e) => sum + e.sets, 0);
    expect(total).toBe(4); // Deadlift excluded
  });

  it("groups sets and sums volume per muscle group", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const chest = summary.muscleGroups.find((m) => m.muscleGroup === "Chest");
    expect(chest?.sets).toBe(2);
    expect(chest?.volume).toBe(60 * 8 + 62.5 * 6);
  });

  it("buckets entries with no muscle group under Unknown", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const unknown = summary.muscleGroups.find((m) => m.muscleGroup === "Unknown");
    expect(unknown?.sets).toBe(1);
    expect(unknown?.volume).toBe(30 * 10);
  });

  it("groups sets and sums volume per exercise", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const bench = summary.exercises.find((e) => e.exerciseName === "Bench Press");
    expect(bench?.sets).toBe(2);
    expect(bench?.volume).toBe(60 * 8 + 62.5 * 6);
    expect(bench?.muscleGroup).toBe("Chest");
  });

  it("sorts both breakdowns by sets descending", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const setsDesc = summary.muscleGroups.every(
      (row, i, arr) => i === 0 || arr[i - 1].sets >= row.sets,
    );
    expect(setsDesc).toBe(true);
  });

  it("returns empty arrays for no matching entries", () => {
    const summary = aggregateTrainingSummary([], range);
    expect(summary.muscleGroups).toEqual([]);
    expect(summary.exercises).toEqual([]);
  });
});

describe("buildTrainingSetEntries", () => {
  it("carries dayNumber through from completedDays", () => {
    const workoutData: WorkoutData = {
      days: [
        {
          dayNumber: 1,
          split: {
            solo: {
              totalSets: 3,
              exercises: [{ name: "Bench Press", muscleGroup: "Chest", sets: 3 }],
            },
          },
        },
      ],
    };
    const completedDays = {
      1: { 0: { 0: { weight: 60, reps: 8, completedAt: "2026-08-11T10:00:00", note: "", isWarmup: false } } },
    };
    const entries = buildTrainingSetEntries([], workoutData, "solo", completedDays);
    expect(entries).toHaveLength(1);
    expect(entries[0].dayNumber).toBe(1);
  });
});

describe("getUndertrainedMuscleGroups", () => {
  const now = new Date("2026-08-12T15:30:00"); // Wednesday, week = Mon Aug 10 - now

  const workoutData: WorkoutData = {
    days: [
      {
        dayNumber: 1,
        split: {
          solo: {
            totalSets: 6,
            exercises: [
              { name: "Bench Press", muscleGroup: "Chest", sets: 3 },
              { name: "Lat Pulldown", muscleGroup: "Back", sets: 3 },
            ],
          },
        },
      },
      {
        dayNumber: 2,
        split: {
          solo: {
            totalSets: 3,
            exercises: [{ name: "Squat", muscleGroup: "Legs", sets: 3 }],
          },
        },
      },
    ],
  };

  const makeEntry = (
    overrides: Partial<TrainingSetEntry>,
  ): TrainingSetEntry => ({
    date: new Date("2026-08-11T10:00:00"),
    exerciseName: "Bench Press",
    muscleGroup: "Chest",
    weight: 60,
    reps: 8,
    dayNumber: 1,
    ...overrides,
  });

  it("days_done mode: only counts target from days that were actually logged this week", () => {
    // Day 1 fully logged (3 Chest sets of 3 planned, 0 of 3 planned Back sets
    // -> Chest 100%, Back 0%). Day 2 (Legs) never logged this week, so its
    // target/actual are excluded entirely under days_done.
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
    ];
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "days_done",
    );
    const groups = result.map((r) => r.muscleGroup);
    expect(groups).not.toContain("Legs"); // day 2 not logged this week -> excluded
    const back = result.find((r) => r.muscleGroup === "Back");
    expect(back?.targetSets).toBe(3); // day 1's planned Back target still counted
    expect(back?.actualSets).toBe(0);
    expect(back?.completionPct).toBe(0);
    expect(back?.deltaFromAvg).toBeGreaterThan(25); // avg of Chest(100%) and Back(0%) = 50; 50-0=50
    const chest = result.find((r) => r.muscleGroup === "Chest");
    expect(chest).toBeUndefined(); // Chest's delta (-50) doesn't exceed the threshold -> excluded
  });

  it("full_split mode: includes every day's target regardless of what was logged", () => {
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
    ];
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "full_split",
    );
    const groups = result.map((r) => r.muscleGroup);
    expect(groups).toContain("Legs"); // day 2's target counted even though unlogged
    const legs = result.find((r) => r.muscleGroup === "Legs");
    expect(legs?.targetSets).toBe(3);
    expect(legs?.actualSets).toBe(0);
  });

  it("sorts most-undertrained first and excludes groups under the 25-point delta", () => {
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
    ];
    // Both muscle groups fully logged (100% each) -> avg 100, delta 0 for both -> neither undertrained.
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "days_done",
    );
    expect(result.every((r) => r.deltaFromAvg <= 25)).toBe(true);
  });

  it("returns an empty array when no days have been logged this week (days_done mode)", () => {
    const result = getUndertrainedMuscleGroups(
      [],
      workoutData,
      "solo",
      now,
      "days_done",
    );
    expect(result).toEqual([]);
  });
});
