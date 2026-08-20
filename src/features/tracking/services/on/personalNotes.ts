import { apiCall } from "@shared/services/apiClient";
import type {
  ApiResponse,
  PersonalMuscleNote,
  MuscleGroup,
} from "../../types/muscleRecovery";

export const personalNotesApi = {
  createNote: async (params: {
    muscleGroup: MuscleGroup;
    content: string;
  }): Promise<ApiResponse<PersonalMuscleNote>> =>
    apiCall(`/api/tracking/personal-notes`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getNotesByMuscle: async (muscleGroup: MuscleGroup): Promise<ApiResponse<PersonalMuscleNote[]>> =>
    apiCall(`/api/tracking/personal-notes/muscle/${muscleGroup}`),
};
