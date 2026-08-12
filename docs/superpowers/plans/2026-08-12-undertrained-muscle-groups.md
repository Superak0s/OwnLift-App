# Undertrained Muscle Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect muscle groups that are undertrained this week (relative to the program's plan) and surface exercise suggestions on the Analytics screen and during an active workout, with user-configurable display and calculation modes.

**Architecture:** All detection logic is a pure function (`getUndertrainedMuscleGroups`) added to the existing `src/features/analytics/utils/trainingSummary.ts`, which already builds a deduped set-entry list (`buildTrainingSetEntries`) from live sessions + locally-completed days and aggregates it (`aggregateTrainingSummary`). No new data model, no server calls. Two new persisted settings (display mode, calculation mode) live in `storage.tsx`'s existing key/value store and are read directly (no context) by the Analytics and Workout screens. The Analytics surface is a small card inside the already-wired `TrainingSummaryTab.tsx` (rendered when the Analytics screen's "Training Summary" focus mode is active — this supersedes the original spec's plan to add a widget-registry entry, since that tab is the actual, already-wired home for weekly aggregate data). The Workout surface reuses the existing swap-suggestion chip pattern and a new `PriorityMuscleGroupBadge` component modeled on the existing `PartnerExerciseMatchBadge`.

**Tech Stack:** React Native + Expo, TypeScript, Jest (unit tests for the new pure logic only — this codebase has no React Testing Library / component-test infra, so UI tasks are verified manually per existing convention).

## Global Constraints

- No new dependencies. No new data model. No server/`on`/`off` service changes — this is pure client-side aggregation over already-loaded `sessions`/`completedDays`/`workoutData`.
- Muscle group matching stays exact, case-insensitive string match (via `normalizeExerciseName`) — no fuzzy matching, consistent with `getExercisesByMuscleGroup`.
- Undertrained threshold: a muscle group is undertrained if `avgCompletion% - itsCompletion% > 25` (percentage points), where the average is taken over muscle groups with a nonzero target.
- Settings: `undertrainedDisplayMode` ∈ `"banner" | "per_exercise" | "both" | "off"`, default `"per_exercise"`. `undertrainedCalculationMode` ∈ `"days_done" | "full_split"`, default `"days_done"`. Both persisted via `storage.tsx` under new `STORAGE_KEYS` entries.
- Per-exercise reorder is display-order-only: the underlying `exercises` array and every `exerciseIndex`-keyed handler must remain untouched — only the rendered order of `ExerciseCard`s changes.

---

## Task 1: Carry `dayNumber` on `TrainingSetEntry`

**Files:**
- Modify: `src/features/analytics/utils/trainingSummary.ts`
- Test: `src/features/analytics/utils/trainingSummary.test.ts`

**Interfaces:**
- Produces: `TrainingSetEntry` now includes `dayNumber: number`, consumed by Task 2's `getUndertrainedMuscleGroups`.

**Context:** `buildTrainingSetEntries` already tracks `dayNumber` internally on its `RawSetEntry` type (used for the server/local dedup key) but strips it out in the final `.map()` before returning `TrainingSetEntry[]`. `getUndertrainedMuscleGroups` (Task 2) needs to know which `WorkoutDay`s were actually logged this week, which requires `dayNumber` on the public type.

- [ ] **Step 1: Update the failing test to expect `dayNumber` on entries**

In `src/features/analytics/utils/trainingSummary.test.ts`, the `aggregateTrainingSummary` describe block's `entries` array (lines 61-67) constructs `TrainingSetEntry[]` literals without `dayNumber`. Add a new test that exercises `buildTrainingSetEntries` directly (currently untested — only `getPeriodDateRange` and `aggregateTrainingSummary` have tests) to confirm `dayNumber` comes through:

```ts
import {
  getPeriodDateRange,
  aggregateTrainingSummary,
  buildTrainingSetEntries,
  type TrainingSetEntry,
} from "./trainingSummary";
import type { WorkoutData } from "@shared/types";

describe("buildTrainingSetEntries", () => {
  it("carries dayNumber through from completedDays", () => {
    const workoutData: WorkoutData = {
      days: [
        {
          dayNumber: 1,
          split: {
            solo: {
              totalSets: 3,
              exercises: [{ name: "Bench Press", muscleGroup: "Chest", sets: 3 }],
            },
          },
        },
      ],
    };
    const completedDays = {
      1: { 0: { 0: { weight: 60, reps: 8, completedAt: "2026-08-11T10:00:00", note: "", isWarmup: false } } },
    };
    const entries = buildTrainingSetEntries([], workoutData, "solo", completedDays);
    expect(entries).toHaveLength(1);
    expect(entries[0].dayNumber).toBe(1);
  });
});
```

