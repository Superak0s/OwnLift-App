# Exercise Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text exercise names with a bundled canonical exercise database, matched on import and selected directly everywhere exercises are entered.

**Architecture:** A build script trims free-exercise-db to ~100 KB of JSON committed at `src/data/exercises.json` and `require()`d into memory — no SQLite table, no seeding. A new pure module `src/utils/exerciseDb.ts` owns dataset access and match scoring. Plan exercises gain an optional `exerciseId`; muscles are looked up through it at read time rather than copied onto the plan.

**Tech Stack:** React Native / Expo, TypeScript, Jest (jest-expo), Node for the build script.

**Spec:** `docs/superpowers/specs/2026-08-16-exercise-database-design.md`

## Global Constraints

- **No images, no instructions.** Both are stripped by the build script. Never add them back without a new decision.
- **`exerciseId` is always optional.** An exercise with no match is valid and must keep working. Never force a match, never block a save on an unmatched exercise.
- **Muscles are never copied onto plan exercises.** Always look them up from the dataset via `exerciseId`. The existing free-text `muscleGroup` field stays as the fallback for unmatched exercises.
- **Do not delete `src/utils/exerciseMatching.tsx`.** It keeps typo-checking against plan-local names and muscle-group canonicalization. Its existing test `src/utils/exerciseMatching.test.ts` must keep passing unchanged.
- **Match thresholds are named constants**, never inline literals: `AUTO_ACCEPT_SCORE = 0.85`, `SUGGEST_SCORE = 0.5`.
- Run a single test file with `npx jest <path>`. Typecheck with `npx tsc --noEmit`. There is no lint script.
- Install with `npm install --legacy-peer-deps`. Peer deps are not otherwise resolvable.

---

### Task 1: Build script and bundled dataset

Generates the trimmed dataset. Everything downstream reads its output.

**Files:**
- Create: `scripts/build-exercise-db.js`
- Create: `src/data/exercises.json` (generated, committed)
- Create: `src/data/exercises.ts`
- Test: `scripts/__tests__/build-exercise-db.test.js`
- Modify: `package.json` (add script), `tsconfig.json` (only if `resolveJsonModule` is absent)

**Interfaces:**
- Consumes: nothing.
- Produces: `src/data/exercises.ts` exporting `EXERCISES: CanonicalExercise[]` and the `CanonicalExercise` type:
  ```ts
  export interface CanonicalExercise {
    id: string;
    name: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    equipment: string | null;
    category: string;
  }
  ```
  Also exports `trimExercises(raw: unknown[]): CanonicalExercise[]` from `scripts/build-exercise-db.js` for testing.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/build-exercise-db.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/__tests__/build-exercise-db.test.js`
Expected: FAIL — cannot find module `../build-exercise-db`.

- [ ] **Step 3: Write the build script**

Create `scripts/build-exercise-db.js`:

```js
const fs = require("fs");
const path = require("path");

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const OUTPUT = path.join(__dirname, "..", "src", "data", "exercises.json");

function trimExercises(raw) {
  return raw.map((entry, index) => {
    for (const field of ["id", "name", "category"]) {
      if (typeof entry[field] !== "string" || !entry[field]) {
        throw new Error(`Entry ${index}: missing or invalid "${field}"`);
      }
    }
    if (!Array.isArray(entry.primaryMuscles) || entry.primaryMuscles.length === 0) {
      throw new Error(`Entry ${index} (${entry.name}): empty "primaryMuscles"`);
    }
    if (!Array.isArray(entry.secondaryMuscles)) {
      throw new Error(`Entry ${index} (${entry.name}): missing "secondaryMuscles"`);
    }
    return {
      id: entry.id,
      name: entry.name,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      equipment: entry.equipment ?? null,
      category: entry.category,
    };
  });
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const trimmed = trimExercises(await response.json());
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(trimmed));
  console.log(`Wrote ${trimmed.length} exercises to ${OUTPUT}`);
}

module.exports = { trimExercises };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/__tests__/build-exercise-db.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Generate the dataset**

Add to `package.json` `"scripts"`:

```json
"build:exercise-db": "node scripts/build-exercise-db.js"
```

Run: `npm run build:exercise-db`
Expected: prints `Wrote 800-900 exercises`. Confirm the file is under 200 KB — if it is over 1 MB, the trim did not apply and something is wrong.

