# Exercise Swap Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Workout screen's "Edit Exercise" modal, show suggestions of other exercises from the user's own plan that share the same muscle group, so the user can quickly swap in a similar exercise.

**Architecture:** One pure helper function added to `src/utils/exerciseMatching.tsx` (matching the existing `getAllExerciseNames`/`getAllMuscleGroups` pattern), consumed by a `useMemo` and a new JSX block in `src/features/workout/WorkoutScreen.tsx`'s existing Edit Exercise modal. No new state, storage, or API calls — everything is derived from `workoutData` already loaded in the screen.

**Tech Stack:** React Native / TypeScript, Jest for the helper's unit test.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-08-12-exercise-swap-suggestions-design.md`.
- Muscle-group matching is exact, case-insensitive string match only — no fuzzy matching between different muscle-group labels (e.g. "Back" vs "Upper Back" do not cross-suggest).
- Suggestions are sourced only from the current `selectedSplit`'s exercises across all days in `workoutData` (same scope `getAllExerciseNames` already uses) — never from a server call or bundled catalog.
- No changes to the Plan screen or any other screen.

---

### Task 1: `getExercisesByMuscleGroup` helper

**Files:**
- Modify: `src/utils/exerciseMatching.tsx`
- Test: `src/utils/exerciseMatching.test.ts` (new file)

**Interfaces:**
- Consumes: `WorkoutData` type from `@shared/types` (already imported in this file); `normalizeExerciseName` (already defined in this file, line ~156).
- Produces: `getExercisesByMuscleGroup(workoutData, selectedSplit, muscleGroup, excludeName?) => string[]`, exported from `src/utils/exerciseMatching.tsx`, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/utils/exerciseMatching.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/exerciseMatching.test.ts`
Expected: FAIL — `getExercisesByMuscleGroup` is not exported from `./exerciseMatching`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/utils/exerciseMatching.tsx`, directly below `getAllMuscleGroups` (after line 113):

```ts
/**
 * Find exercise names from the plan that share a muscle group, for
 * swap-suggestion UI. Excludes a given exercise name (case-insensitive).
 */
export const getExercisesByMuscleGroup = (
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  muscleGroup: string,
  excludeName?: string,
): string[] => {
  const names = new Set<string>();

  if (!workoutData?.days || !selectedSplit || !muscleGroup?.trim()) return [];

  const normalizedGroup = normalizeExerciseName(muscleGroup);
  const excludedName = excludeName
    ? normalizeExerciseName(excludeName)
    : null;

  workoutData.days.forEach((day) => {
    const personWorkout = day.split?.[selectedSplit];
    personWorkout?.exercises?.forEach((exercise) => {
      if (!exercise.name || !exercise.muscleGroup) return;
      if (normalizeExerciseName(exercise.muscleGroup) !== normalizedGroup) {
        return;
      }
      if (
        excludedName &&
        normalizeExerciseName(exercise.name) === excludedName
      ) {
        return;
      }
      names.add(exercise.name.trim());
    });
  });

  return Array.from(names);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/exerciseMatching.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exerciseMatching.tsx src/utils/exerciseMatching.test.ts
git commit -m "feat(workout): add getExercisesByMuscleGroup helper for swap suggestions"
```

---

### Task 2: Wire swap suggestions into the Edit Exercise modal

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `getExercisesByMuscleGroup` from Task 1 (`@utils/exerciseMatching`); existing state `editingExercise`, `newMuscleGroup`, `newExerciseName`, `workoutData`, `selectedSplit`, `setNewExerciseName` (all already defined in this file); existing styles `styles.suggestionsContainer`, `styles.suggestionsTitle`, `styles.suggestionButton`, `styles.suggestionText` (defined ~line 2367).
- Produces: no new exports — this is the UI leaf consuming Task 1's helper.

- [ ] **Step 1: Import the helper**

In `src/features/workout/WorkoutScreen.tsx`, add `getExercisesByMuscleGroup` to the existing import from `@utils/exerciseMatching` (line 28-35):

```ts
import {
  getAllExerciseNames,
  getAllMuscleGroups,
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
  normalizeExerciseName,
  getExercisesByMuscleGroup,
} from "@utils/exerciseMatching";
```

- [ ] **Step 2: Compute swap suggestions**

Add near the other derived values, directly below the `allMuscleGroups` line (line 235):

```ts
const swapSuggestions = useMemo(
  () =>
    editingExercise
      ? getExercisesByMuscleGroup(
          workoutData,
          selectedSplit,
          newMuscleGroup,
          editingExercise.exercise.name,
        )
      : [],
  [workoutData, selectedSplit, newMuscleGroup, editingExercise],
);
```

- [ ] **Step 3: Render the suggestions in the Edit Exercise modal**

In the Edit Exercise modal (around line 1610, directly after the Muscle Group `nameSuggestions`/typo block and before the "Save Changes" button at line 1628), add:

```tsx
{swapSuggestions.length > 0 && (
  <View style={styles.suggestionsContainer}>
    <Text style={styles.suggestionsTitle}>
      🔄 Swap for similar exercise:
    </Text>
    {swapSuggestions.map((name) => (
      <TouchableOpacity
        key={name}
        style={styles.suggestionButton}
        onPress={() => setNewExerciseName(name)}
      >
        <Text style={styles.suggestionText}>{name}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run: `npm run android` (or `npm start` and open on a connected device/emulator)

- Open a workout day with at least two exercises sharing a muscle group (e.g. two "Chest" exercises).
- Tap the edit affordance on one of them to open "Edit Exercise".
- Confirm the "🔄 Swap for similar exercise" section appears listing the other same-muscle-group exercise(s), and the exercise being edited itself is not listed.
- Tap a suggestion, confirm it fills the Exercise Name field.
- Edit the Muscle Group field to a group with no other matches (e.g. "Legs" if nothing else is tagged "Legs"), confirm the swap section disappears.
- Press "Save Changes" and confirm the edit applies as before (unchanged existing behavior).

- [ ] **Step 6: Commit**

```bash
git add src/features/workout/WorkoutScreen.tsx
git commit -m "feat(workout): suggest same-muscle-group exercises when editing an exercise"
```