Also add `dayNumber: 1` to each object literal in the existing `entries` array (lines 62-66 of the current file) so the file still type-checks once `dayNumber` becomes required.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts -t "carries dayNumber"`
Expected: FAIL — `entries[0].dayNumber` is `undefined` (the field doesn't exist on the returned objects yet), or a TypeScript error if `tsc` runs first (`entries[0].dayNumber` doesn't exist on type `TrainingSetEntry`).

- [ ] **Step 3: Add `dayNumber` to the public type and stop stripping it**

In `src/features/analytics/utils/trainingSummary.ts`:

```ts
export interface TrainingSetEntry {
  date: Date;
  exerciseName: string;
  muscleGroup: string | null;
  weight: number;
  reps: number;
  dayNumber: number;
}
```

And change the final return of `buildTrainingSetEntries` (currently line 189):

```ts
return Array.from(seen.values()).map(
  ({ date, exerciseName, muscleGroup, weight, reps, dayNumber }) => ({
    date,
    exerciseName,
    muscleGroup,
    weight,
    reps,
    dayNumber,
  }),
);
```

(`RawSetEntry extends TrainingSetEntry` already carries `dayNumber`, so no other change is needed there.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors (confirms `TrainingSummaryTab.tsx`'s use of `TrainingSetEntry` still compiles with the added required field, since it only ever receives objects from `buildTrainingSetEntries`).

- [ ] **Step 6: Commit**

```bash
git add src/features/analytics/utils/trainingSummary.ts src/features/analytics/utils/trainingSummary.test.ts
git commit -m "feat(analytics): carry dayNumber on TrainingSetEntry"
```

---

## Task 2: `getUndertrainedMuscleGroups` aggregation function

**Files:**
- Modify: `src/features/analytics/utils/trainingSummary.ts`
- Test: `src/features/analytics/utils/trainingSummary.test.ts`

**Interfaces:**
- Consumes: `TrainingSetEntry[]` (with `dayNumber`, from Task 1), `WorkoutData` / `WorkoutDay` / `Exercise` (from `@shared/types` — `Exercise { name, muscleGroup?, sets }`, `WorkoutDay { dayNumber, split: Record<string, PersonWorkout> }`, `PersonWorkout { exercises: Exercise[], totalSets }`), `getPeriodDateRange` (existing, Task-1-file).
- Produces:
  ```ts
  export type UndertrainedCalculationMode = "days_done" | "full_split";

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
    calculationMode: UndertrainedCalculationMode,
  ): UndertrainedGroup[]
  ```
  Consumed by Task 5 (`TrainingSummaryTab.tsx`) and Task 7 (`WorkoutScreen.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to `src/features/analytics/utils/trainingSummary.test.ts`:

```ts
import { getUndertrainedMuscleGroups } from "./trainingSummary";

describe("getUndertrainedMuscleGroups", () => {
  const now = new Date("2026-08-12T15:30:00"); // Wednesday, week = Mon Aug 10 - now

  const workoutData: WorkoutData = {
    days: [
      {
        dayNumber: 1,
        split: {
          solo: {
            totalSets: 6,
            exercises: [
              { name: "Bench Press", muscleGroup: "Chest", sets: 3 },
              { name: "Lat Pulldown", muscleGroup: "Back", sets: 3 },
            ],
          },
        },
      },
      {
        dayNumber: 2,
        split: {
          solo: {
            totalSets: 3,
            exercises: [{ name: "Squat", muscleGroup: "Legs", sets: 3 }],
          },
        },
      },
    ],
  };

  const makeEntry = (
    overrides: Partial<TrainingSetEntry>,
  ): TrainingSetEntry => ({
    date: new Date("2026-08-11T10:00:00"),
    exerciseName: "Bench Press",
    muscleGroup: "Chest",
    weight: 60,
    reps: 8,
    dayNumber: 1,
    ...overrides,
  });

  it("days_done mode: only counts target from days that were actually logged this week", () => {
    // Day 1 fully logged (3 Chest sets of 3 planned, 0 of 3 planned Back sets
    // -> Chest 100%, Back 0%). Day 2 (Legs) never logged this week, so its
    // target/actual are excluded entirely under days_done.
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
    ];
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "days_done",
    );
    const groups = result.map((r) => r.muscleGroup);
    expect(groups).not.toContain("Legs"); // day 2 not logged this week -> excluded
    const back = result.find((r) => r.muscleGroup === "Back");
    expect(back?.targetSets).toBe(3); // day 1's planned Back target still counted
    expect(back?.actualSets).toBe(0);
    expect(back?.completionPct).toBe(0);
    expect(back?.deltaFromAvg).toBeGreaterThan(25); // avg of Chest(100%) and Back(0%) = 50; 50-0=50
    const chest = result.find((r) => r.muscleGroup === "Chest");
    expect(chest?.deltaFromAvg).toBeLessThanOrEqual(0);
  });

  it("full_split mode: includes every day's target regardless of what was logged", () => {
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
    ];
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "full_split",
    );
    const groups = result.map((r) => r.muscleGroup);
    expect(groups).toContain("Legs"); // day 2's target counted even though unlogged
    const legs = result.find((r) => r.muscleGroup === "Legs");
    expect(legs?.targetSets).toBe(3);
    expect(legs?.actualSets).toBe(0);
  });

  it("sorts most-undertrained first and excludes groups under the 25-point delta", () => {
    const entries: TrainingSetEntry[] = [
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Bench Press", muscleGroup: "Chest", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
      makeEntry({ exerciseName: "Lat Pulldown", muscleGroup: "Back", dayNumber: 1 }),
    ];
    // Both muscle groups fully logged (100% each) -> avg 100, delta 0 for both -> neither undertrained.
    const result = getUndertrainedMuscleGroups(
      entries,
      workoutData,
      "solo",
      now,
      "days_done",
    );
    expect(result.every((r) => r.deltaFromAvg <= 25)).toBe(true);
  });

  it("returns an empty array when no days have been logged this week (days_done mode)", () => {
    const result = getUndertrainedMuscleGroups(
      [],
      workoutData,
      "solo",
      now,
      "days_done",
    );
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts -t "getUndertrainedMuscleGroups"`
Expected: FAIL — `getUndertrainedMuscleGroups is not a function` / import error.

