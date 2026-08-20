import {
  computeDailyStreak,
  nextId,
  nowIso,
  readJSON,
  writeJSON,
  createRecordStore,
  type RecordStore,
} from "@shared/services/offlineHelpers"
import { toDateString } from "@utils/format"
import type {
  CreateSupplementParams,
  LogSupplementParams,
  ReminderLocation as SupplementLocationParams,
  SupplementEntry,
  SupplementLocation,
  SupplementLogResponse,
  SupplementSummary,
  UpdateSupplementParams,
} from "../../types"


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

// Each supplement's log history is its own row-per-record collection —
// logging one dose used to rewrite that supplement's *entire* log blob
// (potentially a year of daily entries) every time.
const entryStores = new Map<number, RecordStore<SupplementEntry>>()
function entryStoreFor(id: number): RecordStore<SupplementEntry> {
  let store = entryStores.get(id)
  if (!store) {
    store = createRecordStore<SupplementEntry>(
      `supplement_entries_${id}`,
      entriesKey(id),
      (e) => e.id,
      (e) => e.takenAt,
    )
    entryStores.set(id, store)
  }
  return store
}

async function getEntries(id: number): Promise<SupplementEntry[]> {
  return entryStoreFor(id).getAll()
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
  const todayKey = toDateString(new Date())
  const takenToday = entries.some(
    (e) => toDateString(e.takenAt) === todayKey,
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


export const supplementsApi = {

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
    await entryStoreFor(id).clear()
    entryStores.delete(id)
    await writeJSON(locationKey(id), null)
    return { success: true }
  },


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
    await entryStoreFor(id).put(entry)

    const streak = computeDailyStreak([...entries.map((e) => e.takenAt), entry.takenAt])
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
    const todayKey = toDateString(new Date())
    const todayEntry =
      sorted.find((e) => toDateString(e.takenAt) === todayKey) ??
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
    await entryStoreFor(supplementId).remove(entryId)
    return { success: true }
  },


  saveLocation: async (
    id: number,
    params: SupplementLocationParams,
  ): Promise<{ success: boolean; location: SupplementLocation }> => {
    const location: SupplementLocation = {
      id,
      supplementId: id,
      latitude: params.lat,
      longitude: params.lng,
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

}
