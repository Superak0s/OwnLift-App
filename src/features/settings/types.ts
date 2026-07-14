import type { SetTiming } from "@shared/types"

export interface SimilarityMatch {
  name: string
  similarity: number
}

// ⚠️ Potential duplicate of features/friends/types.ts's GroupedExercise —
// same concept (grouping sets under one exercise) but different field name
// (`name` here vs `exerciseName` there). Decide if these should actually
// be the same shared type before both drift further.
export interface GroupedExercise {
  name: string
  muscleGroup?: string
  sets: SetTiming[]
}