- [ ] **Step 3: Implement `getUndertrainedMuscleGroups`**

Add to `src/features/analytics/utils/trainingSummary.ts` (after `aggregateTrainingSummary`):

```ts
export type UndertrainedCalculationMode = "days_done" | "full_split";

export interface UndertrainedGroup {
  muscleGroup: string;
  actualSets: number;
  targetSets: number;
  completionPct: number;
  deltaFromAvg: number;
}

const UNDERTRAINED_DELTA_THRESHOLD = 25;

function sumPlannedSetsByMuscleGroup(
  days: WorkoutData["days"],
  selectedSplit: string,
): Map<string, number> {
  const targets = new Map<string, number>();
  days.forEach((day) => {
    const exercises = day.split?.[selectedSplit]?.exercises ?? [];
    exercises.forEach((exercise) => {
      if (!exercise.muscleGroup?.trim()) return;
      const group = exercise.muscleGroup.trim();
      targets.set(group, (targets.get(group) ?? 0) + exercise.sets);
    });
  });
  return targets;
}

export function getUndertrainedMuscleGroups(
  entries: TrainingSetEntry[],
  workoutData: WorkoutData | null | undefined,
  selectedSplit: string | null,
  now: Date,
  calculationMode: UndertrainedCalculationMode,
): UndertrainedGroup[] {
  if (!workoutData?.days || !selectedSplit) return [];

  const weekRange = getPeriodDateRange("week", null, now);
  const weekEntries = entries.filter(
    (entry) =>
      entry.date.getTime() >= weekRange.start.getTime() &&
      entry.date.getTime() <= weekRange.end.getTime(),
  );

  let targetDays = workoutData.days;
  if (calculationMode === "days_done") {
    const loggedDayNumbers = new Set(weekEntries.map((e) => e.dayNumber));
    targetDays = workoutData.days.filter((day) =>
      loggedDayNumbers.has(day.dayNumber),
    );
  }
  if (targetDays.length === 0) return [];

  const targets = sumPlannedSetsByMuscleGroup(targetDays, selectedSplit);
  if (targets.size === 0) return [];

  const actuals = new Map<string, number>();
  weekEntries.forEach((entry) => {
    const group = (entry.muscleGroup ?? "").trim();
    if (!group || !targets.has(group)) return;
    actuals.set(group, (actuals.get(group) ?? 0) + 1);
  });

  const rows = Array.from(targets.entries()).map(([muscleGroup, targetSets]) => {
    const actualSets = actuals.get(muscleGroup) ?? 0;
    const completionPct = targetSets > 0 ? (actualSets / targetSets) * 100 : 0;
    return { muscleGroup, actualSets, targetSets, completionPct };
  });

  const avgCompletion =
    rows.reduce((sum, r) => sum + r.completionPct, 0) / rows.length;

  return rows
    .map((row) => ({ ...row, deltaFromAvg: avgCompletion - row.completionPct }))
    .filter((row) => row.deltaFromAvg > UNDERTRAINED_DELTA_THRESHOLD)
    .sort((a, b) => b.deltaFromAvg - a.deltaFromAvg);
}
```

Note: `getUndertrainedMuscleGroups` only returns rows that clear the threshold (matches "Result sorted by delta descending" + "flagged" language in the spec — callers just take `result[0]` for "the top undertrained group", and an empty array means "nothing undertrained").

