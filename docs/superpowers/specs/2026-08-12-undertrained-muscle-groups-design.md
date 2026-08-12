# Undertrained muscle group detection & live workout suggestions — design

## Problem

The app tracks sets per exercise but never compares what was actually trained this week against what the program planned. If the user skips an exercise (or a whole day gets light on a particular muscle group), nothing surfaces that imbalance — on the Analytics screen or, more usefully, while a workout is still in progress and the user could still do something about it.

## Scope

- New pure aggregation logic in `src/features/analytics/utils/trainingSummary.ts`.
- A new Analytics widget showing the week's most undertrained muscle group.
- Two new persisted settings (display mode, calculation mode — see below) in `src/features/settings`.
- A banner and/or per-exercise priority indicator on the active Workout screen (`src/features/workout/WorkoutScreen.tsx`), driven by the display-mode setting, suggesting exercises for the most undertrained muscle group and reusing the swap-suggestion chip pattern from the exercise-swap-suggestions feature (`getExercisesByMuscleGroup`, `src/utils/exerciseMatching.tsx`).

No new data model, no server changes, no exercise catalog beyond what's already in the user's plan — same constraints as the exercise-swap-suggestions design this builds on.

## Settings (new)

Two new persisted values, stored via `storage.tsx` (same key/value pattern as `appMode`), surfaced in the Settings screen under a "Training Balance" section:

### Display mode — `undertrainedDisplayMode`

- `"banner"` — top-of-screen banner only (as originally designed).
- `"per_exercise"` — **default.** No banner. Instead:
  - Any `ExerciseCard` whose muscle group matches the current top undertrained group gets a compact priority badge, e.g. "💪 Priority — behind this week."
  - Today's exercise list is re-sorted so undertrained-muscle-group exercises appear first. This is a **display-order-only** sort: the underlying `exercises` array and every existing `exerciseIndex`-keyed handler (set logging, editing, deleting) are untouched — the rendered list maps over `exercises.map((exercise, originalIndex) => ({exercise, originalIndex}))`, sorts that array of pairs, and passes `originalIndex` through as `exerciseIndex` to `ExerciseCard` and all handlers exactly as today.
- `"both"` — banner and per-exercise badge/reorder together.
- `"off"` — no computation-driven UI at all on the Workout screen (the Analytics widget, if added, still works independently).

### Calculation mode — `undertrainedCalculationMode`

- `"days_done"` — **default.** Target and actual both scoped to only the days already logged this week (see below).
- `"full_split"` — target = sum of planned sets across the *entire* split cycle (`workoutData.days`), actual = this week's logged sets, regardless of which days have occurred yet.

Both settings are read once per render via the existing `storage.tsx` get/set pattern (no context needed — same as how other simple settings are read in this codebase) and passed into `getUndertrainedMuscleGroups`.

## Definitions

