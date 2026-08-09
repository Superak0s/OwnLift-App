import { toDateString, formatDate } from "@utils/format";

export function isoToLocalDateStr(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return toDateString(d);
}

export function parseSafeDate(isoStr: string | null | undefined): Date | null {
  if (!isoStr) return null;
  const date = new Date(isoStr);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDateLabel(isoStr: string | null | undefined): string {
  const date = parseSafeDate(isoStr);
  return date ? formatDate(date) : "Unknown date";
}

export function buildLocalISOForDate(date: Date, timeStr = "09:00"): string {
  const dateStr = toDateString(date);
  return `${dateStr}T${timeStr}:00`;
}

export const MONTHS_TO_PREDICT = 12;

export function getCycleStartIso(entry: any): string | null {
  return (
    entry.cycleStart ??
    entry.cycle_start ??
    entry.startDate ??
    entry.started_at ??
    entry.start_date ??
    entry.date ??
    null
  );
}

export function getCycleDuration(entry: any, fallback: number = 5): number {
  const len =
    entry.duration_days ??
    entry.durationDays ??
    entry.duration ??
    entry.length ??
    entry.days ??
    fallback;
  return Number(len) || fallback;
}

export type CyclePhaseInfo = {
  phase: "Menstrual" | "Follicular" | "Ovulation" | "Luteal";
  dayOfCycle: number;
  cycleLength: number;
  periodEnd: number;
  ovulationStart: number;
  ovulationEnd: number;
};

export function getCyclePhaseInfo(
  daysSinceStart: number,
  periodLengthDays: number,
  cycleLengthDays: number,
): CyclePhaseInfo {
  const cLen = cycleLengthDays || 28;
  const pLen = Math.min(periodLengthDays || 5, cLen - 1);
  const dayOfCycle = (daysSinceStart % cLen) + 1;
  const ovulationDay = Math.max(pLen + 1, cLen - 14);
  const ovulationStart = ovulationDay - 1;
  const ovulationEnd = ovulationDay + 1;

  const phase =
    dayOfCycle <= pLen
      ? "Menstrual"
      : dayOfCycle < ovulationStart
        ? "Follicular"
        : dayOfCycle <= ovulationEnd
          ? "Ovulation"
          : "Luteal";

  return { phase, dayOfCycle, cycleLength: cLen, periodEnd: pLen, ovulationStart, ovulationEnd };
}

export function getCyclePhaseLabel(
  startIso: string | null,
  periodLengthDays: number,
  cycleLengthDays: number,
): string | null {
  const start = parseSafeDate(startIso);
  if (!start) return null;

  const start0 = new Date(start);
  start0.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - start0.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return null;

  return getCyclePhaseInfo(diffDays, periodLengthDays, cycleLengthDays).phase;
}

export function computeUpcomingPredictedDays(
  lastCycleStartIso: string | null,
  cycleLengthDays: number,
  periodLengthDays: number,
): Set<string> {
  const predicted = new Set<string>();
  const start = parseSafeDate(lastCycleStartIso);
  if (!start) return predicted;

  const cLen = cycleLengthDays || 28;
  const pLen = periodLengthDays || 5;

  const daysToCover = MONTHS_TO_PREDICT * 30;
  const cyclesAhead = Math.max(1, Math.ceil(daysToCover / cLen));

  for (let i = 1; i <= cyclesAhead; i++) {
    const cycleStart = new Date(start);
    cycleStart.setDate(cycleStart.getDate() + cLen * i);
    for (let d = 0; d < pLen; d++) {
      const day = new Date(cycleStart);
      day.setDate(day.getDate() + d);
      predicted.add(toDateString(day));
    }
  }

  return predicted;
}
