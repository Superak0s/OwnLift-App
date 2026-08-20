export type { SavedProgram } from "@shared/types"
export type { Exercise as ExercisePayload } from "@shared/types"

export interface WdDay {
  dayNumber?: number;
  dayTitle?: string;
  exercises?: Array<{
    name?: string;
    exerciseId?: string;
    muscleGroup?: string;
    setsBySplit?: Record<string, number>;
  }>;
}

export interface SplitDayDraft {
  /** Index of the program day this draft edits; absent for a day being added. */
  dayIdx?: number;
  dayTitle: string;
  exercises: {
    name: string;
    exerciseId: string;
    muscleGroup: string;
    sets: string;
  }[];
}
