import type { SetTiming } from "@shared/types"

export type { SimilarityMatch } from "@utils/exerciseMatching"

export interface SessionExerciseGroup {
  name: string
  muscleGroup?: string
  sets: SetTiming[]
}
