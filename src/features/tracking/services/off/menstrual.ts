import { getStorageItem, setStorageItem } from "@shared/services/sqliteStorage"
import { createRecordStore } from "@shared/services/offlineHelpers"
import { getCyclePhaseInfo } from "@features/tracking/utils"
import type { ApiResponse, FlowIntensity, MenstrualEntry, CycleStats, CyclePhase } from "../types"
import type { MenstrualSettings } from "../../types"

const HISTORY_KEY = "@off_menstrual_history"
const SETTINGS_KEY = "@off_menstrual_settings"
const DAY_FLOW_KEY = "@off_menstrual_day_flow"
const DEFAULT_SETTINGS: MenstrualSettings = { periodDays: 5, cycleLengthDays: 28 }

const store = createRecordStore<MenstrualEntry>(
  "menstrual_entries",
  HISTORY_KEY,
  (e) => e.id,
  (e) => e.cycleStart,
)

async function readSettings(): Promise<MenstrualSettings> {
  try {
    const raw = await getStorageItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function readDayFlows(): Promise<Array<{ date: string; intensity: FlowIntensity; note?: string | null }>> {
  try {
    const raw = await getStorageItem(DAY_FLOW_KEY)
    return raw ? (JSON.parse(raw) as any[]) : []
  } catch {
    return []
  }
}

let idCounter = Date.now()
function nextId(): number {
  return ++idCounter
}

const PHASE_MAP = {
  Menstrual: "menstruation",
  Follicular: "follicular",
  Ovulation: "ovulation",
  Luteal: "luteal",
} as const

function computePhase(
  lastEntry: MenstrualEntry | null,
  settings: MenstrualSettings,
): CyclePhase | null {
  if (!lastEntry) return null
  const start = new Date(lastEntry.cycleStart).getTime()
  const now = Date.now()
  const daysSinceStart = Math.floor((now - start) / (24 * 60 * 60 * 1000))

  const { periodDays, cycleLengthDays } = settings
  const info = getCyclePhaseInfo(daysSinceStart, periodDays, cycleLengthDays)
  const cycleStart = start - (info.dayOfCycle - 1) * 24 * 60 * 60 * 1000
  const phaseEndDay =
    info.phase === "Menstrual"
      ? info.periodEnd
      : info.phase === "Follicular"
        ? info.ovulationStart
        : info.phase === "Ovulation"
          ? info.ovulationEnd
          : info.cycleLength

  return {
    phase: PHASE_MAP[info.phase],
    daysInPhase: phaseEndDay - info.dayOfCycle + 1,
    estimatedEnd: new Date(cycleStart + phaseEndDay * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export const menstrualApi = {
  logMenstrualCycle: async (
    cycleStart: Date | string,
    flowIntensity: FlowIntensity = "moderate",
    symptoms?: string[],
  ): Promise<ApiResponse<MenstrualEntry>> => {
    const startStr = cycleStart instanceof Date ? cycleStart.toISOString() : cycleStart
    const entry: MenstrualEntry = {
      id: nextId(),
      cycleStart: startStr,
      flowIntensity,
      symptoms: symptoms || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await store.put(entry)
    return { success: true, data: entry }
  },

  getMenstrualHistory: async (
    limit: number = 12,
  ): Promise<ApiResponse<MenstrualEntry[]>> => {
    const data = await store.getRecent(limit)
    return { success: true, data }
  },

  getCycleStats: async (): Promise<ApiResponse<CycleStats>> => {
    const history = await store.getAll()
    const settings = await readSettings()

    const sorted = [...history].sort(
      (a, b) => new Date(b.cycleStart).getTime() - new Date(a.cycleStart).getTime(),
    )
    const lastEntry = sorted[0] || null

    let avgCycleLength = settings.cycleLengthDays
    if (sorted.length >= 2) {
      const diffs: number[] = []
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = new Date(sorted[i]!.cycleStart).getTime()
        const next = new Date(sorted[i + 1]!.cycleStart).getTime()
        const diff = Math.round((curr - next) / (24 * 60 * 60 * 1000))
        if (diff > 0) diffs.push(diff)
      }
      if (diffs.length > 0) {
        avgCycleLength = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
      }
    }

    const currentPhase = lastEntry ? computePhase(lastEntry, settings) : null
    const nextEstimate = lastEntry
      ? new Date(new Date(lastEntry.cycleStart).getTime() + avgCycleLength * 24 * 60 * 60 * 1000).toISOString()
      : null

    return {
      success: true,
      data: {
        currentPhase,
        averageCycleLength: avgCycleLength,
        nextPeriodEstimate: nextEstimate,
        lastCycleEntry: lastEntry,
      },
    }
  },

  deleteMenstrualEntry: async (
    id: number,
  ): Promise<ApiResponse<null>> => {
    await store.remove(id)
    return { success: true, data: null }
  },

  getSettings: async (): Promise<ApiResponse<{ periodDays: number; cycleLengthDays: number }>> => {
    const settings = await readSettings()
    return { success: true, data: { periodDays: settings.periodDays, cycleLengthDays: settings.cycleLengthDays } }
  },

  setSettings: async (
    periodDays?: number,
    cycleLengthDays?: number,
  ): Promise<ApiResponse<null>> => {
    const current = await readSettings()
    const updated: MenstrualSettings = {
      periodDays: periodDays ?? current.periodDays,
      cycleLengthDays: cycleLengthDays ?? current.cycleLengthDays,
    }
    await setStorageItem(SETTINGS_KEY, JSON.stringify(updated))
    return { success: true, data: null }
  },

  setDayFlow: async (
    date: string,
    intensity: FlowIntensity = "moderate",
    note?: string,
  ): Promise<ApiResponse<null>> => {
    const flows = await readDayFlows()
    const idx = flows.findIndex((f) => f.date === date)
    const entry = { date, intensity, note: note || null }
    if (idx === -1) {
      flows.push(entry)
    } else {
      flows[idx] = entry
    }
    await setStorageItem(DAY_FLOW_KEY, JSON.stringify(flows))
    return { success: true, data: null }
  },

  getDayFlow: async (
    date: string,
  ): Promise<ApiResponse<{ date: string; intensity: FlowIntensity } | null>> => {
    const flows = await readDayFlows()
    const found = flows.find((f) => f.date === date)
    return {
      success: true,
      data: found ? { date: found.date, intensity: found.intensity } : null,
    }
  },
}
