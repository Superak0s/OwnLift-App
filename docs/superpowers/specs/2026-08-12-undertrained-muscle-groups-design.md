# Undertrained muscle group detection & live workout suggestions — design

## Problem

The app tracks sets per exercise but never compares what was actually trained this week against what the program planned. If the user skips an exercise (or a whole day gets light on a particular muscle group), nothing surfaces that imbalance — on the Analytics screen or, more usefully, while a workout is still in progress and the user could still do something about it.

## Scope

- New pure aggregation logic in `src/features/analytics/utils/trainingSummary.ts`.
- A new Analytics widget showing the week's most undertrained muscle group.
- A banner on the active Workout screen (`src/features/workout/WorkoutScreen.tsx`) suggesting an exercise for the most undertrained muscle group, reusing the swap-suggestion chip pattern from the exercise-swap-suggestions feature (`getExercisesByMuscleGroup`, `src/utils/exerciseMatching.tsx`).

No new data model, no server changes, no exercise catalog beyond what's already in the user's plan — same constraints as the exercise-swap-suggestions design this builds on.

## Definitions

**"Undertrained" is relative, not absolute.** A muscle group is undertrained if its completion% this week is more than 25 percentage points below the average completion% across all muscle groups that have a nonzero target this week. There's no fixed "you must hit 100% of plan" bar — the comparison is muscle groups against each other, so a program that's globally behind (e.g. it's Tuesday) doesn't flag everything as undertrained, only the group(s) lagging the rest.

**Target and actual are both scoped to days already logged this week**, not the full split cycle. This avoids penalizing a muscle group whose day just hasn't come up yet in the split rotation (e.g. Back is only trained on Day 5, and Day 5 hasn't happened this week — Back isn't counted as undertrained just because its weekly volume is zero).

Concretely, for the current week (Monday → now):

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
): UndertrainedGroup[]
```

Internally: filter `entries` to the current week's range (`getPeriodDateRange("week", undefined, now)`, existing helper), derive the logged `dayNumber`s, sum planned sets per muscle group from those days' `split[selectedSplit].exercises`, sum actual sets per muscle group from the filtered entries (same grouping `aggregateTrainingSummary` already does), then apply the completion%/average/delta steps above. Returns `[]` if there are no logged days this week or no muscle groups have a nonzero target.

## 2. Analytics widget

New widget type `undertrained_muscle_groups` in `src/features/analytics/widgets.ts` (small card, not added to `DEFAULT_ANALYTICS_WIDGETS` by default — available from the widget gallery like other non-default widgets). Renders the single most-undertrained group (first entry of `getUndertrainedMuscleGroups`'s result) as a short line, e.g. "Back is 34 points behind this week's average — 3 of 9 planned sets." Empty state ("Nothing undertrained" / "Not enough data yet") when the result is empty.

## 3. Live workout banner

In `WorkoutScreen.tsx`, while `hasActiveSession()` is true:

- Compute `getUndertrainedMuscleGroups(entries, workoutData, selectedSplit, now)` and take the top result.
- Look up candidate exercises via the existing `getExercisesByMuscleGroup(workoutData, selectedSplit, topGroup.muscleGroup)`.
- If both a top group and at least one candidate exercise exist, render a dismissible banner above the exercise list (same visual language as the existing "🔄 Swap for similar exercise" suggestion chips): "💪 Back is behind this week — try: Lat Pulldown, Barbell Row." Each chip, when tapped, pre-fills `newExercise` (name + muscle group) and opens the existing "Add New Exercise" modal (`setShowAddExerciseModal(true)`) — the user still confirms via the modal's existing save action, no silent auto-add.
- Dismissing the banner hides it for the remainder of the session (local component state, not persisted).
- Banner recomputes automatically as sets are logged during the session — it's derived from `entries`/`workoutData`, no new event plumbing needed, so logging or skipping an exercise naturally updates or clears the suggestion.
- If there's no top group or no candidate exercises for it, the banner doesn't render.

## Non-goals / explicitly out of scope

- No explicit "skip exercise" UI action — skips are inferred from absence of logged sets, as with the rest of the app's tracking.
- No push notifications or reminders outside the two surfaces above.
- No cross-week trends/history for the undertrained calculation — always "this week" only.
- No fuzzy muscle-group matching (same exact-case-insensitive-string constraint as `getExercisesByMuscleGroup`).
- No changes to `on/`/`off/` services — this is pure client-side aggregation over already-loaded `sessions`/`completedDays`/`workoutData`, identical online/offline.

## Testing

Manual:
- A week where one muscle group's logged days average well below the others' completion% → confirm it's flagged and the others aren't, and the Analytics widget shows it.
- Start a session on a day whose split includes the flagged muscle group's exercises → confirm the banner appears with correct chips; tap a chip → confirm the Add Exercise modal opens pre-filled.
- Skip an exercise in an otherwise-logged day → confirm that muscle group's completion% drops and, if it now crosses the 25-point delta, the banner/widget picks it up on next render.
- A muscle group whose only planned day hasn't occurred yet this week → confirm it's excluded from the comparison entirely (not flagged, not included in the average).
- Dismiss the banner → confirm it stays hidden for the rest of the session.
