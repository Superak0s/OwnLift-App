# Training Summary widget — design

## Problem

The Analytics screen only lets users analyze one exercise at a time (`select_exercise` widget + downstream `set_data`/`workout_history`/progress-chart widgets, all keyed off a single `selectedExercise` string in [ExerciseAnalytics.tsx](../../../src/features/analytics/components/ExerciseAnalytics.tsx)). There's no way to see a breakdown across exercises or muscle groups over a chosen time period.

## Scope

Analytics screen ([src/features/analytics/](../../../src/features/analytics/)), specifically:
- [widgets.ts](../../../src/features/analytics/widgets.ts) — widget registry/defaults
- [components/ExerciseAnalytics.tsx](../../../src/features/analytics/components/ExerciseAnalytics.tsx) — widget rendering + data logic

No changes to `on/`/`off/` services or server: aggregation is pure client-side over `sessions`/`completedDays`, already loaded on this screen, so behavior is identical online/offline without touching the dispatch layer.

## 1. Rename `select_exercise` → `select_focus`

- Widget `type` renamed `select_exercise` → `select_focus`, title "Select Exercise / Muscle Group".
- The existing dropdown button + `ModalSheet` picker gains a mode toggle: **Exercise** / **Muscle Group**. In Exercise mode, behavior is unchanged (search/filter list of exercises). In Muscle Group mode, the same modal lists distinct muscle groups (derived from the same `availableExercises` metadata already computed in `loadAvailableExercises`) instead of exercise names.
- Selecting a muscle group in this widget **only** updates this widget's own display (the button shows the chosen muscle group). It does **not** feed `set_data`, `workout_history`, `weight_progress`, `volume_progress`, or `reps_progress` — those widgets remain exercise-scoped and show their existing "select an exercise" empty state whenever the current selection is a muscle group rather than an exercise. This avoids reworking `computeStats`/`computeChartData`/the history builders to support multi-exercise aggregation.

## 2. New `training_summary` widget

New widget type `training_summary`, singleton, `large` size only, added to `DEFAULT_ANALYTICS_WIDGETS` so it shows up in fresh/reset layouts (existing users' saved layouts are unaffected — they can add it from the widget gallery).

State is independent of the Select Focus widget:

- **Time period control**: chip row — Today / This Week / This Month / Custom. Custom opens the existing `UniversalCalendar` component in a `ModalSheet` (same pattern already used for the date-sets modal in this file) for a two-tap start-date/end-date pick — no new date-picker component or dependency.
- **Metric toggle**: Sets / Volume, switching what both breakdowns below display.
- **Muscle group breakdown**: bar chart via the existing `ProgressChart` component (`chartType="bar"`, one bar per muscle group, `barColors` for per-muscle coloring — same approach `DOMSHeatmap.tsx` already uses), values = total sets or total volume per muscle group within the selected period.
- **Exercise breakdown**: a ranked list below the chart (exercise name, muscle group, sets or volume value for the period), reusing the existing `dropdownItem`-style row styling — no chart needed for this part.

## 3. Data aggregation

A new pure function in `ExerciseAnalytics.tsx` walks the same two sources the existing history builders already read — `sessions` (`buildHistoryFromSessions`'s source) and `completedDays` (`buildHistoryFromCompletedDays`'s source) — but across **all** exercises rather than one, filtered to the selected date range. For each set it resolves exercise name + muscle group the same way `addExercisesFromSessions`/`addExercisesFromWorkoutPlan` already do (`timing.exercise_muscle_group` / plan `muscleGroup` field), then groups by muscle group and by exercise, summing set counts and volume per group.

## Out of scope

- No changes to existing exercise-scoped widgets' data logic.
- No new shared date-range-picker component — the two-tap `UniversalCalendar`-in-a-modal pattern is reused as-is.
- No server/offline service changes.
