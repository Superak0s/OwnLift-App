# Training Summary Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Training Summary" widget to the Analytics screen that breaks down sets/volume by muscle group and by exercise over a selectable time period, and let the existing exercise selector widget also select a muscle group.

**Architecture:** Pure client-side aggregation over data already loaded on the Analytics screen (`sessions` + `completedDays`) — no service/API changes, works identically online/offline. A new pure TS module computes the aggregation and is unit-tested with Jest; the two widget-UI changes live in the existing `ExerciseAnalytics.tsx` monolith, following its existing render-function-per-widget-type pattern, and are verified manually (no RN component-test tooling exists in this repo — see Task 3/4 verification notes).

**Tech Stack:** React Native / Expo, TypeScript, `react-native-chart-kit` via the existing `ProgressChart` wrapper, `jest`/`jest-expo` (already configured, no test files currently exist in the repo).

## Global Constraints

- No new npm dependencies — no date-picker library, no RN component-testing library. Reuse `UniversalCalendar` (already in `src/shared/components/`) for custom-range date selection.
- No changes to `src/features/*/services/on/` or `off/` — this is pure client-side aggregation over data the Analytics screen already loads.
- Selecting a muscle group in the renamed selector widget must NOT change what `set_data`, `workout_history`, `weight_progress`, `volume_progress`, or `reps_progress` display — those stay exercise-only and keep their existing empty state when the selection is a muscle group.
- New widget type `training_summary` is `large`-size only, `singleton: true`, and is added to `DEFAULT_ANALYTICS_WIDGETS`.
- Time periods are calendar-aligned, not rolling windows: **Today** = start–end of the current calendar day; **This Week** = Monday of the current week through end of today; **This Month** = the 1st of the current calendar month through end of today; **Custom** = user-picked start/end days (inclusive, full days).
- Volume for the summary = `weight × reps` per set, summed. (Unlike the existing per-exercise `computeVolume` in `ExerciseAnalytics.tsx`, this does NOT apply the assisted-exercise `(bodyWeight - weight) × reps` adjustment — flagged as a deliberate simplification below.)

---

## File Structure

- **Create** `src/features/analytics/utils/trainingSummary.ts` — pure aggregation functions: period → date range, and flat set-entries → grouped summary. No RN imports, fully unit-testable.
- **Create** `src/features/analytics/utils/trainingSummary.test.ts` — Jest tests for the above.
- **Modify** `src/features/analytics/widgets.ts` — rename `select_exercise` → `select_focus`, add `training_summary` widget type/definition/default instance.
- **Modify** `src/features/analytics/components/ExerciseAnalytics.tsx` — mode toggle (Exercise / Muscle Group) on the renamed selector widget; new Training Summary widget render function (period chips, custom-range modal, metric toggle, muscle-group bar chart, exercise breakdown list); a flat all-exercises set-entry builder feeding `trainingSummary.ts`.

---

### Task 1: Pure aggregation utility

