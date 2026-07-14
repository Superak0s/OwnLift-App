// features/tracking/types.ts

export type WeightUnit = "kg" | "lbs"
export type HeightUnit = "cm" | "ft"
export type Gender = "male" | "female"

export interface HeightInput {
  value: number
  unit: HeightUnit
  inches?: number
}

export interface BodyFatMeasurements {
  waist: number
  neck: number
  hip?: number | null
  unit?: string
}

export interface LogMacrosParams {
  name?: string
  protein?: number
  carbs?: number
  fat?: number
  calories?: number
  errorMargin?: number
  time?: string
  date?: string | null
  note?: string | null
}

export interface MacrosGoals {
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  calories?: number | null
}
