import { migrateLegacyProgram } from "./legacyProgram";

describe("migrateLegacyProgram", () => {
  it("renames setsByPerson wherever it is nested", () => {
    const migrated = migrateLegacyProgram({
      days: [
        {
          exercises: [{ name: "Bench", setsByPerson: { Me: 4 } }],
          split: { Me: { exercises: [{ name: "Bench", sets: 4 }] } },
        },
      ],
    });
    expect(migrated.days[0].exercises[0]).toEqual({
      name: "Bench",
      setsBySplit: { Me: 4 },
    });
  });

  it("leaves already-migrated programs and other keys untouched", () => {
    const program = { days: [{ exercises: [{ setsBySplit: { Me: 3 } }] }] };
    expect(migrateLegacyProgram(program)).toEqual(program);
  });
});
