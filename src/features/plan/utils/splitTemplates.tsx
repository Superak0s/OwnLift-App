import type {
  WorkoutData,
  WorkoutDay,
  SplitWorkout,
  ExerciseWithSets,
} from "@shared/types"
import defaultSplitsJson from "./defaultSplits.json"

export interface SplitDayTemplateExercise {
  name: string
  exerciseId?: string
  muscleGroup?: string
  sets?: number
}

export interface SplitDayTemplate {
  dayTitle: string
  muscleGroups: string[]
  exercises?: SplitDayTemplateExercise[]
}

export interface SplitTemplate {
  id: string
  name: string
  description: string
  days: SplitDayTemplate[]
}

export const DEFAULT_SPLITS: SplitTemplate[] =
  defaultSplitsJson as SplitTemplate[]

export function createCustomSplitTemplate(
  name: string,
  days: SplitDayTemplate[],
): SplitTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: name.trim() || "Custom Split",
    description: "Custom split",
    days: days.map((d) => ({
      dayTitle: d.dayTitle.trim(),
      muscleGroups: d.muscleGroups
        .map((m) => m.trim())
        .filter((m) => m.length > 0),
      exercises: d.exercises,
    })),
  }
}

const DEFAULT_SETS = 3

function buildDay(
  dayNumber: number,
  day: SplitDayTemplate,
  split: string[],
  targetSplits: string[] = split,
): WorkoutDay {
  const templateExercises = day.exercises ?? []
  const exercises: ExerciseWithSets[] = templateExercises.map((e) => ({
    name: e.name,
    exerciseId: e.exerciseId,
    muscleGroup: e.muscleGroup ?? "",
    setsBySplit: Object.fromEntries(
      split.map((p) => [p, targetSplits.includes(p) ? e.sets ?? DEFAULT_SETS : 0]),
    ),
  }))

  const daySplit: Record<string, SplitWorkout> = Object.fromEntries(
    split.map((p) => {
      const splitExercises = targetSplits.includes(p) ? exercises : []
      return [
        p,
        {
          exercises: splitExercises.map((e) => ({
            name: e.name,
            exerciseId: e.exerciseId,
            muscleGroup: e.muscleGroup,
            sets: e.setsBySplit[p],
          })),
          totalSets: splitExercises.reduce(
            (sum, e) => sum + e.setsBySplit[p],
            0,
          ),
        },
      ]
    }),
  )

  return {
    dayNumber,
    dayTitle: day.dayTitle,
    muscleGroups: day.muscleGroups,
    exercises,
    split: daySplit,
  }
}

export function buildProgramFromTemplate(
  template: SplitTemplate,
  split: string[],
): WorkoutData {
  const days: WorkoutDay[] = template.days.map((day, idx) =>
    buildDay(idx + 1, day, split),
  )

  return {
    totalDays: days.length,
    split,
    days,
    success: true,
  } as WorkoutData & { success: true }
}

export function insertTemplateIntoProgram(
  workoutData: WorkoutData,
  template: SplitTemplate,
  targetSplits?: string[],
): WorkoutData {
  const existingDays = workoutData?.days ?? []
  const split = workoutData?.split ?? []

  const maxDayNumber = existingDays.reduce(
    (max, d) => Math.max(max, d.dayNumber ?? 0),
    0,
  )

  const newDays: WorkoutDay[] = template.days.map((day, idx) =>
    buildDay(maxDayNumber + idx + 1, day, split, targetSplits ?? split),
  )

  const mergedDays = [...existingDays, ...newDays]

  return {
    ...workoutData,
    totalDays: mergedDays.length,
    days: mergedDays,
    success: true,
  } as WorkoutData & { success: true }
}
