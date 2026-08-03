// features/tracking/types/muscleRecovery.ts
//
// Types for the Muscle Recovery & Progress Tracking system.

// ─── Muscle Groups ────────────────────────────────────────────────────────────
// Re-exported from shared/types.ts — single source of truth for the recovery
// taxonomy (25 snake_case muscle groups).

import type { RecoveryMuscleGroup } from "@shared/types"

export {
  RECOVERY_MUSCLE_GROUPS as MUSCLE_GROUPS,
} from "@shared/types"
export type { RecoveryMuscleGroup as MuscleGroup } from "@shared/types"

/** Local alias so `MuscleGroup` is usable within this module. */
type MuscleGroup = RecoveryMuscleGroup

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest_upper: "Upper Chest",
  chest_lower: "Lower Chest",
  back_upper: "Upper Back",
  back_lower: "Lower Back",
  lats: "Lats",
  traps: "Traps",
  neck: "Neck",
  shoulders_front: "Front Delts",
  shoulders_side: "Side Delts",
  shoulders_rear: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs_upper: "Upper Abs",
  abs_lower: "Lower Abs",
  obliques: "Obliques",
  lower_back: "Lower Back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  adductors: "Adductors",
  abductors: "Abductors",
  hip_flexors: "Hip Flexors",
} as const

// ─── Soreness Records (continuous tracking) ───────────────────────────────────

export interface ActiveSoreness {
  id: number;
  muscleGroup: MuscleGroup;
  intensity: number; // 0-10
  notes?: string;
  loggedAt: string; // ISO date when first logged
  updatedAt: string; // ISO date when last updated
  recoveredAt?: string; // ISO date when marked recovered
  status: "active" | "recovering" | "recovered";
  followUps: SorenessFollowUp[];
}

export interface SorenessFollowUp {
  id: number;
  sorenessId: number;
  intensity: number; // 0-10 current level
  status: "still_sore" | "better" | "recovered";
  notes?: string;
  updatedAt: string;
}

// ─── Legacy Soreness Entry (for history compatibility) ────────────────────────

export interface SorenessEntry {
  id: number;
  muscleGroup: string;
  intensity: number;
  loggedAt: string;
  note?: string | null;
  createdAt: string;
}

// ─── DOMS Statistics ──────────────────────────────────────────────────────────

export interface MuscleRecoveryStats {
  muscleGroup: MuscleGroup;
  totalEpisodes: number;
  averageRecoveryDays: number;
  maxRecoveryDays: number;
  averageSeverity: number;
  lastSorenessDate: string | null;
  isCurrentlySore: boolean;
  currentIntensity?: number;
}

export interface DOMSStats {
  totalActiveSoreness: number;
  totalRecoveryEpisodes: number;
  averageRecoveryDays: number;
  mostSoreMuscle: MuscleGroup | null;
  muscleRecoveryStats: MuscleRecoveryStats[];
  severityTrend: { date: string; averageIntensity: number }[];
  heatmapData: Record<MuscleGroup, number>; // frequency count
}

// ─── Progress Photos with Muscle Tags ─────────────────────────────────────────

export interface ProgressPhotoMuscle {
  id: string | number;
  takenAt?: string;
  taken_at?: string;
  uri?: string;
  muscleGroups?: MuscleGroup[];
  notes?: string;
  angle?: "front" | "back" | "side" | "custom";
  createdAt?: string;
}

// ─── Injury Tracking ─────────────────────────────────────────────────────────

export type InjuryType =
  | "strain"
  | "sprain"
  | "tendonitis"
  | "fracture"
  | "dislocation"
  | "tear"
  | "overuse"
  | "surgery"
  | "other";

export type InjuryStatus = "active" | "recovering" | "recovered";

export interface InjuryRecord {
  id: number;
  muscleGroup: MuscleGroup;
  injuryType: InjuryType;
  painLevel: number; // 0-10
  startDate: string; // ISO date
  recoveryDate?: string; // ISO date when recovered
  notes?: string;
  status: InjuryStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Muscle Dashboard ────────────────────────────────────────────────────────

export interface MuscleDashboardData {
  muscleGroup: MuscleGroup;
  currentSoreness: ActiveSoreness | null;
  domsHistory: ActiveSoreness[];
  recoveryStats: MuscleRecoveryStats;
  progressPhotos: ProgressPhotoMuscle[];
  injuries: InjuryRecord[];
  personalNotes: PersonalMuscleNote[];
}

// ─── Personal Muscle Notes ────────────────────────────────────────────────────

export interface PersonalMuscleNote {
  id: number;
  muscleGroup: MuscleGroup;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ─── DOMS Follow-up State ────────────────────────────────────────────────────

export interface DOMSFollowUpItem {
  soreness: ActiveSoreness;
  selectedStatus: "still_sore" | "better" | "recovered";
  updatedIntensity: number;
  notes: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────
// Re-exported from services/types.ts so callers still get a single import point.
export { type ApiResponse } from "../services/types";

// ─── Log Soreness Parameters ─────────────────────────────────────────────────

export interface LogSorenessParams {
  muscleGroup: MuscleGroup;
  intensity: number;
  notes?: string;
}

export interface UpdateSorenessParams {
  sorenessId: number;
  intensity: number;
  status: "still_sore" | "better" | "recovered";
  notes?: string;
}

export interface LogInjuryParams {
  muscleGroup: MuscleGroup;
  injuryType: InjuryType;
  painLevel: number;
  startDate: string;
  notes?: string;
}

export interface UpdateInjuryParams {
  injuryId: number;
  status?: InjuryStatus;
  recoveryDate?: string;
  notes?: string;
  painLevel?: number;
}

export interface LogProgressPhotoParams {
  uri: string;
  muscleGroups: MuscleGroup[];
  notes?: string;
  angle?: "front" | "back" | "side" | "custom";
  takenAt?: string;
}