**Files:**
- Create: `src/features/analytics/utils/trainingSummary.ts`
- Test: `src/features/analytics/utils/trainingSummary.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure, standalone).
- Produces (used by Task 4):
  - `type SummaryPeriod = "today" | "week" | "month" | "custom"`
  - `interface DateRange { start: Date; end: Date }`
  - `interface TrainingSetEntry { date: Date; exerciseName: string; muscleGroup: string | null; weight: number; reps: number }`
  - `interface SummaryMuscleGroupRow { muscleGroup: string; sets: number; volume: number }`
  - `interface SummaryExerciseRow { exerciseName: string; muscleGroup: string | null; sets: number; volume: number }`
  - `interface TrainingSummary { muscleGroups: SummaryMuscleGroupRow[]; exercises: SummaryExerciseRow[] }`
  - `function getPeriodDateRange(period: SummaryPeriod, customRange: DateRange | null, now?: Date): DateRange`
  - `function aggregateTrainingSummary(entries: TrainingSetEntry[], range: DateRange): TrainingSummary`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/analytics/utils/trainingSummary.test.ts
import {
  getPeriodDateRange,
  aggregateTrainingSummary,
  type TrainingSetEntry,
} from "./trainingSummary";

describe("getPeriodDateRange", () => {
  const now = new Date("2026-08-12T15:30:00"); // Wednesday

  it("today spans the current calendar day", () => {
    const range = getPeriodDateRange("today", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-12T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("week spans Monday through end of today", () => {
    const range = getPeriodDateRange("week", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-10T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("month spans the 1st through end of today", () => {
    const range = getPeriodDateRange("month", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });

  it("custom uses the given range, normalized to full days", () => {
    const range = getPeriodDateRange(
      "custom",
      { start: new Date("2026-08-01T09:00:00"), end: new Date("2026-08-05T18:00:00") },
      now,
    );
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-05T23:59:59.999").toISOString());
  });

  it("custom with a reversed range swaps start and end", () => {
    const range = getPeriodDateRange(
      "custom",
      { start: new Date("2026-08-05T00:00:00"), end: new Date("2026-08-01T00:00:00") },
      now,
    );
    expect(range.start.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-05T23:59:59.999").toISOString());
  });

  it("custom with no range falls back to today", () => {
    const range = getPeriodDateRange("custom", null, now);
    expect(range.start.toISOString()).toBe(new Date("2026-08-12T00:00:00").toISOString());
    expect(range.end.toISOString()).toBe(new Date("2026-08-12T23:59:59.999").toISOString());
  });
});

describe("aggregateTrainingSummary", () => {
  const range = {
    start: new Date("2026-08-10T00:00:00"),
    end: new Date("2026-08-12T23:59:59.999"),
  };

  const entries: TrainingSetEntry[] = [
    { date: new Date("2026-08-11T10:00:00"), exerciseName: "Bench Press", muscleGroup: "Chest", weight: 60, reps: 8 },
    { date: new Date("2026-08-11T10:05:00"), exerciseName: "Bench Press", muscleGroup: "Chest", weight: 62.5, reps: 6 },
    { date: new Date("2026-08-12T09:00:00"), exerciseName: "Squat", muscleGroup: "Legs", weight: 100, reps: 5 },
    { date: new Date("2026-08-09T09:00:00"), exerciseName: "Deadlift", muscleGroup: "Back", weight: 120, reps: 5 }, // outside range
    { date: new Date("2026-08-11T11:00:00"), exerciseName: "Overhead Press", muscleGroup: null, weight: 30, reps: 10 },
  ];

  it("filters entries outside the date range", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const total = summary.exercises.reduce((sum, e) => sum + e.sets, 0);
    expect(total).toBe(4); // Deadlift excluded
  });

  it("groups sets and sums volume per muscle group", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const chest = summary.muscleGroups.find((m) => m.muscleGroup === "Chest");
    expect(chest?.sets).toBe(2);
    expect(chest?.volume).toBe(60 * 8 + 62.5 * 6);
  });

  it("buckets entries with no muscle group under Unknown", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const unknown = summary.muscleGroups.find((m) => m.muscleGroup === "Unknown");
    expect(unknown?.sets).toBe(1);
    expect(unknown?.volume).toBe(30 * 10);
  });

  it("groups sets and sums volume per exercise", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const bench = summary.exercises.find((e) => e.exerciseName === "Bench Press");
    expect(bench?.sets).toBe(2);
    expect(bench?.volume).toBe(60 * 8 + 62.5 * 6);
    expect(bench?.muscleGroup).toBe("Chest");
  });

  it("sorts both breakdowns by sets descending", () => {
    const summary = aggregateTrainingSummary(entries, range);
    const setsDesc = summary.muscleGroups.every(
      (row, i, arr) => i === 0 || arr[i - 1].sets >= row.sets,
    );
    expect(setsDesc).toBe(true);
  });

  it("returns empty arrays for no matching entries", () => {
    const summary = aggregateTrainingSummary([], range);
    expect(summary.muscleGroups).toEqual([]);
    expect(summary.exercises).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts`
