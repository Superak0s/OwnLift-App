// features/tracking/services/on/personalNotes.ts
//
// Personal Muscle Notes API - Online mode

import { apiCall } from "@shared/services/apiClient";
import type {
  ApiResponse,
  PersonalMuscleNote,
  MuscleGroup,
} from "../../types/muscleRecovery";

export const personalNotesApi = {
  /**
   * Create a new personal note for a muscle group
   * POST /api/tracking/personal-notes
   */
  createNote: async (params: {
    muscleGroup: MuscleGroup;
    content: string;
  }): Promise<ApiResponse<PersonalMuscleNote>> =>
    apiCall(`/api/tracking/personal-notes`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * Get notes for a specific muscle group
   * GET /api/tracking/personal-notes/muscle/:muscleGroup
   */
  getNotesByMuscle: async (muscleGroup: MuscleGroup): Promise<ApiResponse<PersonalMuscleNote[]>> =>
    apiCall(`/api/tracking/personal-notes/muscle/${muscleGroup}`),
};
