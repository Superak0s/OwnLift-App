import {
  getPeriodDateRange,
  aggregateTrainingSummary,
  buildTrainingSetEntries,
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
