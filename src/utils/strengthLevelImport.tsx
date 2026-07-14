// Utility for importing workout history exported from Strength Level
// (https://strengthlevel.com) CSV files.
//
// Expected header:
// Date Lifted,Exercise,Weight (kg),Weight (lb),Reps,Bodyweight (kg),Bodyweight (lb),Percentile (%),Warmup

import { workoutApi } from "@features/workout/services/index"
const startSession = workoutApi.startSession
const recordSet = workoutApi.recordSet
const endSession = workoutApi.endSession

export interface StrengthLevelRow {
  date: string // e.g. "2026-01-13"
  exercise: string
  weightKg: number
  reps: number
  isWarmup: boolean
}

export interface ImportResult {
  sessionsCreated: number
  setsImported: number
  skipped: number
  errors: string[]
}

/**
 * Splits a single CSV line into fields, respecting basic double-quote escaping.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Parses raw CSV text exported from Strength Level into structured rows.
 * Rows with missing required fields are silently skipped.
 */
export function parseStrengthLevelCSV(csvText: string): StrengthLevelRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())

  const dateIdx = header.findIndex((h) => h.startsWith("date"))
  const exerciseIdx = header.findIndex((h) => h === "exercise")
  const weightKgIdx = header.findIndex((h) => h.includes("weight (kg)"))
  const repsIdx = header.findIndex((h) => h === "reps")
  const warmupIdx = header.findIndex((h) => h === "warmup")

  if (dateIdx === -1 || exerciseIdx === -1 || repsIdx === -1) {
    throw new Error(
      "Unrecognized CSV format — expected columns 'Date Lifted', 'Exercise' and 'Reps'.",
    )
  }

  const rows: StrengthLevelRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < header.length) continue

    const date = cols[dateIdx]?.trim()
    const exercise = cols[exerciseIdx]?.trim()
    const weightKgRaw = weightKgIdx !== -1 ? cols[weightKgIdx] : "0"
    const weightKg = parseFloat(weightKgRaw)
    const reps = parseInt(cols[repsIdx], 10)
    const warmupRaw = warmupIdx !== -1 ? cols[warmupIdx]?.trim() : "0"
    const isWarmup = warmupRaw === "1" || warmupRaw?.toLowerCase() === "true"

    if (!date || !exercise || Number.isNaN(reps)) continue

    rows.push({
      date,
      exercise,
      weightKg: Number.isNaN(weightKg) ? 0 : weightKg,
      reps,
      isWarmup,
    })
  }

  return rows
}

/**
 * Imports Strength Level CSV history for a given person by replaying it
 * through the existing session APIs. One backdated session is created per
 * distinct date in the file, with one recorded set per row.
 */
export async function importStrengthLevelCSV(
  csvText: string,
  person: string,
): Promise<ImportResult> {
  const rows = parseStrengthLevelCSV(csvText)

  const result: ImportResult = {
    sessionsCreated: 0,
    setsImported: 0,
    skipped: 0,
    errors: [],
  }

  if (rows.length === 0) {
    result.errors.push("No valid rows found in the file.")
    return result
  }

  // Group rows by date, preserving their original order within each date.
  const byDate = new Map<string, StrengthLevelRow[]>()
  rows.forEach((row) => {
    const list = byDate.get(row.date) ?? []
    list.push(row)
    byDate.set(row.date, list)
  })

  const sortedDates = Array.from(byDate.keys()).sort()

  for (const date of sortedDates) {
    const dateRows = byDate.get(date)!
    const baseTime = new Date(`${date}T12:00:00.000Z`).getTime()

    if (Number.isNaN(baseTime)) {
      result.errors.push(`Skipped invalid date: "${date}"`)
      result.skipped += dateRows.length
      continue
    }

    let sessionId: number | string
    try {
      sessionId = await startSession(
        person,
        1,
        "Imported (Strength Level)",
        [],
        false,
        new Date(baseTime).toISOString(),
      )
    } catch (err) {
      result.errors.push(
        `Failed to create session for ${date}: ${(err as Error).message}`,
      )
      result.skipped += dateRows.length
      continue
    }

    // Track per-exercise set numbering within this session, and space out
    // timestamps by a minute per set since the source file has no times.
    const exerciseSetCounts = new Map<string, number>()
    let offsetSeconds = 0
    let lastEndTime = new Date(baseTime).toISOString()

    for (const row of dateRows) {
      const setIndex = (exerciseSetCounts.get(row.exercise) ?? 0) + 1
      exerciseSetCounts.set(row.exercise, setIndex)

      const startTime = new Date(baseTime + offsetSeconds * 1000).toISOString()
      offsetSeconds += 60
      const endTime = new Date(baseTime + offsetSeconds * 1000).toISOString()
      lastEndTime = endTime

      try {
        await recordSet(
          sessionId,
          row.exercise,
          setIndex,
          startTime,
          endTime,
          row.weightKg,
          row.reps,
          "Imported from Strength Level",
          row.isWarmup,
          null,
        )
        result.setsImported += 1
      } catch (err) {
        result.errors.push(
          `Failed to import set (${row.exercise} on ${date}): ${(err as Error).message}`,
        )
        result.skipped += 1
      }
    }

    try {
      await endSession(sessionId, lastEndTime)
      result.sessionsCreated += 1
    } catch (err) {
      result.errors.push(
        `Failed to close imported session for ${date}: ${(err as Error).message}`,
      )
    }
  }

  return result
}
