import type { RecoveryMuscleGroup } from "@shared/types"
export type { ApiResponse } from "@features/tracking/services/types"
export {
  RECOVERY_MUSCLE_GROUPS as MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
} from "@shared/types"
export type { RecoveryMuscleGroup as MuscleGroup } from "@shared/types"

type MuscleGroup = RecoveryMuscleGroup


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


export interface SorenessEntry {
  id: number;
  muscleGroup: string;
  intensity: number;
  loggedAt: string;
  note?: string | null;
  createdAt: string;
}


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


export interface ProgressPhotoMuscle {
  id: string | number;
  takenAt?: string;
  taken_at?: string;
  uri?: string;
  muscleGroups?: MuscleGroup[];
  notes?: string;
  angle?: "front" | "back" | "side" | "custom";
  customSideName?: string;
  createdAt?: string;
}


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



export interface PersonalMuscleNote {
  id: number;
  muscleGroup: MuscleGroup;
  content: string;
  createdAt: string;
  updatedAt: string;
}


export interface DOMSFollowUpItem {
  soreness: ActiveSoreness;
  selectedStatus: "still_sore" | "better" | "recovered";
  updatedIntensity: number;
  notes: string;
}


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

export interface LogProgressPhotoParams {
  uri: string;
  muscleGroups: MuscleGroup[];
  notes?: string;
  angle?: "front" | "back" | "side" | "custom";
  customSideName?: string;
  takenAt?: string;
}
