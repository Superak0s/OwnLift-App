// features/supplements/services/on/supplements.tsx
import { getServerUrl } from "@shared/services/on/config"
import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import type {
  AtLocationResult,
  CreateSupplementParams,
  LogSupplementParams,
  SupplementEntry,
  SupplementLocation,
  SupplementLocationParams,
  SupplementLogResponse,
  SupplementSummary,
  UpdateSupplementParams,
} from "../../types"

// ─── Helpers ──────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getServerUrl()}${path}`
  const response = await authenticatedFetch(url, options)
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || data.message || `Request failed: ${path}`)
  return data as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})

// ─── API ──────────────────────────────────────────────────────────────────

export const supplementsApi = {
  // ── Supplement CRUD ──────────────────────────────────────────

  list: (): Promise<{ success: boolean; supplements: SupplementSummary[] }> =>
    request("/api/tracking/supplements"),

  create: (
    params: CreateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> =>
    request("/api/tracking/supplements", json("POST", params)),

  get: (
    id: number,
  ): Promise<{
    success: boolean
    supplement: SupplementSummary
    takenToday: boolean
    todayEntry: SupplementEntry | null
    streak: number
  }> => request(`/api/tracking/supplements/${id}`),

  update: (
    id: number,
    params: UpdateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> =>
    request(`/api/tracking/supplements/${id}`, json("PATCH", params)),

  delete: (id: number): Promise<{ success: boolean }> =>
    request(`/api/tracking/supplements/${id}`, { method: "DELETE" }),

  // ── Log ──────────────────────────────────────────────────────

  log: (
    id: number,
    params: LogSupplementParams = {},
  ): Promise<{ success: boolean; id: number; streak: number }> =>
    request(`/api/tracking/supplements/${id}/log`, json("POST", params)),

  getLog: (id: number, limit = 30): Promise<SupplementLogResponse> =>
    request(`/api/tracking/supplements/${id}/log?limit=${limit}`),

  deleteLogEntry: (
    supplementId: number,
    entryId: number,
  ): Promise<{ success: boolean }> =>
    request(`/api/tracking/supplements/${supplementId}/log/${entryId}`, {
      method: "DELETE",
    }),

  getStreak: (id: number): Promise<{ success: boolean; streak: number }> =>
    request(`/api/tracking/supplements/${id}/streak`),

  // ── Location ─────────────────────────────────────────────────

  saveLocation: (
    id: number,
    params: SupplementLocationParams,
  ): Promise<{ success: boolean; location: SupplementLocation }> =>
    request(`/api/tracking/supplements/${id}/location`, json("PUT", params)),

  getLocation: (
    id: number,
  ): Promise<{
    success: boolean
    location: SupplementLocation | null
    enabled: boolean
  }> => request(`/api/tracking/supplements/${id}/location`),

  toggleLocation: (
    id: number,
    enabled: boolean,
  ): Promise<{ success: boolean; enabled: boolean }> =>
    request(
      `/api/tracking/supplements/${id}/location/toggle`,
      json("PUT", { enabled }),
    ),

  checkLocation: (
    id: number,
    latitude: number,
    longitude: number,
  ): Promise<{ success: boolean } & AtLocationResult> =>
    request(
      `/api/tracking/supplements/${id}/location/check`,
      json("POST", { latitude, longitude }),
    ),

  deleteLocation: (
    id: number,
  ): Promise<{ success: boolean; message: string }> =>
    request(`/api/tracking/supplements/${id}/location`, { method: "DELETE" }),
}

// ─── Legacy creatine shim ─────────────────────────────────────────────────────
// Keeps creatineApi callers working while you migrate screens one by one.
// Requires knowing the creatine supplement ID — resolved once on first use.

let _creatineSupplementId: number | null = null

async function resolveCreatineId(): Promise<number> {
  if (_creatineSupplementId != null) return _creatineSupplementId

  const { supplements } = await supplementsApi.list()
  const existing = supplements.find((s) => s.name.toLowerCase() === "creatine")
  if (existing) {
    _creatineSupplementId = existing.id
    return existing.id
  }

  // Auto-create if this user migrated from the old creatine-only system
  const { supplement } = await supplementsApi.create({
    name: "Creatine",
    unit: "g",
    defaultAmount: 5,
  })
  _creatineSupplementId = supplement.id
  return supplement.id
}

export const creatineApi = {
  saveReminderLocation: async (
    latitude: number,
    longitude: number,
    address: string,
    radius: number,
  ): Promise<unknown> => {
    const id = await resolveCreatineId()
    return supplementsApi.saveLocation(id, {
      latitude,
      longitude,
      address,
      radius,
    })
  },

  getReminderLocation: async (): Promise<unknown> => {
    const id = await resolveCreatineId()
    return supplementsApi.getLocation(id)
  },

  toggleLocationReminder: async (enabled: boolean): Promise<unknown> => {
    const id = await resolveCreatineId()
    return supplementsApi.toggleLocation(id, enabled)
  },

  checkIfAtLocation: async (
    currentLatitude: number,
    currentLongitude: number,
  ): Promise<AtLocationResult> => {
    const id = await resolveCreatineId()
    return supplementsApi.checkLocation(id, currentLatitude, currentLongitude)
  },
}
