// features/tracking/services/off/personalNotes.ts
//
// Personal Muscle Notes API - Offline mode (mock data)

import type {
  PersonalMuscleNote,
  MuscleGroup,
} from "../../types/muscleRecovery";
import type { ApiResponse } from "../types";
import { nextId } from "@shared/services/offlineHelpers";

const MOCK_NOTES: PersonalMuscleNote[] = [
  {
    id: 1,
    muscleGroup: "chest_upper",
    content: "Focus on incline movements. Bench press feels good at 80kg.",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
  },
  {
    id: 2,
    muscleGroup: "quads",
    content: "Squats causing some knee discomfort. Reduce weight for 2 weeks.",
    createdAt: "2025-01-20T14:30:00.000Z",
    updatedAt: "2025-01-20T14:30:00.000Z",
  },
  {
    id: 3,
    muscleGroup: "back_upper",
    content: "Pull-ups feeling stronger. Added weight belt for progressive overload.",
    createdAt: "2025-02-01T09:00:00.000Z",
    updatedAt: "2025-02-01T09:00:00.000Z",
  },
];

export const personalNotesApi = {
  createNote: async (params: {
    muscleGroup: MuscleGroup;
    content: string;
  }): Promise<ApiResponse<PersonalMuscleNote>> => {
    const now = new Date().toISOString();
    const id = await nextId("personal_notes_counter");
    const note: PersonalMuscleNote = {
      id,
      muscleGroup: params.muscleGroup,
      content: params.content,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_NOTES.push(note);
    return { success: true, data: note };
  },

  updateNote: async (params: {
    noteId: number;
    content: string;
  }): Promise<ApiResponse<PersonalMuscleNote>> => {
    const note = MOCK_NOTES.find((n) => n.id === params.noteId);
    if (!note) throw new Error("Note not found");
    note.content = params.content;
    note.updatedAt = new Date().toISOString();
    return { success: true, data: note };
  },

  getAllNotes: async (): Promise<ApiResponse<PersonalMuscleNote[]>> => {
    return { success: true, data: [...MOCK_NOTES] };
  },

  getNotesByMuscle: async (
    muscleGroup: MuscleGroup,
  ): Promise<ApiResponse<PersonalMuscleNote[]>> => {
    const notes = MOCK_NOTES.filter((n) => n.muscleGroup === muscleGroup);
    return { success: true, data: notes };
  },

  deleteNote: async (noteId: number): Promise<ApiResponse<{ success: boolean }>> => {
    const index = MOCK_NOTES.findIndex((n) => n.id === noteId);
    if (index === -1) throw new Error("Note not found");
    MOCK_NOTES.splice(index, 1);
    return { success: true, data: { success: true } };
  },
};
