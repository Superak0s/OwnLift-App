import type {
  WorkoutData,
  WorkoutDay,
  PersonWorkout,
  ExerciseWithSets,
} from "@shared/types"
import defaultSplitsJson from "./defaultSplits.json"

export interface SplitDayTemplate {
  dayTitle: string
  muscleGroups: string[]
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
    })),
  }
}

function buildEmptyDay(
  dayNumber: number,
  day: SplitDayTemplate,
  split: string[],
): WorkoutDay {
  const emptySplit: Record<string, PersonWorkout> = Object.fromEntries(
    split.map((p) => [p, { exercises: [], totalSets: 0 }]),
  )
  const emptyExercises: ExerciseWithSets[] = []

  return {
    dayNumber,
    dayTitle: day.dayTitle,
    muscleGroups: day.muscleGroups,
    exercises: emptyExercises,
    split: emptySplit,
  }
}

export function buildProgramFromTemplate(
  template: SplitTemplate,
  split: string[],
): WorkoutData {
  const days: WorkoutDay[] = template.days.map((day, idx) =>
    buildEmptyDay(idx + 1, day, split),
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
): WorkoutData {
  const existingDays = workoutData?.days ?? []
  const split = workoutData?.split ?? []

  const maxDayNumber = existingDays.reduce(
    (max, d) => Math.max(max, d.dayNumber ?? 0),
    0,
  )

  const newDays: WorkoutDay[] = template.days.map((day, idx) =>
    buildEmptyDay(maxDayNumber + idx + 1, day, split),
  )

  const mergedDays = [...existingDays, ...newDays]

  return {
    ...workoutData,
    totalDays: mergedDays.length,
    days: mergedDays,
    success: true,
  } as WorkoutData & { success: true }
}
