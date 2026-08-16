import {
  normalizeTokens,
  diceScore,
  matchExercise,
  searchExercises,
  getExerciseById,
  AUTO_ACCEPT_SCORE,
} from "./exerciseDb";

describe("normalizeTokens", () => {
  // "press" normalizes to "pres" — singularize strips the trailing s from both
  // sides of every comparison, so the mangling is invisible to matching.
  it("lowercases, strips punctuation and splits on whitespace", () => {
    expect(normalizeTokens("Barbell Bench-Press!")).toEqual([
      "barbell",
      "bench",
      "pres",
    ]);
  });

  it("collapses singular and plural to the same token", () => {
    expect(normalizeTokens("Tricep Pushdown")).toEqual(
      normalizeTokens("Triceps Pushdown"),
    );
  });

  it("expands gym abbreviations into their full tokens", () => {
    expect(normalizeTokens("DB Incline Press")).toEqual([
      "dumbbell",
      "incline",
      "pres",
    ]);
    expect(normalizeTokens("RDL")).toEqual(["romanian", "deadlift"]);
  });
});

describe("diceScore", () => {
  it("is 1 for identical token sets", () => {
    expect(diceScore(["bench", "press"], ["press", "bench"])).toBe(1);
  });

  it("is 0 for disjoint token sets", () => {
    expect(diceScore(["bench"], ["squat"])).toBe(0);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const score = diceScore(["incline", "press"], ["incline", "dumbbell", "press"]);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });
});

describe("matchExercise", () => {
  it("auto-accepts an exact name", () => {
    const result = matchExercise("Dumbbell Bench Press");
    expect(result.status).toBe("confident");
    expect(result.candidates[0].exercise.name).toBe("Dumbbell Bench Press");
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(AUTO_ACCEPT_SCORE);
  });

  it("resolves an abbreviation that edit distance alone would miss", () => {
    const result = matchExercise("BB Bench Press");
    expect(result.candidates[0].exercise.name).toBe(
      "Barbell Bench Press - Medium Grip",
    );
  });

  it("ignores qualifier suffixes so the plain lift beats a variant", () => {
    const result = matchExercise("Barbell Bench Press");
    expect(result.candidates[0].exercise.name).toBe(
      "Barbell Bench Press - Medium Grip",
    );
  });

  it("never auto-accepts a qualified variant for an unqualified query", () => {
    const result = matchExercise("Squat");
    expect(result.status).toBe("uncertain");
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("asks rather than guessing when variants tie for the top score", () => {
    const result = matchExercise("Bench Press");
    expect(result.status).toBe("uncertain");
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns uncertain with candidates for a partial name", () => {
    const result = matchExercise("Incline Press");
    expect(result.status).toBe("uncertain");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("never auto-accepts a nonsense name", () => {
    expect(matchExercise("zzzqqq widget flail").status).toBe("uncertain");
  });

  it("returns uncertain with no candidates for an empty name", () => {
    expect(matchExercise("  ")).toEqual({ status: "uncertain", candidates: [] });
  });
});

describe("searchExercises", () => {
  it("finds exercises by substring, respecting the limit", () => {
    const results = searchExercises("bench", 5);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.every((e) => e.name.toLowerCase().includes("bench"))).toBe(true);
  });

  it("returns nothing for a blank query", () => {
    expect(searchExercises("   ")).toEqual([]);
  });
});

describe("getExerciseById", () => {
  it("returns undefined for an unknown id", () => {
    expect(getExerciseById("not_a_real_id")).toBeUndefined();
  });
});
