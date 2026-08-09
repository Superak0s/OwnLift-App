export type { SavedProgram } from "@shared/types"
export type { Exercise as ExercisePayload } from "@shared/types"

export interface ExerciseDraft {
  name: string;
  muscleGroup: string;
  setsByPerson: Record<string, string>;
}

export interface DayDraft {
  exercises: ExerciseDraft[];
}

export interface WdDay {
  dayNumber?: number;
  dayTitle?: string;
  exercises?: Array<{
    name?: string;
    muscleGroup?: string;
    setsByPerson?: Record<string, number>;
  }>;
}
