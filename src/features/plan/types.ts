// features/plan/types.ts

// Canonical definition lives in @shared/types; re-exported so existing
// `import { SavedProgram } from "../types"` call sites keep working.
export type { SavedProgram } from "@shared/types"

export interface ExercisePayload {
  name: string
  muscleGroup?: string
  sets: number
}
