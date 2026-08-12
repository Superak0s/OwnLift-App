# Exercise swap suggestions — design

## Problem

When a user edits an exercise on the Workout screen (`WorkoutScreen.tsx`'s "Edit Exercise" modal), there's no way to see other exercises that target the same muscle group as a quick substitute. The user has to remember/retype a name themselves.

## Scope

Workout screen only (the "Edit Exercise" modal already used to rename an exercise + its muscle group). Not the Plan screen's day-edit form.

There is no bundled exercise catalog in this codebase — exercises are free-text, tagged with a free-text `muscleGroup` string (`src/shared/types.ts`). "Similar alternatives" are sourced from the user's own workout plan (`workoutData.days[].split[selectedSplit].exercises`), not an external database.

## Design

Reuse the existing typo-suggestion pattern (`src/utils/exerciseMatching.tsx`, "Did you mean?" boxes in the Edit Exercise modal) for a new "swap" suggestion list, filtered by muscle group instead of name similarity.

### New helper — `src/utils/exerciseMatching.tsx`

```ts
export const getExercisesByMuscleGroup = (
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  muscleGroup: string,
  excludeName?: string,
): string[]
```

Scans every day's exercises for the given split, returns deduped exercise names whose `muscleGroup` case-insensitively matches the given one, excluding `excludeName` (the exercise currently being edited).

### `WorkoutScreen.tsx` changes

- `useMemo` computing `swapSuggestions = getExercisesByMuscleGroup(workoutData, selectedSplit, newMuscleGroup, editingExercise.exercise.name)`, recomputed when `newMuscleGroup` changes (so editing the muscle group field updates suggestions live).
- New JSX block in the "Edit Exercise" modal, below the Muscle Group field, styled like the existing suggestion boxes: "🔄 Swap for similar exercise", one row per suggestion. Tapping a row sets `newExerciseName` to that name (same shape as the existing `handleSuggestionPress` for typos). User still presses "Save Changes" to commit — no auto-save on tap.
- If `swapSuggestions` is empty (no other plan exercise shares that muscle group), the section doesn't render.

### Non-goals / explicitly out of scope

- No new data model, no exercise catalog, no server calls.
- No fuzzy matching between muscle group labels (e.g. "Back" vs "Upper Back" won't cross-suggest) — exact case-insensitive string match only.
- No changes to the Plan screen.

## Testing

Manual: edit an exercise whose muscle group matches another exercise elsewhere in the plan, confirm the swap section appears and tapping a suggestion fills the name field; edit an exercise with a unique muscle group and confirm the section is absent.
