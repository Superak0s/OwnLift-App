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
   * Update an existing personal note
   * PUT /api/tracking/personal-notes/:id
   */
  updateNote: async (params: {
    noteId: number;
    content: string;
  }): Promise<ApiResponse<PersonalMuscleNote>> =>
    apiCall(`/api/tracking/personal-notes/${params.noteId}`, {
      method: "PUT",
      body: JSON.stringify({ content: params.content }),
    }),

  /**
   * Get all personal notes
   * GET /api/tracking/personal-notes
   */
  getAllNotes: async (): Promise<ApiResponse<PersonalMuscleNote[]>> =>
    apiCall(`/api/tracking/personal-notes`),

  /**
   * Get notes for a specific muscle group
   * GET /api/tracking/personal-notes/muscle/:muscleGroup
   */
  getNotesByMuscle: async (muscleGroup: MuscleGroup): Promise<ApiResponse<PersonalMuscleNote[]>> =>
    apiCall(`/api/tracking/personal-notes/muscle/${muscleGroup}`),

  /**
   * Delete a personal note
   * DELETE /api/tracking/personal-notes/:id
   */
  deleteNote: async (noteId: number): Promise<ApiResponse<{ success: boolean }>> =>
    apiCall(`/api/tracking/personal-notes/${noteId}`, { method: "DELETE" }),
};
