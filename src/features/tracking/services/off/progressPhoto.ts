// features/tracking/services/off/progressPhoto.ts
//
// Progress Photo with muscle tagging API - Offline mode (mock data)

import type {
  ApiResponse,
  ProgressPhotoMuscle,
  LogProgressPhotoParams,
} from "../../types/muscleRecovery";

const mockPhotos: ProgressPhotoMuscle[] = [
  {
    id: 1,
    takenAt: new Date(Date.now() - 604800000).toISOString(),
    uri: "file:///mock/photo1.jpg",
    muscleGroups: ["chest_upper", "chest_lower", "shoulders_front", "biceps"],
    notes: "Front pose after chest day",
    angle: "front",
  },
  {
    id: 2,
    takenAt: new Date(Date.now() - 604800000).toISOString(),
    uri: "file:///mock/photo2.jpg",
    muscleGroups: ["back_upper", "lats", "shoulders_rear", "triceps"],
    notes: "Back double bicep",
    angle: "back",
  },
  {
    id: 3,
    takenAt: new Date(Date.now() - 1209600000).toISOString(),
    uri: "file:///mock/photo3.jpg",
    muscleGroups: ["quads", "calves", "abs_upper", "abs_lower"],
    notes: "Side pose",
    angle: "side",
  },
  {
    id: 4,
    takenAt: new Date(Date.now() - 2592000000).toISOString(),
    uri: "file:///mock/photo4.jpg",
    muscleGroups: ["chest_upper", "shoulders_side", "biceps"],
    notes: "Front lat spread",
    angle: "front",
  },
  {
    id: 5,
    takenAt: new Date(Date.now() - 4320000000).toISOString(),
    uri: "file:///mock/photo5.jpg",
    muscleGroups: ["glutes", "hamstrings", "quads", "calves"],
    notes: "Full body back view",
    angle: "back",
  },
];

let localIdCounter = 100;

export const progressPhotoApi = {
  uploadPhoto: async (params: LogProgressPhotoParams): Promise<ApiResponse<ProgressPhotoMuscle>> => {
    const photo: ProgressPhotoMuscle = {
      id: ++localIdCounter,
      takenAt: params.takenAt || new Date().toISOString(),
      uri: params.uri,
      muscleGroups: params.muscleGroups,
      notes: params.notes || undefined,
      angle: params.angle || "custom",
    };
    return { success: true, data: photo };
  },

  getAllPhotos: async (_limit: number = 100): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    return { success: true, data: mockPhotos };
  },

  getPhotosByMuscle: async (muscle: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const filtered = mockPhotos.filter((p) => p.muscleGroups?.includes(muscle as any));
    return { success: true, data: filtered };
  },

  filterPhotos: async (muscleGroups: string[]): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const filtered = mockPhotos.filter((p) =>
      p.muscleGroups?.some((mg) => muscleGroups.includes(mg)),
    );
    return { success: true, data: filtered };
  },

  getPhotosInRange: async (_start: string, _end: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    return { success: true, data: mockPhotos };
  },

  deletePhoto: async (_id: string | number): Promise<ApiResponse<null>> => {
    return { success: true, data: null };
  },

  updatePhotoTags: async (
    id: string | number,
    muscleGroups: string[],
    notes?: string,
  ): Promise<ApiResponse<ProgressPhotoMuscle>> => {
    const photo = mockPhotos.find((p) => p.id === id);
    if (!photo) throw new Error("Photo not found");
    return {
      success: true,
      data: {
        ...photo,
        muscleGroups: muscleGroups as any,
        notes: notes || photo.notes,
      },
    };
  },
};
