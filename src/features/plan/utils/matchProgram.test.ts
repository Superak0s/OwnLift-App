import { matchProgram, applyResolution } from "./matchProgram";
import type { WorkoutData } from "@shared/types";

const program = {
  days: [
    {
      dayNumber: 1,
      split: {
        A: {
          exercises: [
            { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 3 },
            { name: "Incline Press", muscleGroup: "Chest", sets: 3 },
            { name: "Kostas Special Thing", muscleGroup: "Arms", sets: 2 },
          ],
        },
      },
    },
  ],
} as unknown as WorkoutData;

describe("matchProgram", () => {
  it("applies confident matches without asking", () => {
    const { program: matched } = matchProgram(program);
    expect(matched.days[0].split.A.exercises[0].exerciseId).toBeTruthy();
  });

  it("leaves uncertain exercises unmatched and reports them", () => {
    const { program: matched, unresolved } = matchProgram(program);
    expect(matched.days[0].split.A.exercises[1].exerciseId).toBeUndefined();
    expect(unresolved.map((u) => u.name)).toContain("Incline Press");
  });

  it("reports a nonsense name with no candidates rather than guessing", () => {
    const { unresolved } = matchProgram(program);
    const custom = unresolved.find((u) => u.name === "Kostas Special Thing");
    expect(custom?.candidates).toEqual([]);
  });

  it("does not mutate the input program", () => {
    matchProgram(program);
    expect(program.days[0].split.A.exercises[0]).not.toHaveProperty(
      "exerciseId",
    );
  });

  it("leaves already-matched exercises alone so it is safe to rerun", () => {
    const { program: once } = matchProgram(program);
    const { unresolved } = matchProgram(once);
    expect(unresolved.map((u) => u.name)).not.toContain("Barbell Bench Press");
  });
});

describe("applyResolution", () => {
  it("sets the chosen id on the targeted exercise", () => {
    const { unresolved } = matchProgram(program);
    const target = unresolved.find((u) => u.name === "Incline Press")!;
    const result = applyResolution(program, target, "Some_Id");
    expect(result.days[0].split.A.exercises[1].exerciseId).toBe("Some_Id");
  });

  it("leaves the exercise unmatched when resolved to custom", () => {
    const { unresolved } = matchProgram(program);
    const target = unresolved.find((u) => u.name === "Incline Press")!;
    const result = applyResolution(program, target, null);
    expect(result.days[0].split.A.exercises[1].exerciseId).toBeUndefined();
  });
});