Expected: FAIL — `Cannot find module './trainingSummary'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/analytics/utils/trainingSummary.ts

export type SummaryPeriod = "today" | "week" | "month" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TrainingSetEntry {
  date: Date;
  exerciseName: string;
  muscleGroup: string | null;
  weight: number;
  reps: number;
}

export interface SummaryMuscleGroupRow {
  muscleGroup: string;
  sets: number;
  volume: number;
}

export interface SummaryExerciseRow {
  exerciseName: string;
  muscleGroup: string | null;
  sets: number;
  volume: number;
}

export interface TrainingSummary {
  muscleGroups: SummaryMuscleGroupRow[];
  exercises: SummaryExerciseRow[];
}

const UNKNOWN_MUSCLE_GROUP = "Unknown";

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const startOfMonth = (date: Date): Date => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

export function getPeriodDateRange(
  period: SummaryPeriod,
  customRange: DateRange | null,
  now: Date = new Date(),
): DateRange {
  if (period === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (period === "week") return { start: startOfWeek(now), end: endOfDay(now) };
  if (period === "month") return { start: startOfMonth(now), end: endOfDay(now) };

  if (!customRange) return { start: startOfDay(now), end: endOfDay(now) };
  const [start, end] =
    customRange.start.getTime() <= customRange.end.getTime()
      ? [customRange.start, customRange.end]
      : [customRange.end, customRange.start];
  return { start: startOfDay(start), end: endOfDay(end) };
}

export function aggregateTrainingSummary(
  entries: TrainingSetEntry[],
  range: DateRange,
): TrainingSummary {
  const muscleGroupMap = new Map<string, SummaryMuscleGroupRow>();
  const exerciseMap = new Map<string, SummaryExerciseRow>();

  entries.forEach((entry) => {
    if (entry.date.getTime() < range.start.getTime() || entry.date.getTime() > range.end.getTime()) {
      return;
    }
    const volume = entry.weight * entry.reps;
    const muscleGroup = entry.muscleGroup ?? UNKNOWN_MUSCLE_GROUP;

    const muscleRow = muscleGroupMap.get(muscleGroup) ?? { muscleGroup, sets: 0, volume: 0 };
    muscleRow.sets += 1;
    muscleRow.volume += volume;
    muscleGroupMap.set(muscleGroup, muscleRow);

    const exerciseRow = exerciseMap.get(entry.exerciseName) ?? {
      exerciseName: entry.exerciseName,
      muscleGroup: entry.muscleGroup,
      sets: 0,
      volume: 0,
    };
    exerciseRow.sets += 1;
    exerciseRow.volume += volume;
    exerciseMap.set(entry.exerciseName, exerciseRow);
  });

  return {
    muscleGroups: Array.from(muscleGroupMap.values()).sort((a, b) => b.sets - a.sets),
    exercises: Array.from(exerciseMap.values()).sort((a, b) => b.sets - a.sets),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/utils/trainingSummary.ts src/features/analytics/utils/trainingSummary.test.ts
git commit -m "feat(analytics): add training summary aggregation utility"
```

---

### Task 2: Widget registry — rename selector, add Training Summary widget

**Files:**
- Modify: `src/features/analytics/widgets.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (used by Task 3 and Task 4):
  - `AnalyticsWidgetType` includes `"select_focus"` (renamed from `"select_exercise"`) and `"training_summary"` (new).
  - `ANALYTICS_WIDGET_REGISTRY.select_focus` and `.training_summary` definitions.
  - `DEFAULT_ANALYTICS_WIDGETS` includes a `training_summary` instance.

- [ ] **Step 1: Rename `select_exercise` to `select_focus` in the type union and registry**

In `src/features/analytics/widgets.ts`, change:

```typescript
export type AnalyticsWidgetType =
  | "select_exercise"
```
to
```typescript
export type AnalyticsWidgetType =
  | "select_focus"
  | "training_summary"
```

Change the `select_exercise` registry entry key and its `type`/`title`/`description` to:

```typescript
  select_focus: {
    type: "select_focus",
    title: "Select Exercise / Muscle Group",
    description: "Pick an exercise or a muscle group to analyze, with search and filters",
    icon: "🏋️",
    availableSizes: ["medium", "large"],
    defaultSize: "large",
    singleton: true,
  },
```

- [ ] **Step 2: Add the `training_summary` registry entry**

Add after `reps_progress` in `ANALYTICS_WIDGET_REGISTRY`:

```typescript
  training_summary: {
    type: "training_summary",
    title: "Training Summary",
    description: "Sets and volume broken down by muscle group and exercise for a chosen time period",
    icon: "🧮",
    availableSizes: ["large"],
    defaultSize: "large",
    singleton: true,
  },
```

- [ ] **Step 3: Update `DEFAULT_ANALYTICS_WIDGETS`**

Change the `type: "select_exercise"` default instance to `type: "select_focus"` (keep its `id`, `size`, `order` as-is). Add a new default instance:

```typescript
    {
      id: "default-training-summary",
      type: "training_summary",
      size: "large",
      order: 7,
    },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `ExerciseAnalytics.tsx` referencing `"select_exercise"` (fixed in Task 3) — confirm the only errors are in that file, not elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/widgets.ts
