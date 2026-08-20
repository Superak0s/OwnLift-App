const { trimExercises } = require("../build-exercise-db");

const valid = {
  id: "Barbell_Bench_Press",
  name: "Barbell Bench Press",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps", "shoulders"],
  equipment: "barbell",
  category: "strength",
  instructions: ["Lie on the bench."],
  images: ["a.jpg"],
};

describe("trimExercises", () => {
  it("keeps only the fields we use", () => {
    expect(trimExercises([valid])).toEqual([
      {
        id: "Barbell_Bench_Press",
        name: "Barbell Bench Press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps", "shoulders"],
        equipment: "barbell",
        category: "strength",
      },
    ]);
  });

  it("allows a null equipment value", () => {
    expect(trimExercises([{ ...valid, equipment: null }])[0].equipment).toBeNull();
  });

  it("throws when a required field is missing", () => {
    const { name, ...missingName } = valid;
    expect(() => trimExercises([missingName])).toThrow(/name/);
  });

  it("throws when primaryMuscles is empty", () => {
    expect(() => trimExercises([{ ...valid, primaryMuscles: [] }])).toThrow(
      /primaryMuscles/,
    );
  });
});