- [ ] **Step 6: Add the typed accessor**

Create `src/data/exercises.ts`:

```ts
import exercises from "./exercises.json";

export interface CanonicalExercise {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  category: string;
}

export const EXERCISES = exercises as CanonicalExercise[];
```

- [ ] **Step 7: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. If it reports the JSON import cannot be resolved, add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json` and rerun.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-exercise-db.js scripts/__tests__/build-exercise-db.test.js src/data/ package.json tsconfig.json
git commit -m "feat: bundle trimmed free-exercise-db dataset"
```

---

### Task 2: Dataset access and match scoring

The one non-trivial algorithm in the feature. Pure functions, no React, no storage.

**Files:**
- Create: `src/utils/exerciseDb.ts`
- Test: `src/utils/exerciseDb.test.ts`

**Interfaces:**
- Consumes: `EXERCISES`, `CanonicalExercise` from `src/data/exercises.ts` (Task 1).
- Produces:
  ```ts
  export const AUTO_ACCEPT_SCORE = 0.85;
  export const SUGGEST_SCORE = 0.5;
  export const normalizeTokens: (name: string) => string[];
  export const diceScore: (a: string[], b: string[]) => number;
  export interface ExerciseCandidate { exercise: CanonicalExercise; score: number }
  export interface MatchResult {
    status: "confident" | "uncertain";
    candidates: ExerciseCandidate[];  // best first, max 3
  }
  export const matchExercise: (name: string) => MatchResult;
  export const searchExercises: (query: string, limit?: number) => CanonicalExercise[];
  export const getExerciseById: (id: string) => CanonicalExercise | undefined;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/utils/exerciseDb.test.ts`:

```ts
import {
  normalizeTokens,
  diceScore,
  matchExercise,
  searchExercises,
  getExerciseById,
  AUTO_ACCEPT_SCORE,
} from "./exerciseDb";

describe("normalizeTokens", () => {
  it("lowercases, strips punctuation and splits on whitespace", () => {
    expect(normalizeTokens("Barbell Bench-Press!")).toEqual([
      "barbell",
      "bench",
      "press",
    ]);
  });

  it("expands gym abbreviations into their full tokens", () => {
    expect(normalizeTokens("DB Incline Press")).toEqual([
      "dumbbell",
      "incline",
      "press",
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
    const result = matchExercise("Barbell Bench Press");
    expect(result.status).toBe("confident");
    expect(result.candidates[0].exercise.name).toBe("Barbell Bench Press");
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(AUTO_ACCEPT_SCORE);
  });

  it("resolves an abbreviation that edit distance alone would miss", () => {
    const result = matchExercise("BB Bench Press");
    expect(result.candidates[0].exercise.name).toBe("Barbell Bench Press");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/exerciseDb.test.ts`
Expected: FAIL — cannot find module `./exerciseDb`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/exerciseDb.ts`:

```ts
import { EXERCISES, type CanonicalExercise } from "../data/exercises";

export const AUTO_ACCEPT_SCORE = 0.85;
export const SUGGEST_SCORE = 0.5;

const MAX_CANDIDATES = 3;

const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
  gm: "good morning",
  ez: "e z curl bar",
};

export const normalizeTokens = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => (ABBREVIATIONS[token] ?? token).split(" "));

export const diceScore = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap += 1;
  return (2 * overlap) / (setA.size + setB.size);
};

const tokenIndex = EXERCISES.map((exercise) => ({
  exercise,
  tokens: normalizeTokens(exercise.name),
}));

export interface ExerciseCandidate {
  exercise: CanonicalExercise;
  score: number;
}

export interface MatchResult {
  status: "confident" | "uncertain";
  candidates: ExerciseCandidate[];
}

