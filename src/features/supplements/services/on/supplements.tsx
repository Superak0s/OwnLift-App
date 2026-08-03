// features/supplements/services/on/supplements.tsx
import { apiCall } from "@shared/services/apiClient"
import type {
  AtLocationResult,
  CreateSupplementParams,
  LogSupplementParams,
  ReminderLocation as SupplementLocationParams,
  SupplementEntry,
  SupplementLocation,
  SupplementLogResponse,
  SupplementSummary,
  UpdateSupplementParams,
} from "../../types"

// ─── API ──────────────────────────────────────────────────────────────────

export const supplementsApi = {
  // ── Supplement CRUD ──────────────────────────────────────────

  list: (): Promise<{ success: boolean; supplements: SupplementSummary[] }> =>
    apiCall(`/api/tracking/supplements`),

  create: (
    params: CreateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> =>
    apiCall(`/api/tracking/supplements`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  get: (
    id: number,
  ): Promise<{
    success: boolean
    supplement: SupplementSummary
    takenToday: boolean
    todayEntry: SupplementEntry | null
    streak: number
  }> => apiCall(`/api/tracking/supplements/${id}`),

  update: (
    id: number,
    params: UpdateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> =>
    apiCall(`/api/tracking/supplements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    }),

  delete: (id: number): Promise<{ success: boolean }> =>
    apiCall(`/api/tracking/supplements/${id}`, { method: "DELETE" }),

  // ── Log ──────────────────────────────────────────────────────

  log: (
    id: number,
    params: LogSupplementParams = {},
  ): Promise<{ success: boolean; id: number; streak: number }> =>
    apiCall(`/api/tracking/supplements/${id}/log`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getLog: (id: number, limit = 30): Promise<SupplementLogResponse> =>
    apiCall(`/api/tracking/supplements/${id}/log?limit=${limit}`),

  deleteLogEntry: (
    supplementId: number,
    entryId: number,
  ): Promise<{ success: boolean }> =>
    apiCall(`/api/tracking/supplements/${supplementId}/log/${entryId}`, {
      method: "DELETE",
    }),

  getStreak: (id: number): Promise<{ success: boolean; streak: number }> =>
    apiCall(`/api/tracking/supplements/${id}/streak`),

  // ── Location ─────────────────────────────────────────────────

  saveLocation: (
    id: number,
    params: SupplementLocationParams,
  ): Promise<{ success: boolean; location: SupplementLocation }> =>
    apiCall(`/api/tracking/supplements/${id}/location`, {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  getLocation: (
    id: number,
  ): Promise<{
    success: boolean
    location: SupplementLocation | null
    enabled: boolean
  }> => apiCall(`/api/tracking/supplements/${id}/location`),

  toggleLocation: (
    id: number,
    enabled: boolean,
  ): Promise<{ success: boolean; enabled: boolean }> =>
    apiCall(`/api/tracking/supplements/${id}/location/toggle`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  checkLocation: (
    id: number,
    latitude: number,
    longitude: number,
  ): Promise<{ success: boolean } & AtLocationResult> =>
    apiCall(`/api/tracking/supplements/${id}/location/check`, {
      method: "POST",
      body: JSON.stringify({ latitude, longitude }),
    }),

  deleteLocation: (
    id: number,
  ): Promise<{ success: boolean; message: string }> =>
    apiCall(`/api/tracking/supplements/${id}/location`, { method: "DELETE" }),
}