Add the `WorkoutData` type import at the top of the file if not already present (it already is, per line 1: `import type { WorkoutData, SetTiming } from "@shared/types";`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/analytics/utils/trainingSummary.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/analytics/utils/trainingSummary.ts src/features/analytics/utils/trainingSummary.test.ts
git commit -m "feat(analytics): add getUndertrainedMuscleGroups aggregation"
```

---

## Task 3: Persisted settings — storage keys + Settings screen UI

**Files:**
- Modify: `src/shared/services/storage.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`

**Interfaces:**
- Produces: `STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE` (`"undertrainedDisplayMode"`), `STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE` (`"undertrainedCalculationMode"`) — string storage keys consumed by Task 5 (Analytics) and Task 7 (Workout) via `loadFromStorage`/`saveToStorage`.
- Values stored as plain strings (not JSON): `"banner" | "per_exercise" | "both" | "off"` and `"days_done" | "full_split"`.

- [ ] **Step 1: Add the two storage keys**

In `src/shared/services/storage.tsx`, add to the `STORAGE_KEYS` object (after `SEARCH_TAB_WIDGETS`):

```ts
  UNDERTRAINED_DISPLAY_MODE: "undertrainedDisplayMode",
  UNDERTRAINED_CALCULATION_MODE: "undertrainedCalculationMode",
```

- [ ] **Step 2: Add local state + load/save effects in `SettingsScreen.tsx`**

Near the other `useState` declarations in `SettingsScreen.tsx` (around line 92-108), add:

```tsx
const [undertrainedDisplayMode, setUndertrainedDisplayMode] = useState<
  "banner" | "per_exercise" | "both" | "off"
>("per_exercise");
const [undertrainedCalculationMode, setUndertrainedCalculationMode] =
  useState<"days_done" | "full_split">("days_done");
```

Find the existing settings-load `useEffect` (the one that loads `useManualTime`/`timeBetweenSets`/etc. from storage — search for `loadFromStorage(STORAGE_KEYS.USE_MANUAL_TIME` or similar in this file) and add alongside it:

```tsx
useEffect(() => {
  (async () => {
    const displayMode = await loadFromStorage<string>(
      STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE,
      userId,
      false,
    );
    if (displayMode) {
      setUndertrainedDisplayMode(
        displayMode as "banner" | "per_exercise" | "both" | "off",
      );
    }
    const calcMode = await loadFromStorage<string>(
      STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE,
      userId,
      false,
    );
    if (calcMode) {
      setUndertrainedCalculationMode(calcMode as "days_done" | "full_split");
    }
  })();
}, [userId]);

const handleSetUndertrainedDisplayMode = (
  mode: "banner" | "per_exercise" | "both" | "off",
) => {
  setUndertrainedDisplayMode(mode);
  void saveToStorage(STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE, mode, userId);
};

const handleSetUndertrainedCalculationMode = (
  mode: "days_done" | "full_split",
) => {
  setUndertrainedCalculationMode(mode);
  void saveToStorage(STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE, mode, userId);
};
```

(`loadFromStorage`'s third arg `parse` must be `false` here since these are stored as plain strings, not JSON — matching how `saveToStorage(key, mode, userId)` with a string `mode` writes it directly per `storage.tsx`'s `typeof value === "string" ? value : JSON.stringify(value)` logic.)

Check the file for the actual variable name holding the current user id (likely `user?.id` — confirm against the existing `useManualTime`-loading effect's use of `userId` in this file) and use that same identifier instead of assuming a bare `userId` exists.

- [ ] **Step 3: Add the "Training Balance" section UI**

In the `activeTab === "general"` block, insert a new section directly after the "Workout Timing" card's closing `</View>` and its `helperText`, before the `🎨 Appearance` section title (around line 930-931):

```tsx
<Text style={styles.sectionTitle}>💪 Training Balance</Text>
<View style={styles.card}>
  <View style={styles.settingRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.settingLabel}>Show undertrained suggestions</Text>
      <Text style={styles.settingDescription}>
        How to surface exercise suggestions for muscle groups behind this week
      </Text>
    </View>
  </View>
  <View style={styles.periodRow}>
    {(
      [
        { key: "per_exercise", label: "Per-exercise" },
        { key: "banner", label: "Banner" },
        { key: "both", label: "Both" },
        { key: "off", label: "Off" },
      ] as const
    ).map((option) => (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.periodChip,
          undertrainedDisplayMode === option.key && styles.periodChipActive,
        ]}
        onPress={() => handleSetUndertrainedDisplayMode(option.key)}
      >
        <Text
          style={[
            styles.periodChipText,
            undertrainedDisplayMode === option.key &&
              styles.periodChipTextActive,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
  <View style={styles.divider} />
  <View style={styles.settingRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.settingLabel}>Compare against</Text>
      <Text style={styles.settingDescription}>
        {undertrainedCalculationMode === "days_done"
          ? "Only days you've logged this week"
          : "Your full split cycle, regardless of what's logged"}
      </Text>
    </View>
  </View>
  <View style={styles.periodRow}>
    {(
      [
        { key: "days_done", label: "Days done" },
        { key: "full_split", label: "Full split" },
      ] as const
    ).map((option) => (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.periodChip,
          undertrainedCalculationMode === option.key &&
            styles.periodChipActive,
        ]}
        onPress={() => handleSetUndertrainedCalculationMode(option.key)}
      >
        <Text
          style={[
            styles.periodChipText,
            undertrainedCalculationMode === option.key &&
              styles.periodChipTextActive,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
```

This reuses `styles.settingRow`/`styles.settingLabel`/`styles.settingDescription`/`styles.divider` (already defined in this file) plus `styles.periodRow`/`styles.periodChip`/`styles.periodChipActive`/`styles.periodChipText`/`styles.periodChipTextActive`, which don't yet exist in `SettingsScreen.tsx`'s stylesheet — add them (copy verbatim from `TrainingSummaryTab.tsx`'s `makeStyles`, lines 270-282):

```ts
periodRow: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 4 },
periodChip: {
  flex: 1,
  paddingVertical: 8,
  borderRadius: 8,
  alignItems: "center",
  backgroundColor: colors.background,
  borderWidth: 1,
  borderColor: colors.surfaceBorder,
},
periodChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
periodChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
periodChipTextActive: { color: colors.surface },
```

(Use `colors.background` instead of `colors.surface` for the chip's inactive background here, since this section's chips sit inside a `styles.card` that's already `colors.surface` — check the `card` style's `backgroundColor` in this file's `makeStyles` and pick whichever token gives visible contrast against it, adjusting if `colors.background` isn't distinct enough.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 5: Manual verification**

Run: `npm run android` (or use an already-running dev build). Open Settings → General tab → confirm the "Training Balance" section appears below "Workout Timing", defaults show "Per-exercise" and "Days done" selected, tapping other chips updates the selection and persists across an app reload (force-close and reopen).

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/storage.tsx src/features/settings/SettingsScreen.tsx
git commit -m "feat(settings): add Training Balance display/calculation mode settings"
```

---

## Task 4: `PriorityMuscleGroupBadge` component

**Files:**
- Modify: `src/features/workout/components/PartnerBadges.tsx`

**Interfaces:**
- Produces: `PriorityMuscleGroupBadge({ muscleGroup }: { muscleGroup: string })` — a React component, consumed by Task 6 (`ExerciseCard.tsx`).

**Context:** This file already exports small badge components (`PartnerExercisePill`, `PartnerExerciseMatchBadge`) rendered inside `ExerciseCard`. Adding the new badge here (rather than a new file) follows the existing pattern of grouping small exercise-card badges together.

- [ ] **Step 1: Add the component**

Append to `src/features/workout/components/PartnerBadges.tsx`:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// Badge for exercises targeting this week's most undertrained muscle group
// ─────────────────────────────────────────────────────────────────────────────
export function PriorityMuscleGroupBadge({
  muscleGroup,
}: Readonly<{ muscleGroup: string }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        matchStyles.badge,
        { backgroundColor: colors.warningLight, borderColor: "#fcd34d" },
      ]}
    >
      <Text style={[matchStyles.setsText, { color: "#92400e" }]}>
        💪 Priority — {muscleGroup} is behind this week
      </Text>
    </View>
  );
}
```

(Reuses `matchStyles.badge`/`matchStyles.setsText`, already defined at the bottom of this file, and the same warning color pair `PartnerExerciseMatchBadge` uses for its positive-diff case.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/workout/components/PartnerBadges.tsx
git commit -m "feat(workout): add PriorityMuscleGroupBadge component"
```

---

## Task 5: Wire the badge into `ExerciseCard`

**Files:**
- Modify: `src/features/workout/components/ExerciseCard.tsx`

**Interfaces:**
- Consumes: `PriorityMuscleGroupBadge` (Task 4).
- Produces: `ExerciseCard` accepts a new optional prop `isPriorityMuscleGroup?: boolean`, consumed by Task 7 (`WorkoutScreen.tsx`).

- [ ] **Step 1: Add the prop**

In `src/features/workout/components/ExerciseCard.tsx`, add to the props interface (near `exercise`/`exerciseIndex`, around line 69-70):

```ts
isPriorityMuscleGroup?: boolean;
```

And to the destructured props in the component signature (around line 200), add `isPriorityMuscleGroup = false,`.

- [ ] **Step 2: Import and render the badge**

Add the import alongside the existing `PartnerExercisePill`/`PartnerExerciseMatchBadge` import at the top of the file:

```ts
import { PriorityMuscleGroupBadge } from "./PartnerBadges";
```

(Check the existing import line for `PartnerExercisePill`/`PartnerExerciseMatchBadge` and add `PriorityMuscleGroupBadge` to the same import statement rather than a new one.)

Render it right after the existing `partnerMatchesByName && !partnerOnThis && ...` badge block (around line 233-238):

```tsx
{isPriorityMuscleGroup && exercise.muscleGroup && (
  <PriorityMuscleGroupBadge muscleGroup={exercise.muscleGroup} />
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors (the prop is optional, so existing callers of `ExerciseCard` that don't pass it are unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/features/workout/components/ExerciseCard.tsx
git commit -m "feat(workout): wire PriorityMuscleGroupBadge into ExerciseCard"
```

---

## Task 6: Analytics — undertrained summary in `TrainingSummaryTab.tsx`

**Files:**
- Modify: `src/features/analytics/components/TrainingSummaryTab.tsx`

**Interfaces:**
- Consumes: `getUndertrainedMuscleGroups` + `UndertrainedGroup` (Task 2), `loadFromStorage`/`STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE` (Task 3).

**Context:** `TrainingSummaryTab.tsx` already computes `allSetEntries` via `buildTrainingSetEntries(sessions, workoutData, selectedSplit, completedDays)` (line 72-75) and has `workoutData`/`selectedSplit` as props. This task adds a small card above the existing period/metric controls showing the single most-undertrained muscle group for the current week, independent of whatever `summaryPeriod` the user has selected for the rest of the tab (the undertrained calculation is always "this week").

- [ ] **Step 1: Load the calculation-mode setting**

Add near the other `useState` hooks in `TrainingSummaryTab.tsx` (after line 68):

```tsx
const [calculationMode, setCalculationMode] = useState<
  "days_done" | "full_split"
>("days_done");

useEffect(() => {
  (async () => {
    const mode = await loadFromStorage<string>(
      STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE,
      null,
      false,
    );
    if (mode) setCalculationMode(mode as "days_done" | "full_split");
  })();
}, []);
```

Add the needed imports at the top:

```ts
import { useState as useStateAlreadyImported } from "react"; // no-op note: `useState` is already imported on line 1 alongside `useMemo`; just add `useEffect` to that same import
import { loadFromStorage, STORAGE_KEYS } from "@shared/services/storage";
import {
  buildTrainingSetEntries,
  getPeriodDateRange,
  aggregateTrainingSummary,
  getUndertrainedMuscleGroups,
  type SummaryPeriod,
  type DateRange,
} from "../utils/trainingSummary";
```

Concretely: change line 1's `import React, { useMemo, useState } from "react";` to `import React, { useEffect, useMemo, useState } from "react";`, add the `loadFromStorage`/`STORAGE_KEYS` import, and add `getUndertrainedMuscleGroups` to the existing `../utils/trainingSummary` import (do not add the placeholder `useStateAlreadyImported` line above — that was illustrative only, not real code to insert).

- [ ] **Step 2: Compute the undertrained result**

Add after the existing `trainingSummary` `useMemo` (around line 82-85):

```tsx
const undertrainedGroups = useMemo(
  () =>
    getUndertrainedMuscleGroups(
      allSetEntries,
      workoutData,
      selectedSplit,
      new Date(),
      calculationMode,
    ),
  [allSetEntries, workoutData, selectedSplit, calculationMode],
);
const topUndertrained = undertrainedGroups[0] ?? null;
```

- [ ] **Step 3: Render the card**

Insert directly above the existing `<View style={styles.periodRow}>` block (the first thing in the returned `ScrollView`, around line 157):

```tsx
{topUndertrained && (
  <View style={styles.undertrainedCard}>
    <Text style={styles.undertrainedTitle}>
      💪 {topUndertrained.muscleGroup} is behind this week
    </Text>
    <Text style={styles.undertrainedSubtitle}>
      {Math.round(topUndertrained.deltaFromAvg)} points below average —{" "}
      {topUndertrained.actualSets} of {topUndertrained.targetSets} planned sets
    </Text>
  </View>
)}
```

Add the two new styles to `makeStyles` (near `periodRow`):

```ts
undertrainedCard: {
  backgroundColor: colors.warningLight,
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#fcd34d",
},
undertrainedTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
undertrainedSubtitle: { fontSize: 12, color: "#92400e", marginTop: 2 },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 5: Manual verification**

Run the app, log some sets this week concentrated on one muscle group over another (or use existing test data), open Analytics → Training Summary tab, confirm the card appears when a group qualifies as undertrained and is absent otherwise.

- [ ] **Step 6: Commit**

```bash
git add src/features/analytics/components/TrainingSummaryTab.tsx
git commit -m "feat(analytics): show most-undertrained muscle group in Training Summary"
```

---

## Task 7: Workout screen — banner and per-exercise reorder/badge

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `getUndertrainedMuscleGroups`/`UndertrainedGroup` (Task 2), `getExercisesByMuscleGroup` (already imported in this file), `loadFromStorage`/`STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE`/`STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE` (Task 3), `PriorityMuscleGroupBadge` via `ExerciseCard`'s `isPriorityMuscleGroup` prop (Task 5).

**Context:** `WorkoutScreen.tsx` already destructures `workoutData`, `selectedSplit`, `currentDay`, `completedDays` from `useWorkout()` (lines 84-108) but not `hasActiveSession`; it renders `dayWorkout.exercises` in a `.map()` at line 1257-1284, passing `exerciseIndex` straight through to every handler. This task (a) computes this week's top undertrained group using `completedDays` as the entries source (no `sessions` fetch — `WorkoutContext` already tracks `completedDays` across all days locally, which is what `buildTrainingSetEntries` needs when called with an empty `sessions` array), (b) renders a dismissible banner when the display mode calls for it, and (c) reorders + badges the exercise list when the display mode calls for that.

- [ ] **Step 1: Destructure `hasActiveSession` and load the two settings**

In the `useWorkout()` destructure (around line 84-108), add `hasActiveSession,` to the list.

Add new local state near the other settings-like state (e.g. near `restReminderEnabled`, around line 187-193):

```tsx
const [undertrainedDisplayMode, setUndertrainedDisplayMode] = useState<
  "banner" | "per_exercise" | "both" | "off"
>("per_exercise");
const [undertrainedCalculationMode, setUndertrainedCalculationMode] =
  useState<"days_done" | "full_split">("days_done");
const [dismissedUndertrainedBanner, setDismissedUndertrainedBanner] =
  useState<boolean>(false);
```

Add a `useEffect` to load the two persisted settings once on mount:

```tsx
useEffect(() => {
  (async () => {
    const displayMode = await loadFromStorage<string>(
      STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE,
      user?.id ?? null,
      false,
    );
    if (displayMode) {
      setUndertrainedDisplayMode(
        displayMode as "banner" | "per_exercise" | "both" | "off",
      );
    }
    const calcMode = await loadFromStorage<string>(
      STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE,
      user?.id ?? null,
      false,
    );
    if (calcMode) {
      setUndertrainedCalculationMode(calcMode as "days_done" | "full_split");
    }
  })();
}, [user?.id]);
```

(`loadFromStorage`, `STORAGE_KEYS`, and `useEffect` are already imported in this file.)

- [ ] **Step 2: Compute the top undertrained group and candidate exercises**

Add near the existing `swapSuggestions` `useMemo` (around line 237-248), after `buildTrainingSetEntries`/`getUndertrainedMuscleGroups` are imported:

Add to the existing `../analytics/utils/trainingSummary`-style import — actually this file doesn't currently import from `trainingSummary.ts`, so add a new import:

```ts
import {
  buildTrainingSetEntries,
  getUndertrainedMuscleGroups,
} from "../analytics/utils/trainingSummary";
```

Then:

```tsx
const undertrainedEntries = useMemo(
  () => buildTrainingSetEntries([], workoutData, selectedSplit, completedDays),
  [workoutData, selectedSplit, completedDays],
);

const topUndertrainedGroup = useMemo(() => {
  if (undertrainedDisplayMode === "off" || !hasActiveSession()) return null;
  const groups = getUndertrainedMuscleGroups(
    undertrainedEntries,
    workoutData,
    selectedSplit,
    new Date(),
    undertrainedCalculationMode,
  );
  return groups[0] ?? null;
}, [
  undertrainedDisplayMode,
  hasActiveSession,
  undertrainedEntries,
  workoutData,
  selectedSplit,
  undertrainedCalculationMode,
]);

const undertrainedCandidates = useMemo(
  () =>
    topUndertrainedGroup
      ? getExercisesByMuscleGroup(
          workoutData,
          selectedSplit,
          topUndertrainedGroup.muscleGroup,
        )
      : [],
  [topUndertrainedGroup, workoutData, selectedSplit],
);

const showUndertrainedBanner =
  (undertrainedDisplayMode === "banner" || undertrainedDisplayMode === "both") &&
  !dismissedUndertrainedBanner &&
  !!topUndertrainedGroup &&
  undertrainedCandidates.length > 0;

const showUndertrainedPerExercise =
  undertrainedDisplayMode === "per_exercise" || undertrainedDisplayMode === "both";
```

- [ ] **Step 3: Add the banner tap handler**

Near `handleAddNewExercise` (around line 772-784):

```tsx
const handlePickUndertrainedSuggestion = (name: string) => {
  if (!topUndertrainedGroup) return;
  setNewExercise({
    name,
    muscleGroup: topUndertrainedGroup.muscleGroup,
    sets: "",
  });
  setShowAddExerciseModal(true);
};
```

- [ ] **Step 4: Render the banner**

Insert directly above the `((dayWorkout as any)?.exercises as any[]).map(...)` block (around line 1257), inside the same `ScrollView`:

```tsx
{showUndertrainedBanner && topUndertrainedGroup && (
  <View style={styles.suggestionsContainer}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={styles.suggestionsTitle}>
        💪 {topUndertrainedGroup.muscleGroup} is behind this week — try:
      </Text>
      <TouchableOpacity onPress={() => setDismissedUndertrainedBanner(true)} hitSlop={8}>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>✕</Text>
      </TouchableOpacity>
    </View>
    {undertrainedCandidates.map((name) => (
      <TouchableOpacity
        key={name}
        style={styles.suggestionButton}
        onPress={() => handlePickUndertrainedSuggestion(name)}
      >
        <Text>{name}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

Check the existing `swapSuggestions` render block (around line 1641-1660) for the exact `styles.suggestionsTitle`/`styles.suggestionButton` JSX shape (e.g. whether the button text has its own dedicated style like `styles.suggestionButtonText`) and match it exactly rather than inventing new inline styles — the snippet above is illustrative of structure, not a literal copy-paste.

- [ ] **Step 5: Reorder + badge the exercise list**

Replace the exercise-list `.map()` (lines 1257-1284) with a version that sorts a copy of `{exercise, originalIndex}` pairs when `showUndertrainedPerExercise` is true, but always passes `originalIndex` through as `exerciseIndex`:

```tsx
{(() => {
  const exercises = ((dayWorkout as any)?.exercises as any[]) ?? [];
  const indexed = exercises.map((exercise, originalIndex) => ({
    exercise,
    originalIndex,
  }));
  const isPriority = (exercise: any): boolean =>
    showUndertrainedPerExercise &&
    !!topUndertrainedGroup &&
    !!exercise.muscleGroup &&
    normalizeExerciseName(exercise.muscleGroup) ===
      normalizeExerciseName(topUndertrainedGroup.muscleGroup);
  const ordered = showUndertrainedPerExercise
    ? [...indexed].sort((a, b) => {
        const aPriority = isPriority(a.exercise) ? 0 : 1;
        const bPriority = isPriority(b.exercise) ? 0 : 1;
        return aPriority - bPriority;
      })
    : indexed;
  return ordered.map(({ exercise, originalIndex }) => (
    <ExerciseCard
      key={exercise.name || originalIndex}
      exercise={exercise}
      exerciseIndex={originalIndex}
      isPriorityMuscleGroup={isPriority(exercise)}
      currentDay={currentDay}
      isCurrentDayLocked={isCurrentDayLocked}
      colors={colors}
      styles={styles}
      weightUnit={weightUnit}
      isInJointSession={isInJointSession}
      partnerNameSet={partnerNameSet}
      partnerProgress={partnerProgress as Record<string, unknown> | null}
      partnerParticipant={partnerParticipant}
      partnerCompletedSets={partnerCompletedSets}
      partnerUsername={partnerUsername}
      getExerciseCompletedSets={getExerciseCompletedSets}
      isSetComplete={isSetComplete}
      getSetDetails={getSetDetails}
      isAssistedExercise={isAssistedExercise}
      onEditExerciseName={handleEditExerciseName}
      onSetPress={handleSetPress}
      onQuickAddSet={handleQuickAddSet}
      onAddMultipleSets={handleAddMultipleSets}
    />
  ));
})()}
```

`Array.prototype.sort` is stable in the JS engines this app targets (Hermes/V8), so exercises within the same priority bucket keep their original relative order — no explicit tiebreaker needed. `normalizeExerciseName` is already imported in this file.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 7: Manual verification**

Run the app with default settings (`per_exercise` + `days_done`): start a session on a day whose split includes an undertrained muscle group's exercises → confirm those `ExerciseCard`s show the priority badge and sort first, and that logging/editing/deleting a set still targets the correct exercise after reordering (spot-check by logging a set on a reordered card and confirming it lands on the right exercise). Switch Settings → Training Balance → Banner → confirm the badge/reorder disappear and the banner with chips appears instead; tap a chip → confirm the Add Exercise modal opens pre-filled with the right name and muscle group. Switch to Both, then Off, and confirm both surfaces show/hide accordingly. Switch Calculation mode to Full split with a muscle group whose day hasn't been logged yet this week → confirm it now shows up as a candidate where it didn't under Days done.

- [ ] **Step 8: Commit**

```bash
git add src/features/workout/WorkoutScreen.tsx
git commit -m "feat(workout): add undertrained muscle group banner and per-exercise priority"
```

---

## Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the new `trainingSummary.test.ts` cases.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Re-run the manual verification checklist end-to-end**

Walk through Task 3 Step 5, Task 6 Step 5, and Task 7 Step 7's manual checks in one pass on a running dev build, since earlier steps verified each in isolation as it was built — confirm nothing regressed once all pieces are combined (e.g. changing a setting in Settings and immediately returning to an in-progress Workout session reflects correctly next time the screen mounts).

- [ ] **Step 4: Final commit if anything was fixed during verification**

```bash
git add -A
git commit -m "fix: address issues found during undertrained-muscle-groups verification pass"
```

(Skip this commit if verification found nothing to fix.)
