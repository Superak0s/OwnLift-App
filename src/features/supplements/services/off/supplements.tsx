// features/supplements/services/off/supplements.tsx
//
// Serverless mirror of services/on/supplements.tsx. Supplements, their log
// entries, and their location reminders are all stored locally via
// AsyncStorage. Shape and behavior (including the takenToday/streak
// computation and the creatineApi back-compat shim) match the server
// implementation as closely as possible.

import {
  computeDailyStreak,
  distanceMeters,
  nextId,
  nowIso,
  readJSON,
  writeJSON,
} from "@shared/services/offlineHelpers"
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

// ─── Storage shape ──────────────────────────────────────────────────────────

interface StoredSupplement {
  id: number
  name: string
  unit: string
  defaultAmount: number
  reminderEnabled: boolean
  reminderTime: string | null
  locationReminderEnabled: boolean
  color: string | null
  icon: string | null
}

const SUPPLEMENTS_KEY = "@offline:supplements:list"
const SUPPLEMENT_ID_COUNTER = "@offline:supplements:id_counter"
const ENTRY_ID_COUNTER = "@offline:supplements:entry_id_counter"
const entriesKey = (id: number) => `@offline:supplements:${id}:entries`
const locationKey = (id: number) => `@offline:supplements:${id}:location`

async function getAllSupplements(): Promise<StoredSupplement[]> {
  return readJSON<StoredSupplement[]>(SUPPLEMENTS_KEY, [])
}

async function saveAllSupplements(list: StoredSupplement[]): Promise<void> {
  await writeJSON(SUPPLEMENTS_KEY, list)
}

async function getEntries(id: number): Promise<SupplementEntry[]> {
  return readJSON<SupplementEntry[]>(entriesKey(id), [])
}

async function saveEntries(
  id: number,
  entries: SupplementEntry[],
): Promise<void> {
  await writeJSON(entriesKey(id), entries)
}

function requireSupplement(
  list: StoredSupplement[],
  id: number,
): StoredSupplement {
  const found = list.find((s) => s.id === id)
  if (!found) throw new Error(`Supplement ${id} not found`)
  return found
}

async function toSummary(s: StoredSupplement): Promise<SupplementSummary> {
  const entries = await getEntries(s.id)
  const timestamps = entries.map((e) => e.takenAt)
  const streak = computeDailyStreak(timestamps)
  const todayKey = new Date().toDateString()
  const takenToday = entries.some(
    (e) => new Date(e.takenAt).toDateString() === todayKey,
  )
  return {
    id: s.id,
    name: s.name,
    unit: s.unit,
    defaultAmount: s.defaultAmount,
    reminderEnabled: s.reminderEnabled,
    reminderTime: s.reminderTime,
    locationReminderEnabled: s.locationReminderEnabled,
    color: s.color,
    icon: s.icon,
    takenToday,
    streak,
  }
}

// ─── API ────────────────────────────────────────────────────────────────────

