import { applySplitDraft, draftsFromProgram } from "./splitDraft";
import type { WorkoutData } from "@shared/types";

const ex = (name: string, sets: Record<string, number>) => ({
  name,
  muscleGroup: "chest",
  setsBySplit: sets,
  exerciseId: name.toLowerCase(),
});

const program = (): WorkoutData => ({
  split: ["Me", "Alex"],
  days: [
    {
      dayNumber: 1,
      dayTitle: "Push",
      exercises: [ex("Bench", { Me: 3, Alex: 0 })],
      split: {
        Me: { exercises: [{ name: "Bench", sets: 3 }], totalSets: 3 },
        Alex: { exercises: [], totalSets: 0 },
      },
    },
    {
      dayNumber: 2,
      dayTitle: "Pull",
      exercises: [ex("Row", { Me: 0, Alex: 4 })],
      split: {
        Me: { exercises: [], totalSets: 0 },
        Alex: { exercises: [{ name: "Row", sets: 4 }], totalSets: 4 },
      },
    },
  ],
});

describe("split draft round-trip", () => {
  it("drafts only the split's own days", () => {
    const drafts = draftsFromProgram(program().days, "Alex");
    expect(drafts).toEqual([
      {
        dayIdx: 1,
        dayTitle: "Pull",
        exercises: [
          { name: "Row", exerciseId: "row", muscleGroup: "chest", sets: "4" },
        ],
      },
    ]);
  });

  it("saves edited sets without touching the other split", () => {
    const drafts = draftsFromProgram(program().days, "Alex");
    drafts[0].exercises[0].sets = "6";
    const updated = applySplitDraft(program(), "Alex", drafts);
    expect(updated.days[1].exercises?.[0].setsBySplit).toEqual({
      Me: 0,
      Alex: 6,
    });
    expect(updated.days[0].exercises?.[0].setsBySplit).toEqual({
      Me: 3,
      Alex: 0,
    });
  });

  it("appends a new day and numbers it after the program's last", () => {
    const updated = applySplitDraft(program(), "Alex", [
      ...draftsFromProgram(program().days, "Alex"),
      {
        dayTitle: "Legs",
        exercises: [
          { name: "Squat", exerciseId: "squat", muscleGroup: "quads", sets: "5" },
        ],
      },
    ]);
    expect(updated.days).toHaveLength(3);
    expect(updated.days[2]).toMatchObject({ dayNumber: 3, dayTitle: "Legs" });
    expect(updated.days[2].exercises?.[0].setsBySplit).toEqual({
      Me: 0,
      Alex: 5,
    });
  });

  it("drops a removed day only when no split still uses it", () => {
    const updated = applySplitDraft(program(), "Alex", []);
    expect(updated.days.map((d) => d.dayTitle)).toEqual(["Push"]);
    expect(updated.totalDays).toBe(1);
  });
});
