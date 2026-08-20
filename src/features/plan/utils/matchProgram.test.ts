import {
  matchProgram,
  applyResolution,
  sameExercise,
  type UnresolvedExercise,
} from "./matchProgram";
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

describe("muscle-group disambiguation", () => {
  const build = (name: string, muscleGroup: string) =>
    ({
      days: [
        {
          dayNumber: 1,
          split: { A: { exercises: [{ name, muscleGroup, sets: 3 }] } },
        },
      ],
    }) as unknown as WorkoutData;

  it("auto-matches when exactly one candidate targets the stated muscle", () => {
    const { program: matched, unresolved } = matchProgram(
      build("Chest Dip", "Chest"),
    );
    expect(matched.days[0].split.A.exercises[0].exerciseId).toBeTruthy();
    expect(unresolved).toEqual([]);
  });

  it("still asks when several candidates target the stated muscle", () => {
    const { unresolved } = matchProgram(build("Chest Dip", "Triceps"));
    expect(unresolved.map((u) => u.name)).toContain("Chest Dip");
  });

  it("still asks when no candidate targets the stated muscle", () => {
    const { unresolved } = matchProgram(build("Chest Dip", "Calves"));
    expect(unresolved.map((u) => u.name)).toContain("Chest Dip");
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

describe("rematch", () => {
  const built = () => ({
    days: [
      {
        dayNumber: 1,
        split: {
          A: {
            exercises: [
              { name: "Machine Fly", muscleGroup: "Chest", sets: 3, exerciseId: "Dip_Machine" },
              { name: "Barbell Deadlift", muscleGroup: "Back", sets: 3, exerciseId: "Barbell_Deadlift" },
            ],
          },
        },
      },
    ],
  }) as unknown as WorkoutData;

  it("leaves already-matched exercises alone by default", () => {
    expect(matchProgram(built()).unresolved).toHaveLength(0);
  });

  it("re-flags a guess but keeps an exact match", () => {
    const { unresolved } = matchProgram(built(), true);
    expect(unresolved.map((u) => u.name)).toEqual(["Machine Fly"]);
  });
});

describe("muscle group ranking", () => {
  const program = {
    days: [
      {
        dayNumber: 1,
        split: {
          A: {
            exercises: [
              { name: "Machine Hip Thrust", muscleGroup: "Glutes", sets: 3 },
            ],
          },
        },
      },
    ],
  } as unknown as WorkoutData;

  it("offers the candidate on the stated muscle first", () => {
    const { unresolved, program: matched } = matchProgram(program);
    const assigned =
      matched.days?.[0].split.A.exercises[0].exerciseId ??
      unresolved[0]?.candidates[0]?.exercise.id;
    expect(assigned).toBe("Barbell_Hip_Thrust");
  });
});

describe("sameExercise", () => {
  const entry = (name: string, muscleGroup: string, dayNumber: number) =>
    ({
      dayNumber,
      split: "A",
      exerciseIndex: 0,
      name,
      muscleGroup,
      candidates: [],
    }) as UnresolvedExercise;

  it("groups the same name and muscle across days", () => {
    expect(
      sameExercise(entry("Machine Row", "Back", 1), entry("machine row ", "back", 3)),
    ).toBe(true);
  });

  it("keeps a different muscle group separate", () => {
    expect(
      sameExercise(entry("Pullover", "Back", 1), entry("Pullover", "Chest", 2)),
    ).toBe(false);
  });

  it("applies one answer to every occurrence", () => {
    const program = {
      days: [1, 2].map((dayNumber) => ({
        dayNumber,
        split: { A: { exercises: [{ name: "Machine Row", muscleGroup: "Back", sets: 3 }] } },
      })),
    } as unknown as WorkoutData;
    const twins = [entry("Machine Row", "Back", 1), entry("Machine Row", "Back", 2)];
    const result = applyResolution(program, twins, "Seated_Cable_Rows");
    expect(
      result.days?.map((d) => d.split.A.exercises[0].exerciseId),
    ).toEqual(["Seated_Cable_Rows", "Seated_Cable_Rows"]);
  });
});
