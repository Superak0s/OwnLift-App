import { getExercisesByMuscleGroup } from "./exerciseMatching";
import type { WorkoutData } from "@shared/types";

const workoutData: WorkoutData = {
  days: [
    {
      split: {
        A: {
          exercises: [
            { name: "Bench Press", muscleGroup: "Chest", sets: 3 },
            { name: "Incline Press", muscleGroup: "Chest", sets: 3 },
            { name: "Lat Pulldown", muscleGroup: "Back", sets: 3 },
          ],
        },
      },
    },
    {
      split: {
        A: {
          exercises: [
            { name: "Cable Fly", muscleGroup: "chest", sets: 3 },
            { name: "Bench Press", muscleGroup: "Chest", sets: 3 },
          ],
        },
      },
    },
  ],
} as unknown as WorkoutData;

describe("getExercisesByMuscleGroup", () => {
  it("returns deduped, case-insensitive matches for the muscle group, excluding the given name", () => {
    const result = getExercisesByMuscleGroup(
      workoutData,
      "A",
      "Chest",
      "Bench Press",
    );
    expect(result.sort()).toEqual(["Cable Fly", "Incline Press"]);
  });

  it("excludes exercises from muscle groups that don't match", () => {
    const result = getExercisesByMuscleGroup(workoutData, "A", "Back");
    expect(result).toEqual(["Lat Pulldown"]);
  });

  it("returns an empty array when workoutData, selectedSplit, or muscleGroup is missing", () => {
    expect(getExercisesByMuscleGroup(null, "A", "Chest")).toEqual([]);
    expect(getExercisesByMuscleGroup(workoutData, null, "Chest")).toEqual([]);
    expect(getExercisesByMuscleGroup(workoutData, "A", "")).toEqual([]);
  });

  it("returns an empty array when no exercise matches the muscle group", () => {
    expect(getExercisesByMuscleGroup(workoutData, "A", "Legs")).toEqual([]);
  });
});