**"Undertrained" is relative, not absolute.** A muscle group is undertrained if its completion% this week is more than 25 percentage points below the average completion% across all muscle groups that have a nonzero target this week. There's no fixed "you must hit 100% of plan" bar — the comparison is muscle groups against each other, so a program that's globally behind (e.g. it's Tuesday) doesn't flag everything as undertrained, only the group(s) lagging the rest.

**Target and actual are scoped according to `undertrainedCalculationMode`** (see Settings above — default `"days_done"` scopes both to days already logged this week, avoiding penalizing a muscle group whose day just hasn't come up yet in the split rotation; `"full_split"` instead targets the whole cycle regardless of what's been logged).

Concretely, for the current week (Monday → now), in `"days_done"` mode (the default):

1. Take this week's `TrainingSetEntry[]` (already produced by `buildTrainingSetEntries` in `trainingSummary.ts` — each entry carries `dayNumber`, `muscleGroup`, and `date`).
2. Collect the distinct `dayNumber`s present among those entries — the days that had a logged session this week.
3. **Target** per muscle group = sum of planned sets from only the matching `WorkoutDay` entries in `workoutData.days` (via `day.split[selectedSplit].exercises`) for those `dayNumber`s.
4. **Actual** per muscle group = sum of sets from this week's entries (unchanged from existing aggregation logic).
5. `completion% = actual / target` per muscle group (muscle groups with 0 target this week are excluded from the comparison — nothing to compare against).
6. `avgCompletion` = mean of all included groups' completion%.
7. A group is undertrained if `avgCompletion - completion% > 25`.
8. Result sorted by delta descending (most undertrained first).

If a specific exercise within an otherwise-logged day is skipped, that day's `dayNumber` is still included (other exercises from it were logged), so the skipped exercise's muscle group shows a real completion shortfall — this is how "reassess after skip" falls out of the calculation for free, no explicit skip-tracking needed.

## 1. New aggregation function — `trainingSummary.ts`

```ts
export interface UndertrainedGroup {
  muscleGroup: string;
  actualSets: number;
  targetSets: number;
  completionPct: number; // 0-100
  deltaFromAvg: number;  // positive = how far below average, in points
}

export function getUndertrainedMuscleGroups(
  entries: TrainingSetEntry[],
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  now: Date,
  calculationMode: "days_done" | "full_split",
): UndertrainedGroup[]
```

Internally: filter `entries` to the current week's range (`getPeriodDateRange("week", undefined, now)`, existing helper). In `"days_done"` mode, derive the logged `dayNumber`s and sum planned sets only from those days' `split[selectedSplit].exercises`; in `"full_split"` mode, sum planned sets across every day in `workoutData.days` regardless of what's logged. Either way, sum actual sets per muscle group from the filtered entries (same grouping `aggregateTrainingSummary` already does), then apply the completion%/average/delta steps above. Returns `[]` if there's no target data (no logged days this week in `"days_done"` mode, or an empty plan in `"full_split"` mode) or no muscle groups have a nonzero target.

## 2. Analytics widget

New widget type `undertrained_muscle_groups` in `src/features/analytics/widgets.ts` (small card, not added to `DEFAULT_ANALYTICS_WIDGETS` by default — available from the widget gallery like other non-default widgets). Renders the single most-undertrained group (first entry of `getUndertrainedMuscleGroups`'s result) as a short line, e.g. "Back is 34 points behind this week's average — 3 of 9 planned sets." Empty state ("Nothing undertrained" / "Not enough data yet") when the result is empty.

## 3. Live workout UI

In `WorkoutScreen.tsx`, while `hasActiveSession()` is true, read `undertrainedDisplayMode` and `undertrainedCalculationMode` from `storage.tsx`. If mode is `"off"`, none of the below runs. Otherwise compute `getUndertrainedMuscleGroups(entries, workoutData, selectedSplit, now, calculationMode)` and take the top result, and look up candidate exercises via the existing `getExercisesByMuscleGroup(workoutData, selectedSplit, topGroup.muscleGroup)`. If there's no top group or no candidate exercises for it, neither surface below renders.

### Banner (`"banner"` or `"both"`)

Dismissible banner above the exercise list (same visual language as the existing "🔄 Swap for similar exercise" suggestion chips): "💪 Back is behind this week — try: Lat Pulldown, Barbell Row." Each chip, when tapped, pre-fills `newExercise` (name + muscle group) and opens the existing "Add New Exercise" modal (`setShowAddExerciseModal(true)`) — the user still confirms via the modal's existing save action, no silent auto-add. Dismissing hides it for the remainder of the session (local component state, not persisted).

### Per-exercise badge + reorder (`"per_exercise"` or `"both"`)

- Any `ExerciseCard` in today's list whose `muscleGroup` case-insensitively matches `topGroup.muscleGroup` renders a compact priority badge (e.g. "💪 Priority — behind this week") — no chips here, since the exercise itself is already the suggestion.
- The rendered exercise list is sorted so matching exercises appear first: `exercises.map((exercise, originalIndex) => ({exercise, originalIndex})).sort(...)`, matching entries first, stable order preserved otherwise. `originalIndex` is passed through as `exerciseIndex` to `ExerciseCard` and every set-logging/edit/delete handler exactly as today — only the rendered order changes, not the underlying `exercises` array or any index used for persistence.

Both surfaces are derived from `entries`/`workoutData`/settings — no new event plumbing — so logging or skipping an exercise, or changing a setting, naturally updates or clears them on next render.

## Non-goals / explicitly out of scope

- No explicit "skip exercise" UI action — skips are inferred from absence of logged sets, as with the rest of the app's tracking.
- No push notifications or reminders outside the two surfaces above.
- No cross-week trends/history for the undertrained calculation — always "this week" only.
- No fuzzy muscle-group matching (same exact-case-insensitive-string constraint as `getExercisesByMuscleGroup`).
- No changes to `on/`/`off/` services — this is pure client-side aggregation over already-loaded `sessions`/`completedDays`/`workoutData`, identical online/offline.

## Testing

Manual:
- A week where one muscle group's logged days average well below the others' completion% → confirm it's flagged and the others aren't, and the Analytics widget shows it.
- Default settings (`per_exercise` + `days_done`): start a session on a day whose split includes the flagged muscle group's exercises → confirm those `ExerciseCard`s show the priority badge and sort to the top, and that set logging/edit/delete still target the correct exercise after reordering.
- Switch display mode to `banner` → confirm the badge/reorder disappear and a banner with chips appears instead; tap a chip → confirm the Add Exercise modal opens pre-filled. Switch to `both` → confirm both appear together. Switch to `off` → confirm neither appears.
- Switch calculation mode to `full_split` with a muscle group whose only planned day hasn't occurred yet this week → confirm it now factors into the comparison (unlike `days_done` mode, where it's excluded entirely).
- Skip an exercise in an otherwise-logged day → confirm that muscle group's completion% drops and, if it now crosses the 25-point delta, the banner/badge/widget picks it up on next render.
- Dismiss the banner → confirm it stays hidden for the rest of the session.
