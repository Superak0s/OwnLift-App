import type { ThemeColors } from "@shared/context/ThemeContext";
import { getCanonicalName } from "@utils/exerciseMatching";

// ─── Unit helpers ─────────────────────────────────────────────────────────────
export const LBS_TO_KG = 0.45359237;
export const KG_TO_LBS = 2.20462262;

/** Convert a kg value (as stored) to the display unit, rounded to 1 dp. */
export function kgToDisplay(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return (kg * KG_TO_LBS).toFixed(1);
  }
  return kg % 1 === 0 ? String(kg) : kg.toFixed(1);
}

/** Parse a user-entered string in the chosen unit and return kg for storage. */
export function displayToKg(value: string, unit: "kg" | "lbs"): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return unit === "lbs" ? n * LBS_TO_KG : n;
}

// ─── Widget group visuals ──────────────────────────────────────────────────
// The four "day status" header widgets (day_number, total_sets, progress,
// session_stats) are fused into one seamless card outside of edit mode —
// see getWidgetContainerStyle below, which zeroes out the margin/border
// between them and rounds only the group's outer corners. Kept as a
// constant so every widget's corner radius agrees exactly.
export const WIDGET_GROUP_RADIUS = 14;

// ─── Pure helpers extracted out of WorkoutScreen ───────────────────────────
// Pulling these out as plain functions (rather than leaving the logic
// inline in the component) keeps WorkoutScreen's own Cognitive Complexity
// under the SonarQube threshold — every branch below lives in its own
// function scope instead of adding to the component's score.

export type EmptyStateInfo = { icon: string; title: string; text: string };

export function getEmptyStateInfo(
  workoutData: unknown,
  selectedSplit: string | null,
  dayWorkout: unknown,
  currentDay: number,
): EmptyStateInfo | null {
  if (!workoutData) {
    return {
      icon: "📁",
      title: "No Workout Plan",
      text: "Go to the Home tab to upload your workout file",
    };
  }
  if (!selectedSplit) {
    return {
      icon: "👤",
      title: "No Split Selected",
      text: "Go to the Plan tab to select your split",
    };
  }
  if (!dayWorkout) {
    return {
      icon: "🤷",
      title: "No Workout for This Day",
      text: `${selectedSplit} has no exercises scheduled for Day ${currentDay}`,
    };
  }
  return null;
}

export function getDayOverviewTint(
  colors: ThemeColors,
  isCurrentDayLocked: boolean,
  setsCompleteAndUnlocked: boolean,
): string {
  if (isCurrentDayLocked) return colors.textSecondary;
  return setsCompleteAndUnlocked ? colors.success : colors.accent;
}

export function computeProgressPercentage(
  completedSetsCount: number,
  totalSetsCount: number,
): number {
  return totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0;
}

export function getPullHintText(pullDistance: number): string {
  return pullDistance > 90
    ? "Release to add a widget ✨"
    : "Pull to add a widget ↓";
}

export function getWidgetContainerStyle(
  widgetEditMode: boolean,
  dayOverviewTint: string,
): { backgroundColor?: string; borderRadius?: number } {
  if (widgetEditMode) return {};
  return {
    backgroundColor: dayOverviewTint,
    borderRadius: WIDGET_GROUP_RADIUS,
  };
}

export function getAddingSetsSubtitle(
  addingSetsExercise: Record<string, unknown> | null,
): string | undefined {
  if (!addingSetsExercise) return undefined;
  const exercise = addingSetsExercise.exercise as { name: string };
  return `Adding sets to: ${exercise.name}`;
}

export function checkIsSelectedSetAssisted(
  selectedSet: { exerciseIndex: number; setIndex: number } | null,
  dayWorkout: Record<string, unknown> | null,
): boolean {
  if (!selectedSet || !dayWorkout) return false;
  const exercises = dayWorkout.exercises as Array<{ name: string }> | undefined;
  const exercise = exercises?.[selectedSet.exerciseIndex];
  if (!exercise) return false;
  return exercise.name.toLowerCase().includes("assisted");
}

// ─── Performance-history collection helpers ────────────────────────────────
// Split out of loadPerformanceHistory so no single function nests more than
// a couple of levels deep (SonarQube flagged the previous inline version
// for both excess Cognitive Complexity and >4 levels of function nesting).

export type PerformanceEntry = {
  date: Date;
  weight: number;
  reps: number;
  volume: number;
  note: string;
  isWarmup: boolean;
};

export function toPerformanceEntry(
  completedAt: string | number | Date | undefined,
  weight: number | undefined,
  reps: number | undefined,
  note: string | undefined,
  isWarmup: boolean | undefined,
): PerformanceEntry {
  const w = weight ?? 0;
  const r = reps ?? 0;
  return {
    date: new Date(completedAt ?? Date.now()),
    weight: Number.isFinite(w) ? w : 0,
    reps: Number.isFinite(r) ? r : 0,
    volume: Number.isFinite(w * r) ? w * r : 0,
    note: note || "",
    isWarmup: Boolean(isWarmup),
  };
}

