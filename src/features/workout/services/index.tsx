// features/workout/services/index.tsx
import { createDispatchProxy } from "@shared/services/dispatchProxy"
import { workoutApi as workoutApiOn } from "./on/workout"
import { workoutApi as workoutApiOff } from "./off/workout"

type WorkoutApiShape = typeof workoutApiOn

export const workoutApi: WorkoutApiShape = createDispatchProxy(
  workoutApiOn,
  workoutApiOff,
)

export type {
  WorkoutAnalytics,
  WorkoutSession,
  SetTiming,
  UpdateSetParams,
  RenameExerciseResult,
} from "./on/workout"