git commit -m "feat(analytics): rename select_exercise widget, add training_summary widget definition"
```

---

### Task 3: Selector widget — Exercise / Muscle Group mode toggle

**Files:**
- Modify: `src/features/analytics/components/ExerciseAnalytics.tsx`

**Interfaces:**
- Consumes: `AnalyticsWidgetType`, `ANALYTICS_WIDGET_REGISTRY`, `DEFAULT_ANALYTICS_WIDGETS` from Task 2 (all `select_exercise` references become `select_focus`).
- Produces (used by Task 4): a `distinctMuscleGroups: string[]` derived list (sorted, deduped, non-null) computed alongside `availableExercises`, so Task 4's exercise-breakdown list can be cross-checked against real muscle group names if needed. Not strictly required by Task 4, but keep it exported from component scope (local `useMemo`) in case reused.

- [ ] **Step 1: Replace all `"select_exercise"` references with `"select_focus"`**

In `ExerciseAnalytics.tsx`, update:
- `renderSelectExerciseWidget` → keep the function name (internal, not part of any interface) but update the `case` in `renderWidgetContent`:

```typescript
      case "select_focus":
        return renderSelectExerciseWidget();
```

- [ ] **Step 2: Add a focus-mode toggle to the selector widget**

Add state near the other `useState` calls (after `selectedExercise`):

```typescript
  const [focusMode, setFocusMode] = useState<"exercise" | "muscleGroup">("exercise");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
```

Compute the distinct muscle group list alongside `filteredExercises`:

```typescript
  const distinctMuscleGroups = useMemo(
    () =>
      Array.from(
        new Set(
          availableExercises
            .map((e) => e.muscleGroup)
            .filter((g): g is string => !!g),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [availableExercises],
  );
```

Update `renderSelectExerciseWidget` to show a two-segment toggle above the dropdown button, and change the button's label/subtext based on `focusMode`:

```typescript
  const renderSelectExerciseWidget = (): React.ReactNode => (
    <View>
      <View style={styles.focusModeToggle}>
        <TouchableOpacity
          style={[
            styles.focusModeButton,
            focusMode === "exercise" && styles.focusModeButtonActive,
          ]}
          onPress={() => setFocusMode("exercise")}
        >
          <Text
            style={[
              styles.focusModeButtonText,
              focusMode === "exercise" && styles.focusModeButtonTextActive,
            ]}
          >
            Exercise
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.focusModeButton,
            focusMode === "muscleGroup" && styles.focusModeButtonActive,
          ]}
          onPress={() => setFocusMode("muscleGroup")}
        >
          <Text
            style={[
              styles.focusModeButtonText,
              focusMode === "muscleGroup" && styles.focusModeButtonTextActive,
            ]}
          >
            Muscle Group
          </Text>
        </TouchableOpacity>
      </View>

      {selectedExercise &&
        focusMode === "exercise" &&
        selectedExerciseMeta?.name.toLowerCase().includes("assisted") &&
        !currentBodyWeight && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Body Weight Required</Text>
              <Text style={styles.warningText}>
                Body weight needed for accurate assisted exercise calculations
              </Text>
            </View>
          </View>
        )}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setShowDropdown(true)}
      >
        <View style={styles.dropdownButtonContent}>
          <View style={styles.dropdownButtonLeft}>
            <Text style={styles.dropdownButtonText}>
              {focusMode === "exercise"
                ? (selectedExercise ?? "Select an exercise")
                : (selectedMuscleGroup ?? "Select a muscle group")}
            </Text>
            {focusMode === "exercise" && selectedExercise && selectedExerciseMeta?.muscleGroup && (
              <Text style={styles.dropdownButtonSubtext}>
                {selectedExerciseMeta.muscleGroup}
              </Text>
            )}
          </View>
          <Text style={styles.dropdownArrow}>▼</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
