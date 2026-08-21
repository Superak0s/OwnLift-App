import { apiCall } from "@shared/services/apiClient";
import { getServerUrl } from "@shared/services/config";
import { tokenStorage } from "@shared/services/tokenStorage";
import { compressImageForUpload } from "@utils/compressImage";
import type {
  ApiResponse,
  ProgressPhotoMuscle,
  LogProgressPhotoParams,
} from "../../types/muscleRecovery";

function withAbsoluteUri(photo: ProgressPhotoMuscle): ProgressPhotoMuscle {
  return photo.uri ? { ...photo, uri: `${getServerUrl()}${photo.uri}` } : photo;
}

export const progressPhotoApi = {
  uploadPhoto: async (params: LogProgressPhotoParams): Promise<ApiResponse<ProgressPhotoMuscle>> => {
    const API_BASE_URL = getServerUrl();
    const token = await tokenStorage.get();
    const compressedUri = await compressImageForUpload(params.uri);

    const formData = new FormData();
    formData.append("photo", {
      uri: compressedUri,
      name: `photo_${Date.now()}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);
    formData.append("muscleGroups", JSON.stringify(params.muscleGroups));
    formData.append("takenAt", params.takenAt || new Date().toISOString());
    formData.append("angle", params.angle || "custom");
    if (params.notes) formData.append("notes", params.notes);
    if (params.customSideName) formData.append("customSideName", params.customSideName);

    const response = await fetch(`${API_BASE_URL}/api/tracking/progress-photos`, {
      method: "POST",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Photo upload failed");
    return data;
  },

  /**
   * Get all progress photos with muscle tags (chronological order)
   * GET /api/tracking/progress-photos
   */
  getAllPhotos: async (limit: number = 100): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const res = await apiCall<ApiResponse<ProgressPhotoMuscle[]>>(`/api/tracking/progress-photos?limit=${limit}`);
    return { ...res, data: res.data?.map(withAbsoluteUri) };
  },

  getPhotosByMuscle: async (muscle: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const res = await apiCall<ApiResponse<ProgressPhotoMuscle[]>>(`/api/tracking/progress-photos/muscle/${muscle}`);
    return { ...res, data: res.data?.map(withAbsoluteUri) };
  },

  getPhotosInRange: async (startDate: string, endDate: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const res = await apiCall<ApiResponse<ProgressPhotoMuscle[]>>(`/api/tracking/progress-photos/range?start=${startDate}&end=${endDate}`);
    return { ...res, data: res.data?.map(withAbsoluteUri) };
  },

  deletePhoto: async (id: string | number): Promise<ApiResponse<null>> =>
    apiCall(`/api/tracking/progress-photos/${id}`, { method: "DELETE" }),
};
