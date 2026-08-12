export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

// Re-exported from tracking/types/muscleRecovery.ts — the canonical definition.
export { type SorenessEntry } from "../types/muscleRecovery";

export interface HydrationEntry {
  id: number;
  amountMl: number;
  loggedAt: string;
  note?: string | null;
  createdAt: string;
}

export interface HydrationStats {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  averageDaily: number;
  entryCount: number;
  lastEntry: HydrationEntry | null;
}

export interface MeasurementEntry {
  id: number;
  waistCm?: number | null;
  armLeftCm?: number | null;
  armRightCm?: number | null;
  chestCm?: number | null;
  measuredAt: string;
  note?: string | null;
  createdAt: string;
}

export type FlowIntensity = "light" | "moderate" | "heavy";

export interface MenstrualEntry {
  id: number;
  cycleStart: string;
  cycleEnd?: string | null;
  durationDays?: number | null;
  flowIntensity: FlowIntensity;
  symptoms?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CyclePhase {
  phase: "menstruation" | "follicular" | "ovulation" | "luteal";
  daysInPhase: number;
  estimatedEnd: string;
}

export interface CycleStats {
  currentPhase: CyclePhase | null;
  averageCycleLength: number;
  nextPeriodEstimate: string | null;
  lastCycleEntry: MenstrualEntry | null;
}

export interface MenstrualPrefs {
  cycleLengthDays: number;
  periodLengthDays: number;
}