export const supplementsApi = {
  // ── Supplement CRUD ──────────────────────────────────────────

  list: async (): Promise<{
    success: boolean
    supplements: SupplementSummary[]
  }> => {
    const list = await getAllSupplements()
    const supplements = await Promise.all(list.map(toSummary))
    return { success: true, supplements }
  },

  create: async (
    params: CreateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> => {
    const list = await getAllSupplements()
    const id = await nextId(SUPPLEMENT_ID_COUNTER)
    const supplement: StoredSupplement = {
      id,
      name: params.name,
      unit: params.unit ?? "g",
      defaultAmount: params.defaultAmount ?? 1,
      reminderEnabled: params.reminderEnabled ?? false,
      reminderTime: params.reminderTime ?? null,
      locationReminderEnabled: false,
      color: params.color ?? null,
      icon: params.icon ?? null,
    }
    list.push(supplement)
    await saveAllSupplements(list)
    return { success: true, supplement: await toSummary(supplement) }
  },

  get: async (
    id: number,
  ): Promise<{
    success: boolean
    supplement: SupplementSummary
    takenToday: boolean
    todayEntry: SupplementEntry | null
    streak: number
  }> => {
    const list = await getAllSupplements()
    const stored = requireSupplement(list, id)
    const summary = await toSummary(stored)
    const entries = await getEntries(id)
    const todayKey = new Date().toDateString()
    const todayEntry =
      entries.find((e) => new Date(e.takenAt).toDateString() === todayKey) ??
      null

    return {
      success: true,
      supplement: summary,
      takenToday: summary.takenToday,
      todayEntry,
      streak: summary.streak,
    }
  },

  update: async (
    id: number,
    params: UpdateSupplementParams,
  ): Promise<{ success: boolean; supplement: SupplementSummary }> => {
    const list = await getAllSupplements()
    const stored = requireSupplement(list, id)

    if (params.name !== undefined) stored.name = params.name
    if (params.unit !== undefined) stored.unit = params.unit
    if (params.defaultAmount !== undefined)
      stored.defaultAmount = params.defaultAmount
    if (params.reminderEnabled !== undefined)
      stored.reminderEnabled = params.reminderEnabled
    if (params.reminderTime !== undefined)
      stored.reminderTime = params.reminderTime
    if (params.locationReminderEnabled !== undefined)
      stored.locationReminderEnabled = params.locationReminderEnabled
    if (params.color !== undefined) stored.color = params.color
    if (params.icon !== undefined) stored.icon = params.icon

    await saveAllSupplements(list)
    return { success: true, supplement: await toSummary(stored) }
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const list = await getAllSupplements()
    const remaining = list.filter((s) => s.id !== id)
    await saveAllSupplements(remaining)
    await writeJSON(entriesKey(id), [])
    await writeJSON(locationKey(id), null)
    return { success: true }
  },

  // ── Log ──────────────────────────────────────────────────────

  log: async (
    id: number,
    params: LogSupplementParams = {},
  ): Promise<{ success: boolean; id: number; streak: number }> => {
    const list = await getAllSupplements()
    const stored = requireSupplement(list, id)
    const entries = await getEntries(id)

    const entryId = await nextId(ENTRY_ID_COUNTER)
    const entry: SupplementEntry = {
      id: entryId,
      supplementId: id,
      amount: params.amount ?? stored.defaultAmount,
      takenAt: params.takenAt ?? nowIso(),
      note: params.note ?? null,
      createdAt: nowIso(),
    }
    entries.push(entry)
    await saveEntries(id, entries)

    const streak = computeDailyStreak(entries.map((e) => e.takenAt))
    return { success: true, id: entryId, streak }
  },

  getLog: async (id: number, limit = 30): Promise<SupplementLogResponse> => {
    const list = await getAllSupplements()
    requireSupplement(list, id)
    const entries = await getEntries(id)
    const sorted = [...entries].sort(
      (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
    )
    const limited = sorted.slice(0, limit)

    const streak = computeDailyStreak(entries.map((e) => e.takenAt))
    const todayKey = new Date().toDateString()
    const todayEntry =
      sorted.find((e) => new Date(e.takenAt).toDateString() === todayKey) ??
      null

    return {
      success: true,
      entries: limited,
      streak,
      takenToday: todayEntry !== null,
      todayEntry,
    }
  },

  deleteLogEntry: async (
    supplementId: number,
    entryId: number,
  ): Promise<{ success: boolean }> => {
    const entries = await getEntries(supplementId)
    const remaining = entries.filter((e) => e.id !== entryId)
    await saveEntries(supplementId, remaining)
    return { success: true }
  },

  getStreak: async (
    id: number,
  ): Promise<{ success: boolean; streak: number }> => {
    const entries = await getEntries(id)
    return {
      success: true,
      streak: computeDailyStreak(entries.map((e) => e.takenAt)),
    }
  },

  // ── Location ─────────────────────────────────────────────────

  saveLocation: async (
    id: number,
    params: SupplementLocationParams,
  ): Promise<{ success: boolean; location: SupplementLocation }> => {
    const location: SupplementLocation = {
      id,
      supplementId: id,
      latitude: params.latitude,
      longitude: params.longitude,
      address: params.address,
      radius: params.radius,
      enabled: true,
    }
    await writeJSON(locationKey(id), location)

    const list = await getAllSupplements()
    const stored = list.find((s) => s.id === id)
    if (stored) {
      stored.locationReminderEnabled = true
      await saveAllSupplements(list)
    }

    return { success: true, location }
  },

  getLocation: async (
    id: number,
  ): Promise<{
    success: boolean
    location: SupplementLocation | null
    enabled: boolean
  }> => {
    const location = await readJSON<SupplementLocation | null>(
      locationKey(id),
      null,
    )
    return { success: true, location, enabled: location?.enabled ?? false }
  },

  toggleLocation: async (
    id: number,
    enabled: boolean,
  ): Promise<{ success: boolean; enabled: boolean }> => {
    const location = await readJSON<SupplementLocation | null>(
      locationKey(id),
      null,
    )
    if (location) {
      location.enabled = enabled
      await writeJSON(locationKey(id), location)
    }

    const list = await getAllSupplements()
    const stored = list.find((s) => s.id === id)
    if (stored) {
      stored.locationReminderEnabled = enabled
      await saveAllSupplements(list)
    }

    return { success: true, enabled }
  },

  checkLocation: async (
    id: number,
    latitude: number,
    longitude: number,
  ): Promise<{ success: boolean } & AtLocationResult> => {
    const location = await readJSON<SupplementLocation | null>(
      locationKey(id),
      null,
    )
    if (!location || !location.enabled) {
      return {
        success: true,
        withinRadius: false,
        reason: "No location reminder set",
      }
    }

    const distance = distanceMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude,
    )

    return {
      success: true,
      withinRadius: distance <= location.radius,
      distance,
      radius: location.radius,
      address: location.address,
    }
  },

  deleteLocation: async (
    id: number,
  ): Promise<{ success: boolean; message: string }> => {
    await writeJSON(locationKey(id), null)

    const list = await getAllSupplements()
    const stored = list.find((s) => s.id === id)
    if (stored) {
      stored.locationReminderEnabled = false
      await saveAllSupplements(list)
    }

    return { success: true, message: "Location reminder removed" }
  },
}

// ─── Legacy creatine shim ─────────────────────────────────────────────────────
// Mirrors services/on/supplements.tsx: resolves (or auto-creates) a
// "Creatine" supplement so old creatineApi callers keep working unchanged.

let _creatineSupplementId: number | null = null

async function resolveCreatineId(): Promise<number> {
  if (_creatineSupplementId != null) return _creatineSupplementId

  const { supplements } = await supplementsApi.list()
  const existing = supplements.find((s) => s.name.toLowerCase() === "creatine")
  if (existing) {
    _creatineSupplementId = existing.id
    return existing.id
  }

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