export const matchExercise = (name: string): MatchResult => {
  const tokens = normalizeTokens(name);
  if (tokens.length === 0) return { status: "uncertain", candidates: [] };

  const candidates = tokenIndex
    .map(({ exercise, tokens: dbTokens }) => ({
      exercise,
      score: diceScore(tokens, dbTokens),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.length - b.exercise.name.length)
    .slice(0, MAX_CANDIDATES);

  const best = candidates[0];
  return {
    status: best && best.score >= AUTO_ACCEPT_SCORE ? "confident" : "uncertain",
    candidates: best && best.score >= SUGGEST_SCORE ? candidates : [],
  };
};

export const searchExercises = (
  query: string,
  limit = 8,
): CanonicalExercise[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return EXERCISES.filter((exercise) =>
    exercise.name.toLowerCase().includes(trimmed),
  ).slice(0, limit);
};

const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export const getExerciseById = (id: string): CanonicalExercise | undefined =>
  byId.get(id);
```

Note the shorter-name tiebreaker in the sort: without it, "Bench Press" would rank equally against every longer name containing the same tokens, and ordering would depend on dataset order.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/exerciseDb.test.ts`
Expected: PASS. If `matchExercise("Incline Press")` comes back `confident`, the thresholds need raising — report it rather than loosening the test, since auto-accepting an ambiguous name is the exact failure this feature exists to prevent.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exerciseDb.ts src/utils/exerciseDb.test.ts
git commit -m "feat: add exercise database matching"
```

---

### Task 3: Add exerciseId to the data model

Types only. Nothing reads the field yet, so this cannot break behaviour.

**Files:**
- Modify: `src/shared/types.ts:13-27`
- Modify: `src/features/plan/types.ts:4-22`

**Interfaces:**
- Consumes: nothing.
- Produces: an optional `exerciseId?: string` on `Exercise`, `ExerciseWithSets`, `ExerciseDraft`, and on the inline exercise shape in `WdDay`.

- [ ] **Step 1: Add the field to the shared types**

In `src/shared/types.ts`:

```ts
export interface Exercise {
  name: string
  /** Canonical free-exercise-db id. Absent means a custom exercise. */
  exerciseId?: string
  muscleGroup?: string
  sets: number
}

export interface ExerciseWithSets {
  name: string
  exerciseId?: string
  muscleGroup: string
  setsByPerson: Record<string, number>
}
```

- [ ] **Step 2: Add the field to the plan types**

In `src/features/plan/types.ts`:

```ts
export interface ExerciseDraft {
  name: string;
  exerciseId?: string;
  muscleGroup: string;
  setsByPerson: Record<string, string>;
}

export interface WdDay {
  dayNumber?: number;
  dayTitle?: string;
  exercises?: Array<{
    name?: string;
    exerciseId?: string;
    muscleGroup?: string;
    setsByPerson?: Record<string, number>;
  }>;
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass. The field is optional, so every existing construction site stays valid.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/features/plan/types.ts
git commit -m "feat: add optional exerciseId to exercise types"
```

---

### Task 4: Database-backed suggestions in the Plan screen

`SuggestionsBox` already renders a `meta` line per item, so this changes the *source* of suggestions rather than adding a picker component.

**Files:**
- Modify: `src/features/plan/PlanScreen.tsx:555` (suggestion source), `:167` (state type)
- Modify: `src/features/plan/components/ExerciseEditBlock.tsx:14,88-93`
- Modify: `src/features/plan/components/ProgramDayCard.tsx:25,131`, `src/features/plan/components/DayEditForm.tsx:12`

**Interfaces:**
- Consumes: `searchExercises`, `getExerciseById` from `src/utils/exerciseDb` (Task 2); `ExerciseDraft.exerciseId` (Task 3).
- Produces: a suggestion item shape shared by Tasks 4 and 5:
  ```ts
  export interface ExerciseSuggestion { id: string; label: string; meta: string }
  ```
  Define it in `src/utils/exerciseDb.ts` alongside:
  ```ts
  export const toSuggestions: (query: string, limit?: number) => ExerciseSuggestion[];
  ```

- [ ] **Step 1: Write the failing test**

Append to `src/utils/exerciseDb.test.ts`:

```ts
import { toSuggestions } from "./exerciseDb";

describe("toSuggestions", () => {
  it("labels with the name and describes muscle and equipment in meta", () => {
    const [first] = toSuggestions("barbell bench press", 1);
    expect(first.label).toBe("Barbell Bench Press");
    expect(first.meta).toContain("chest");
    expect(first.meta).toContain("barbell");
  });

  it("omits equipment from meta when the exercise has none", () => {
    const noEquipment = toSuggestions("push", 20).find((s) => !s.meta.includes("·"));
    expect(noEquipment?.meta).not.toContain("·");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/exerciseDb.test.ts -t toSuggestions`
Expected: FAIL — `toSuggestions` is not a function.

- [ ] **Step 3: Implement toSuggestions**

Append to `src/utils/exerciseDb.ts`:

```ts
export interface ExerciseSuggestion {
  id: string;
  label: string;
  meta: string;
}

export const toSuggestions = (
  query: string,
  limit = 8,
): ExerciseSuggestion[] =>
  searchExercises(query, limit).map((exercise) => ({
    id: exercise.id,
    label: exercise.name,
    meta: [exercise.primaryMuscles.join(", "), exercise.equipment]
      .filter(Boolean)
      .join(" · "),
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/exerciseDb.test.ts`
Expected: PASS.

- [ ] **Step 5: Change the Plan screen's suggestion source**

In `src/features/plan/PlanScreen.tsx`, the handler at line 555 currently builds name suggestions from `getAllExerciseNames(workoutData, selectedSplit)`. Replace that source with `toSuggestions(value)` and widen the `nameSuggestions` state (line 167) from `Record<number, string[]>` to `Record<number, ExerciseSuggestion[]>`.

Leave the `muscleGroup` suggestion path exactly as it is — it still serves unmatched custom exercises.

- [ ] **Step 6: Set exerciseId when a suggestion is chosen**

`onApplySuggestion` currently takes `(exIdx, field, value)`. Add an optional id so choosing a database suggestion records it:

```ts
onApplySuggestion: (
  exIdx: number,
  field: "name" | "muscleGroup",
  value: string,
  exerciseId?: string,
) => void;
```

In the PlanScreen implementation, when `field === "name"`, set `exerciseId` on the draft — to the passed id, or to `undefined` when the user typed a name freely rather than picking a suggestion. Typing after picking must clear the id, otherwise the draft claims a match it no longer has.

- [ ] **Step 7: Pass the type through the component chain**

Update the `nameSuggestions` prop type from `string[]` to `ExerciseSuggestion[]` in `ExerciseEditBlock.tsx` (line 14), `ProgramDayCard.tsx` (line 25), and `DayEditForm.tsx` (line 12). In `ExerciseEditBlock.tsx` lines 88-93, pass the meta through and forward the id:

```tsx
{showNameSuggestions && (
  <SuggestionsBox
    items={nameSuggestions.map((s) => ({ label: s.label, meta: s.meta }))}
    onSelect={(label) =>
      onApplySuggestion(
        exIdx,
        "name",
        label,
        nameSuggestions.find((s) => s.label === label)?.id,
      )
    }
  />
)}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass. Then run the app (`npm run android`), open the Plan screen, edit a day, and type "bench" into an exercise name — suggestions should come from the database with a muscle/equipment line, not from names already in your plan.

- [ ] **Step 9: Commit**

```bash
git add src/utils/exerciseDb.ts src/utils/exerciseDb.test.ts src/features/plan/
git commit -m "feat: source plan exercise suggestions from the database"
```

---

### Task 5: Database-backed suggestions in the Workout screen

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx:174` (state), `:392,406` (add-exercise typo checks), `:1757-1760` (rendering)

**Interfaces:**
- Consumes: `toSuggestions`, `ExerciseSuggestion` from `src/utils/exerciseDb` (Task 4).
- Produces: nothing new.

- [ ] **Step 1: Widen the suggestion state**

At `WorkoutScreen.tsx:174`, change `useState<SimilarityMatch[]>([])` to `useState<ExerciseSuggestion[]>([])`.

- [ ] **Step 2: Change the add-exercise suggestion source**

At lines 392 and 406, the add-new-exercise flow calls `checkForTypo(name, allExerciseNames)` and shows its suggestions. Replace the *suggestion source* for the add-exercise input with `toSuggestions(name)`.

Leave the `checkForTypo` calls at lines 762 and 931 alone — those are a different flow (renaming within an active session against plan-local names) and are not in scope.

- [ ] **Step 3: Record the id on the new exercise**

When the user picks a suggestion for a new exercise, set `exerciseId` on the object passed to `addExercise`. When they type a name and add it without picking, leave `exerciseId` undefined — a custom exercise is valid.

- [ ] **Step 4: Update the rendering**

At lines 1757-1760, the suggestions are mapped from `SimilarityMatch`. Map from `ExerciseSuggestion` instead, showing `s.label` and `s.meta`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass. In the app, start a workout, tap "Add New Exercise", type "curl" — database suggestions with muscle/equipment should appear.

- [ ] **Step 6: Commit**

```bash
git add src/features/workout/WorkoutScreen.tsx
git commit -m "feat: source workout exercise suggestions from the database"
```

---

### Task 6: Match on import, review the uncertain ones

**Files:**
- Create: `src/features/plan/utils/matchProgram.ts`
- Test: `src/features/plan/utils/matchProgram.test.ts`
- Create: `src/features/plan/components/MatchReviewModal.tsx`
- Modify: `src/features/plan/PlanScreen.tsx` (show the modal after import)

**Interfaces:**
- Consumes: `matchExercise`, `toSuggestions`, `ExerciseSuggestion` from `src/utils/exerciseDb` (Tasks 2, 4); `WorkoutData` from `@shared/types`.
- Produces:
  ```ts
  export interface UnresolvedExercise {
    dayNumber: number;
    person: string;
    exerciseIndex: number;
    name: string;
    candidates: ExerciseCandidate[];
  }
  export interface MatchProgramResult {
    program: WorkoutData;          // confident matches applied
    unresolved: UnresolvedExercise[];
  }
  export const matchProgram: (program: WorkoutData) => MatchProgramResult;
  export const applyResolution: (
    program: WorkoutData,
    target: UnresolvedExercise,
    exerciseId: string | null,   // null = keep as custom
  ) => WorkoutData;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/plan/utils/matchProgram.test.ts`:

```ts
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
    expect(program.days[0].split.A.exercises[0]).not.toHaveProperty("exerciseId");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/plan/utils/matchProgram.test.ts`
Expected: FAIL — cannot find module `./matchProgram`.

- [ ] **Step 3: Implement matchProgram**

Create `src/features/plan/utils/matchProgram.ts`:

```ts
import type { WorkoutData } from "@shared/types";
import { matchExercise, type ExerciseCandidate } from "@utils/exerciseDb";

export interface UnresolvedExercise {
  dayNumber: number;
  person: string;
  exerciseIndex: number;
  name: string;
  candidates: ExerciseCandidate[];
}

export interface MatchProgramResult {
  program: WorkoutData;
  unresolved: UnresolvedExercise[];
}

export const matchProgram = (program: WorkoutData): MatchProgramResult => {
  const cloned = structuredClone(program);
  const unresolved: UnresolvedExercise[] = [];

  cloned.days?.forEach((day, dayIdx) => {
    const dayNumber = day.dayNumber ?? dayIdx + 1;
    Object.entries(day.split ?? {}).forEach(([person, personWorkout]) => {
      personWorkout?.exercises?.forEach((exercise, exerciseIndex) => {
        if (exercise.exerciseId || !exercise.name) return;
        const { status, candidates } = matchExercise(exercise.name);
        if (status === "confident") {
          exercise.exerciseId = candidates[0].exercise.id;
          return;
        }
        unresolved.push({
          dayNumber,
          person,
          exerciseIndex,
          name: exercise.name,
          candidates,
        });
      });
    });
  });

  return { program: cloned, unresolved };
};

export const applyResolution = (
  program: WorkoutData,
  target: UnresolvedExercise,
  exerciseId: string | null,
): WorkoutData => {
  const cloned = structuredClone(program);
  if (exerciseId === null) return cloned;

  const day = cloned.days?.find(
    (d, idx) => (d.dayNumber ?? idx + 1) === target.dayNumber,
  );
  const exercise =
    day?.split?.[target.person]?.exercises?.[target.exerciseIndex];
  if (exercise) exercise.exerciseId = exerciseId;

  return cloned;
};
```

The `if (exercise.exerciseId || !exercise.name) return;` guard is what makes this safe to rerun, which Task 7 depends on. Without it, Task 7's banner nags forever.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/plan/utils/matchProgram.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Build the review modal**

Create `src/features/plan/components/MatchReviewModal.tsx` using the existing modal shell — `import ModalSheet from "@shared/components/ModalSheet"` (default export) — and `SuggestionsBox` from `@shared/components/SuggestionsBox` (named export). Do not build a new modal shell. It takes `unresolved: UnresolvedExercise[]` and renders one row per entry: the user's original name, its candidates via `SuggestionsBox`, a `TextInput` that feeds `toSuggestions` for searching when no candidate fits, and a "Keep as custom" button calling back with `null`.

It lists all unresolved exercises in one screen. Do not open one modal per exercise.

- [ ] **Step 6: Wire it into import**

In `PlanScreen.tsx`, after a program is imported and parsed, run `matchProgram`, save the returned `program`, and open `MatchReviewModal` when `unresolved` is non-empty. Each resolution calls `applyResolution` and saves.

Dismissing the modal is allowed and leaves those exercises custom — the user is never blocked from using their program.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass. In the app, import a program containing a mix of standard and personal exercise names; only the ambiguous ones should appear for review.

- [ ] **Step 8: Commit**

```bash
git add src/features/plan/
git commit -m "feat: match imported programs against the exercise database"
```

---

### Task 7: Lazy migration of existing plans

**Files:**
- Modify: `src/features/plan/PlanScreen.tsx` (on-load matching pass)

**Interfaces:**
- Consumes: `matchProgram`, `applyResolution`, `MatchReviewModal` (Task 6).
- Produces: nothing new.

- [ ] **Step 1: Run the matcher when a plan loads**

Where `PlanScreen` loads the saved program, run `matchProgram` on it. Because Task 6 Step 3 skips exercises that already have an `exerciseId`, this is a no-op for already-migrated plans and costs one pass over a handful of exercises otherwise.

If confident matches were applied, save the updated program.

- [ ] **Step 2: Prompt once, non-blocking**

When `unresolved` is non-empty, show a single dismissible banner — "Review N exercises" — that opens `MatchReviewModal`. Do not auto-open the modal on load, and do not block rendering the plan.

- [ ] **Step 3: Verify the no-op case**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass. In the app, open a plan, resolve the prompt, then reopen the plan — no banner should reappear. If it does, the "skip exercises that already have an id" guard is missing and the banner will nag forever.

- [ ] **Step 4: Commit**

```bash
git add src/features/plan/PlanScreen.tsx
git commit -m "feat: lazily match existing plans against the exercise database"
```

---

### Task 8: Server-side endpoint spec

`/api/program/exercise/{rename,add,sets}` existing as endpoints means the server parses the plan into rows rather than storing the uploaded blob verbatim, so an unknown `exerciseId` would be dropped and matching would be lost on every device switch.

**Files:**
- Create or append: `api-requests.md` (repo root)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by other tasks. Client code already sends and expects the field.

- [ ] **Step 1: Write the spec**

Append to `api-requests.md`, per the repo convention in `CLAUDE.md` — method, path, request body, response shape, status codes:

```markdown
## Persist exerciseId on program exercises

Exercises now carry an optional canonical id from the bundled exercise
database. Without server-side persistence it is lost on every round-trip and
users are re-prompted to match on each device.

### POST /api/program/upload

`weeklyPlan.days[].split[person].exercises[]` may now include:

    "exerciseId": "Barbell_Bench_Press"   // optional string, null/absent = custom

Store it alongside name and muscleGroup. Absent or null must be stored as
NULL, not as an empty string — an empty string would falsely read as matched.

### GET /api/program

Return `exerciseId` on every exercise, `null` when unset.

### PATCH /api/program/exercise/add

The `exercise` body object may include `exerciseId`. Same nullability rule.

### PATCH /api/program/exercise/rename

Body may include `newExerciseId` (string or null). When present, overwrite
the stored id — including setting it to NULL, which is how a user converts a
matched exercise back into a custom one.

Status codes unchanged: 200 on success, 400 on a malformed body, 401 when
unauthenticated, 404 when no program is saved.
```

- [ ] **Step 2: Commit**

```bash
git add api-requests.md
git commit -m "docs: spec server persistence for exerciseId"
```

---

## Notes for the executor

- **Calibration.** `AUTO_ACCEPT_SCORE` and `SUGGEST_SCORE` are a first guess. After Task 6, import a real program and check how many exercises land in review. Far too many means raise `SUGGEST_SCORE`; anything wrongly auto-accepted means raise `AUTO_ACCEPT_SCORE`. Report the numbers rather than silently retuning.
- **Do not** add an `exerciseId` to logged sets. A set's exercise resolves through the plan, and adding it would mean a second server schema change for a consumer that does not exist yet.
- **Out of scope, deliberately:** exercise library screen, exercise detail view, muscle-group volume analytics, and upgrading `getExercisesByMuscleGroup` to query the database. Each becomes a small follow-up once this lands.
