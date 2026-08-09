// features/tracking/services/on/progressPhoto.ts
//
// Progress Photo with muscle tagging API - Online mode

import { apiCall } from "@shared/services/apiClient";
import type {
  ApiResponse,
  ProgressPhotoMuscle,
  LogProgressPhotoParams,
} from "../../types/muscleRecovery";

export const progressPhotoApi = {
  /**
   * Upload a progress photo with muscle tags
   * POST /api/tracking/progress-photos (multipart/form-data)
   */
  uploadPhoto: async (params: LogProgressPhotoParams): Promise<ApiResponse<ProgressPhotoMuscle>> =>
    apiCall(`/api/tracking/progress-photos`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * Get all progress photos with muscle tags (chronological order)
   * GET /api/tracking/progress-photos
   */
  getAllPhotos: async (limit: number = 100): Promise<ApiResponse<ProgressPhotoMuscle[]>> =>
    apiCall(`/api/tracking/progress-photos?limit=${limit}`),

  /**
   * Get photos filtered by muscle group
   * GET /api/tracking/progress-photos/muscle/:muscle
   */
  getPhotosByMuscle: async (muscle: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> =>
    apiCall(`/api/tracking/progress-photos/muscle/${muscle}`),

  /**
   * Get photos by date range
   * GET /api/tracking/progress-photos/range?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  getPhotosInRange: async (startDate: string, endDate: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> =>
    apiCall(`/api/tracking/progress-photos/range?start=${startDate}&end=${endDate}`),

  /**
   * Delete a progress photo
   * DELETE /api/tracking/progress-photos/:id
   */
  deletePhoto: async (id: string | number): Promise<ApiResponse<null>> =>
    apiCall(`/api/tracking/progress-photos/${id}`, { method: "DELETE" }),
};
