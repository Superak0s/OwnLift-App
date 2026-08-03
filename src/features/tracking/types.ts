// features/tracking/types.ts
import type { ProgressPhoto, MacrosEntry, BodyFatEntry } from "@shared/types";

export type WeightUnit = "kg" | "lbs";
export type HeightUnit = "cm" | "ft";
export type Gender = "male" | "female";

export interface HeightInput {
  value: number;
  unit: HeightUnit;
  inches?: number;
}

export interface BodyFatMeasurements {
  waist: number;
  neck: number;
  hip?: number | null;
  unit?: string;
}

export interface LogMacrosParams {
  name?: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
  errorMargin?: number;
  time?: string;
  date?: string | null;
  note?: string | null;
}

export interface MacrosGoals {
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  calories?: number | null;
}

export interface DayModalState {
  date: Date;
  tab: string;
  existingEntries:
    | (
        | import("@shared/types").WeightEntry
        | MacrosEntryWithFields
        | ProgressPhoto
        | BodyFatEntryWithFields
      )[]
    | null;
  isToday: boolean;
}

export interface SelectedDatePhotos {
  date?: Date;
  photos: ProgressPhoto[];
}

export interface ExpandedPhoto {
  uri: string;
  photo: ProgressPhoto;
}

export interface MacrosEntryWithFields extends MacrosEntry {
  date?: string;
  error_margin?: number;
  errorMargin?: number;
  time?: string;
}

export interface SelectedDateMacros {
  date?: Date;
  entries: MacrosEntryWithFields[];
}

export interface BodyFatEntryWithFields extends BodyFatEntry {
  percentage?: number;
  measurements?: {
    waist?: number;
    neck?: number;
    hip?: number;
  };
  recorded_at?: string;
}

// ─── Menstrual Cycle Settings & Tracking ─────────────────────────────────────

export interface MenstrualSettings {
  periodDays: number;
  cycleLengthDays: number;
  updatedAt?: string | null;
}

// ─── Hydration Settings & Tracking ───────────────────────────────────────────

export interface HydrationSettings {
  goalMl: number;
  measurementErrorPercent: number;
  updatedAt?: string | null;
}

export interface CustomMeasurementType {
  id: number;
  keyName: string;
  label: string;
  unit?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomMeasurementEntry {
  id: number;
  typeId: number;
  typeLabel: string;
  value: number;
  measuredAt: string;
  note?: string | null;
  createdAt: string;
}

export interface LogCycleParams {
  cycleStart: string;
  flowIntensity: "light" | "moderate" | "heavy";
  symptoms?: string[];
}

export interface DayFlowEntry {
  id?: number;
  date: string;
  intensity: "light" | "moderate" | "heavy";
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LogHydrationParams {
  amountMl: number;
  loggedAt?: string | null;
  note?: string | null;
}

export interface LogCustomMeasurementParams {
  typeId: number;
  value: number;
  measuredAt?: string | null;
  note?: string | null;
}

// ─── Soreness / DOMS Tracking ────────────────────────────────────────────────
// MuscleGroup is defined in types/muscleRecovery.ts (canonical definition).
// Re-exported here for convenience.
export type { MuscleGroup } from "./types/muscleRecovery";