```

- [ ] **Step 3: Branch the picker `ModalSheet` content on `focusMode`**

Wrap the existing `FlatList` (exercise list) so it only renders in exercise mode, and add a muscle-group `FlatList` for the other mode. Change the `ModalSheet` `title` prop:

```typescript
        <ModalSheet
          visible={showDropdown}
          onClose={() => {
            setShowDropdown(false);
            setSearchQuery("");
          }}
          title={focusMode === "exercise" ? "Select Exercise" : "Select Muscle Group"}
          showCancelButton={false}
          showConfirmButton={false}
        >
          {focusMode === "exercise" ? (
            <>
              <View style={styles.searchContainer}>
                {/* ...unchanged search input... */}
              </View>
              <View style={styles.filterContainer}>
                {/* ...unchanged zero-set filter... */}
              </View>
              <FlatList
                data={filteredExercises}
                {/* ...unchanged... */}
              />
            </>
          ) : (
            <FlatList
              data={distinctMuscleGroups}
              keyExtractor={(group) => group}
              style={styles.dropdownList}
              ListEmptyComponent={
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No muscle groups found</Text>
                </View>
              }
              renderItem={({ item: group }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedMuscleGroup === group && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedMuscleGroup(group);
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedMuscleGroup === group && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {group}
                  </Text>
                  {selectedMuscleGroup === group && (
                    <Text style={styles.dropdownItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </ModalSheet>
```

Note: do NOT move `searchQuery`/`showZeroSetExercises` state — they stay exercise-mode-only, unchanged from the current implementation.

- [ ] **Step 4: Add the toggle styles**

Add to `makeStyles`, near `dropdownButton`:

```typescript
    focusModeToggle: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 4,
      marginBottom: 10,
      gap: 4,
    },
    focusModeButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    focusModeButtonActive: { backgroundColor: colors.accent },
    focusModeButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    focusModeButtonTextActive: { color: colors.surface },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `select_exercise` or `select_focus` remain (other unrelated pre-existing errors, if any, are out of scope).

- [ ] **Step 6: Manual verification**

No RN component-test tooling exists in this repo (confirmed: no `@testing-library/react-native` dependency), so verify by running the app:

Run: `npm run android`

In the Analytics screen: confirm the "Select Exercise / Muscle Group" widget shows the Exercise/Muscle Group toggle, that switching to Muscle Group mode shows a list of distinct muscle groups from your logged/planned exercises, that picking one updates the button label, and that `set_data`/`workout_history`/progress-chart widgets keep showing their existing "select an exercise" empty state while a muscle group is selected.

- [ ] **Step 7: Commit**

```bash
git add src/features/analytics/components/ExerciseAnalytics.tsx
git commit -m "feat(analytics): add exercise/muscle-group toggle to selector widget"
```

---

### Task 4: Training Summary widget

**Files:**
- Modify: `src/features/analytics/components/ExerciseAnalytics.tsx`

**Interfaces:**
- Consumes:
  - From Task 1: `getPeriodDateRange`, `aggregateTrainingSummary`, `SummaryPeriod`, `DateRange`, `TrainingSetEntry`, `TrainingSummary`.
  - From Task 2: `"training_summary"` in `AnalyticsWidgetType`.
  - Existing in-file: `sessions`, `completedDays`, `workoutData`, `selectedSplit`, `resolveExerciseName` (already defined in this file), `ProgressChart`, `UniversalCalendar`, `ModalSheet`.
- Produces: nothing consumed by other tasks (this is the last task).

- [ ] **Step 1: Add a flat all-exercises set-entry builder**

Add near the other history-builder functions (after `buildHistoryFromCompletedDays`):

```typescript
  const buildAllSetEntriesFromSessions = (): TrainingSetEntry[] =>
    sessions.flatMap((session) =>
      (session.set_timings ?? []).map((timing) => ({
        date: new Date(timing.end_time ?? session.start_time ?? Date.now()),
        exerciseName: resolveExerciseName(timing, session),
        muscleGroup: timing.exercise_muscle_group ?? null,
        weight: Number.isFinite(timing.weight) ? (timing.weight as number) : 0,
        reps: Number.isFinite(timing.reps) ? (timing.reps as number) : 0,
      })),
    );

  const buildAllSetEntriesFromCompletedDays = (): TrainingSetEntry[] => {
    if (!workoutData?.days || !selectedSplit) return [];
    return Object.keys(completedDays).flatMap((dayNumberKey) => {
      const dayNumber = Number.parseInt(dayNumberKey);
      const day = workoutData.days.find((d) => d.dayNumber === dayNumber);
      const splitWorkout = day?.split?.[selectedSplit];
      if (!splitWorkout?.exercises) return [];

      return splitWorkout.exercises.flatMap((exercise, exerciseIndex) => {
        const ex = exercise as { machineName?: string; name: string; muscleGroup?: string };
        const exerciseName = ex.machineName ?? ex.name;
        const exerciseSets = completedDays[dayNumber]?.[exerciseIndex];
        if (!exerciseSets) return [];
        return Object.keys(exerciseSets)
          .filter((setIndex) => exerciseSets[Number(setIndex)])
          .map((setIndex) => {
            const setData = exerciseSets[Number(setIndex)] ?? {};
            return {
              date: new Date(setData.completedAt ?? Date.now()),
              exerciseName,
              muscleGroup: ex.muscleGroup ?? null,
              weight: Number.isFinite(setData.weight) ? (setData.weight as number) : 0,
              reps: Number.isFinite(setData.reps) ? (setData.reps as number) : 0,
            };
          });
      });
    });
  };

  const allSetEntries = useMemo(
    () => [...buildAllSetEntriesFromSessions(), ...buildAllSetEntriesFromCompletedDays()],
    [sessions, completedDays, workoutData, selectedSplit],
  );
```

Add the import at the top of the file:

```typescript
import {
  getPeriodDateRange,
  aggregateTrainingSummary,
  type SummaryPeriod,
  type DateRange,
  type TrainingSetEntry,
} from "../utils/trainingSummary";
```

- [ ] **Step 2: Add Training Summary widget state**

Add near `focusMode`/`selectedMuscleGroup`:

```typescript
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("today");
  const [summaryCustomRange, setSummaryCustomRange] = useState<DateRange | null>(null);
  const [summaryMetric, setSummaryMetric] = useState<"sets" | "volume">("sets");
  const [showSummaryRangePicker, setShowSummaryRangePicker] = useState(false);
  const [pendingRangeStart, setPendingRangeStart] = useState<Date | null>(null);
```

Compute the summary:

```typescript
  const summaryRange = useMemo(
    () => getPeriodDateRange(summaryPeriod, summaryCustomRange),
    [summaryPeriod, summaryCustomRange],
  );

  const trainingSummary = useMemo(
    () => aggregateTrainingSummary(allSetEntries, summaryRange),
    [allSetEntries, summaryRange],
  );
```

- [ ] **Step 3: Add a small fixed color palette for muscle-group bars**

Add near `PROGRESS_WIDGET_CONFIG`:

```typescript
  const MUSCLE_GROUP_BAR_COLORS = [
    "#4C6EF5", "#12B886", "#FA5252", "#FAB005", "#7950F2", "#15AABF", "#E64980", "#82C91E",
  ];
```

- [ ] **Step 4: Write the render function**

```typescript
  const handleSummaryRangeDatePress = (date: Date) => {
    if (!pendingRangeStart) {
      setPendingRangeStart(date);
      return;
    }
    setSummaryCustomRange({ start: pendingRangeStart, end: date });
    setPendingRangeStart(null);
    setShowSummaryRangePicker(false);
    setSummaryPeriod("custom");
  };

  const renderTrainingSummaryWidget = (): React.ReactNode => {
    const periodOptions: { key: SummaryPeriod; label: string }[] = [
      { key: "today", label: "Today" },
      { key: "week", label: "This Week" },
      { key: "month", label: "This Month" },
      { key: "custom", label: "Custom" },
    ];

    const muscleChartData =
      trainingSummary.muscleGroups.length > 0
        ? {
            labels: trainingSummary.muscleGroups.map((row) => row.muscleGroup),
            datasets: [
              {
                data: trainingSummary.muscleGroups.map((row) =>
                  summaryMetric === "sets" ? row.sets : Math.round(row.volume),
                ),
              },
            ],
          }
        : { labels: ["No data"], datasets: [{ data: [0] }] };

    return (
      <View>
        <View style={styles.summaryPeriodRow}>
          {periodOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.summaryPeriodChip,
                summaryPeriod === option.key && styles.summaryPeriodChipActive,
              ]}
              onPress={() => {
                if (option.key === "custom") {
                  setPendingRangeStart(null);
                  setShowSummaryRangePicker(true);
                  return;
                }
                setSummaryPeriod(option.key);
              }}
            >
              <Text
                style={[
                  styles.summaryPeriodChipText,
                  summaryPeriod === option.key && styles.summaryPeriodChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.focusModeToggle}>
          <TouchableOpacity
            style={[
              styles.focusModeButton,
              summaryMetric === "sets" && styles.focusModeButtonActive,
            ]}
            onPress={() => setSummaryMetric("sets")}
          >
            <Text
              style={[
                styles.focusModeButtonText,
                summaryMetric === "sets" && styles.focusModeButtonTextActive,
              ]}
            >
              Sets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.focusModeButton,
              summaryMetric === "volume" && styles.focusModeButtonActive,
            ]}
            onPress={() => setSummaryMetric("volume")}
          >
            <Text
              style={[
                styles.focusModeButtonText,
                summaryMetric === "volume" && styles.focusModeButtonTextActive,
              ]}
            >
              Volume
            </Text>
          </TouchableOpacity>
        </View>

        {trainingSummary.muscleGroups.length === 0 ? (
          <Text style={styles.widgetLineMuted}>
            No sets logged in this period yet.
          </Text>
        ) : (
          <>
            <ProgressChart
              title="By Muscle Group"
              data={muscleChartData}
              chartType="bar"
              chartWidth={chartWidth}
              barColors={trainingSummary.muscleGroups.map(
                (_, i) => MUSCLE_GROUP_BAR_COLORS[i % MUSCLE_GROUP_BAR_COLORS.length],
              )}
              yAxisSuffix={summaryMetric === "volume" ? "kg" : ""}
            />

            <Text style={styles.summaryListHeader}>By Exercise</Text>
            {trainingSummary.exercises.map((row) => (
              <View key={row.exerciseName} style={styles.summaryListRow}>
                <View style={styles.summaryListRowLeft}>
                  <Text style={styles.dropdownItemText}>{row.exerciseName}</Text>
                  {row.muscleGroup && (
                    <Text style={styles.dropdownItemMuscle}>{row.muscleGroup}</Text>
                  )}
                </View>
                <Text style={styles.dropdownItemSets}>
                  {summaryMetric === "sets" ? `${row.sets} sets` : `${fmt(row.volume)}kg`}
                </Text>
              </View>
            ))}
          </>
        )}

        <ModalSheet
          visible={showSummaryRangePicker}
          onClose={() => {
            setShowSummaryRangePicker(false);
            setPendingRangeStart(null);
          }}
          title={pendingRangeStart ? "Select end date" : "Select start date"}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <UniversalCalendar
            hasDataOnDate={() => false}
            onDatePress={handleSummaryRangeDatePress}
            initialView="month"
            legendText="Tap a start date, then an end date"
          />
        </ModalSheet>
      </View>
    );
  };
```

- [ ] **Step 5: Wire it into `renderWidgetContent`**

```typescript
      case "training_summary":
        return renderTrainingSummaryWidget();
```

- [ ] **Step 6: Add the new styles**

Add to `makeStyles`:

```typescript
    summaryPeriodRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
    summaryPeriodChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    summaryPeriodChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    summaryPeriodChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    summaryPeriodChipTextActive: { color: colors.surface },
    summaryListHeader: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 8,
    },
    summaryListRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    summaryListRowLeft: { flex: 1 },
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `ExerciseAnalytics.tsx` or `trainingSummary.ts`.

- [ ] **Step 8: Manual verification**

Run: `npm run android`

In the Analytics screen, confirm: the Training Summary widget appears (add it via the widget gallery if your saved layout predates this change); Today/This Week/This Month chips update both the bar chart and the exercise list; tapping Custom opens the calendar, and tapping two dates sets a custom range and switches the chip selection to "Custom"; the Sets/Volume toggle changes both the chart values and the list values; a muscle group with no data shows nothing (not a crash) when the period has zero sets.

- [ ] **Step 9: Commit**

```bash
git add src/features/analytics/components/ExerciseAnalytics.tsx
git commit -m "feat(analytics): add Training Summary widget with period and metric controls"
```

---

## Simplifications (flagged per project convention)

- Summary volume does not apply the assisted-exercise weight adjustment that per-exercise widgets use (`computeVolume` in this same file) — an assisted exercise's "volume" in the summary will read higher than its true assistance-adjusted value. Acceptable because the summary is about relative training distribution across muscle groups/exercises, not precise load tracking (that's what the existing per-exercise `set_data`/`volume_progress` widgets are for). Upgrade path if needed: thread `isAssisted`/`computeVolume` through `TrainingSetEntry` and `aggregateTrainingSummary`.
- Muscle-group bar colors are a fixed 8-color palette cycled by index, not a stable per-muscle-group color mapping — the same muscle group can get a different bar color across renders if the sort order changes (e.g., after a metric toggle). Acceptable for a bar chart with a legend-free x-axis label per bar. Upgrade path if needed: hash muscle group name to a palette index instead of using sorted array position.
