import type { SetTiming } from "@shared/types"

export type { SimilarityMatch } from "@utils/exerciseMatching"

// Sets grouped under one exercise for the edit-history UI.
//
// NOTE: this is intentionally distinct from the shared `GroupedExercise`
// (which keys by `exerciseName` and carries no muscle group). This variant
// keys by `name` and includes the muscle group, so it has its own name to
// avoid the two shapes silently diverging under one identifier.
export interface SessionExerciseGroup {
  name: string
  muscleGroup?: string
  sets: SetTiming[]
}