export function collectSetsForExercise(
  sets:
    | Record<
        string,
        {
          weight?: number;
          reps?: number;
          completedAt?: string;
          note?: string;
          isWarmup?: boolean;
        }
      >
    | undefined,
): PerformanceEntry[] {
  if (!sets) return [];
  return Object.keys(sets).map((si) => {
    const s = sets[si];
    return toPerformanceEntry(
      s.completedAt,
      s.weight,
      s.reps,
      s.note,
      s.isWarmup,
    );
  });
}

export function getSetsForDayExercise(
  workoutData: { days: Array<Record<string, any>> } | null | undefined,
  selectedSplit: string | null,
  completedDays: Record<string, Record<number, Record<string, unknown>>>,
  dayNumber: string,
  canonicalName: string,
  allExerciseNames: string[],
): PerformanceEntry[] {
  const day = workoutData?.days.find(
    (d) => d.dayNumber === Number.parseInt(dayNumber, 10),
  );
  const pw = day && selectedSplit ? day.split[selectedSplit] : null;
  if (!pw?.exercises) return [];

  const entries: PerformanceEntry[] = [];
  pw.exercises.forEach((ex: { name: string }, exerciseIndex: number) => {
    const matches =
      getCanonicalName(ex.name, allExerciseNames).toLowerCase() ===
      canonicalName.toLowerCase();
    if (!matches) return;
    const sets = completedDays[dayNumber]?.[exerciseIndex] as
      | Record<
          string,
          {
            weight?: number;
            reps?: number;
            completedAt?: string;
            note?: string;
            isWarmup?: boolean;
          }
        >
      | undefined;
    entries.push(...collectSetsForExercise(sets));
  });
  return entries;
}

export function getLocalHistoryEntries(
  completedDays: Record<string, Record<number, Record<string, unknown>>>,
  workoutData: { days: Array<Record<string, any>> } | null | undefined,
  selectedSplit: string | null,
  canonicalName: string,
  allExerciseNames: string[],
): PerformanceEntry[] {
  return Object.keys(completedDays).flatMap((dayNumber) =>
    getSetsForDayExercise(
      workoutData,
      selectedSplit,
      completedDays,
      dayNumber,
      canonicalName,
      allExerciseNames,
    ),
  );
}

export function collectSessionTimings(
  session: any,
  exerciseName: string,
  canonicalName: string,
  allExerciseNames: string[],
): PerformanceEntry[] {
  if (!session?.set_timings) return [];
  return session.set_timings
    .filter((t: any) => {
      const timingName = t.exercise_name || exerciseName || "";
      return (
        getCanonicalName(timingName, allExerciseNames).toLowerCase() ===
        canonicalName.toLowerCase()
      );
    })
    .map((t: any) =>
      toPerformanceEntry(
        t.end_time ?? session.end_time ?? session.start_time,
        t.weight,
        t.reps,
        t.note,
        t.is_warmup,
      ),
    );
}

export async function getServerHistoryEntries(
  fetchSessionHistory: (limit: number, flag: boolean) => Promise<any[]>,
  exerciseName: string,
  canonicalName: string,
  allExerciseNames: string[],
): Promise<PerformanceEntry[]> {
  try {
    const sessions = await fetchSessionHistory(50, true);
    if (!sessions?.length) return [];
    return sessions.flatMap((session) =>
      collectSessionTimings(
        session,
        exerciseName,
        canonicalName,
        allExerciseNames,
      ),
    );
  } catch (err) {
    // ignore server lookup failures — we simply won't show history
    console.warn(
      "Failed to fetch server session history for performance:",
      err,
    );
    return [];
  }
}

export function pickBestPerformanceSummary(history: PerformanceEntry[]): {
  last: PerformanceEntry;
  best: PerformanceEntry;
  totalAttempts: number;
} | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prev = history.filter((e) => e.date < today && !e.isWarmup);
  if (!prev.length) return null;

  prev.sort((a, b) => b.date.getTime() - a.date.getTime());
  const last = prev[0];
  const best = prev.reduce((b, c) => (c.volume > b.volume ? c : b), prev[0]);
  return { last, best, totalAttempts: prev.length };
}

// ─── Partner-progress label helpers ────────────────────────────────────────
// Extracted so PartnerBanner's render body doesn't need a nested ternary
// (SonarQube typescript:S3358) — each label is resolved by its own small,
// single-purpose function instead.

export function getPartnerExerciseLabel(
  partnerProgress: Record<string, unknown> | null,
): string {
  if (!partnerProgress) return "—";
  const exerciseName = partnerProgress.exerciseName as string | undefined;
  if (exerciseName) return exerciseName;
  const exerciseIndex = partnerProgress.exerciseIndex as number | undefined;
  if (exerciseIndex != null) return `Ex ${exerciseIndex + 1}`;
  return "—";
}

export function getPartnerSetLabel(
  partnerProgress: Record<string, unknown> | null,
): string {
  const setIndex = partnerProgress?.setIndex as number | undefined;
  return setIndex == null ? "—" : `Set ${setIndex + 1}`;
}

export function getPartnerStatusText(
  isPartnerReady: boolean,
  partnerProgress: Record<string, unknown> | null,
): string {
  if (isPartnerReady) return "✅ Ready for next set";
  if (!partnerProgress) return "Waiting…";
  return `${getPartnerExerciseLabel(partnerProgress)} · ${getPartnerSetLabel(partnerProgress)}`;
}
