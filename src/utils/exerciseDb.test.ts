import {
  normalizeTokens,
  diceScore,
  matchExercise,
  searchExercises,
  filterExercises,
  getExerciseById,
  toSuggestions,
  AUTO_ACCEPT_SCORE,
} from "./exerciseDb";
import { EXERCISE_ALIASES } from "./exerciseAliases";

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
    const result = matchExercise("Barbell Incline Bench Press");
    expect(result.candidates[0].exercise.name).toBe(
      "Barbell Incline Bench Press - Medium Grip",
    );
  });

  it("never auto-accepts a qualified variant for an unqualified query", () => {
    const result = matchExercise("Back Flyes");
    expect(result.status).toBe("uncertain");
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("asks rather than guessing when variants tie for the top score", () => {
    const result = matchExercise("Hang Clean");
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

describe("aliases", () => {
  it("maps every alias to an id that exists in the dataset", () => {
    const missing = Object.entries(EXERCISE_ALIASES)
      .filter(([, id]) => !getExerciseById(id))
      .map(([alias, id]) => `${alias} -> ${id}`);
    expect(missing).toEqual([]);
  });

  it("confidently resolves common lifts the dataset has no plain entry for", () => {
    expect(matchExercise("Squat").candidates[0].exercise.name).toBe("Barbell Squat");
    expect(matchExercise("Bench Press").candidates[0].exercise.name).toBe(
      "Barbell Bench Press - Medium Grip",
    );
    expect(matchExercise("Squat").status).toBe("confident");
    expect(matchExercise("Bench Press").status).toBe("confident");
  });

  it("matches aliases case-insensitively and through plural forms", () => {
    expect(matchExercise("PULL UPS").status).toBe("confident");
    expect(matchExercise("Lateral Raises").status).toBe("confident");
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

describe("toSuggestions", () => {
  it("labels with the name and describes muscle and equipment in meta", () => {
    const [first] = toSuggestions("barbell bench press", 1);
    expect(first.label).toBe("Barbell Bench Press - Medium Grip");
    expect(first.meta).toContain("chest");
    expect(first.meta).toContain("barbell");
  });

  it("omits the separator from meta when the exercise has no equipment", () => {
    const noEquipment = toSuggestions("push", 20).find(
      (suggestion) => !suggestion.meta.includes("·"),
    );
    expect(noEquipment).toBeDefined();
  });
});

describe("getExerciseById", () => {
  it("returns undefined for an unknown id", () => {
    expect(getExerciseById("not_a_real_id")).toBeUndefined();
  });
});

describe("machine and assisted gym names", () => {
  it.each([
    ["Machine Chest Press", "Leverage_Chest_Press"],
    ["Seated Chest Press", "Leverage_Chest_Press"],
    ["Incline Chest Press", "Leverage_Incline_Chest_Press"],
    ["Hip Abduction", "Thigh_Abductor"],
    ["Hip Adduction", "Thigh_Adductor"],
    ["Assisted Dip", "Dip_Machine"],
    ["Assisted Pullup", "Band_Assisted_Pull-Up"],
    ["Reverse Curls", "Reverse_Barbell_Curl"],
    ["Rear Kick Machine", "Glute_Kickback"],
    ["Dumbbell Curl", "Dumbbell_Bicep_Curl"],
  ])("matches %s confidently", (name, expectedId) => {
    const result = matchExercise(name);
    expect(result.status).toBe("confident");
    expect(result.candidates[0].exercise.id).toBe(expectedId);
  });
});

describe("filterExercises", () => {
  it("keeps only exercises whose primary muscles are included", () => {
    const results = filterExercises({ include: ["biceps"], limit: 200 });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((e) => e.primaryMuscles.includes("biceps")),
    ).toBe(true);
  });

  it("drops exercises whose primary muscles are excluded", () => {
    const results = filterExercises({ query: "curl", exclude: ["biceps"] });
    expect(results.some((e) => e.primaryMuscles.includes("biceps"))).toBe(false);
  });

  it("matches the query case-insensitively and honours the limit", () => {
    const results = filterExercises({ query: "BENCH press", limit: 3 });
    expect(results).toHaveLength(3);
    expect(
      results.every((e) => e.name.toLowerCase().includes("bench press")),
    ).toBe(true);
  });
});
