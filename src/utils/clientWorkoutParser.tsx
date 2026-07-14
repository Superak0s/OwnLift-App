// utils/clientWorkoutParser.tsx
// Client-side (React Native/Expo) counterpart to utils/workoutParser.ts.
// Parsing LOGIC is kept byte-for-byte in sync with utils/workoutParser.ts and
// src/models/workout/parser.ts. Only the file-reading step differs, because
// RN has no `fs` and XLSX.readFile(path) isn't available — we read the file
// as base64 via expo-file-system and hand that to XLSX.read instead.
//
// NOTE: this intentionally assumes the header row is always the row
// immediately after a "Day" row (no lookahead for spacer rows). If a real
// workout sheet ever has a blank row between the day title and the header
// row, this will silently misparse it — same as the two server-side files.
// Fix all three together if that's ever addressed.
//
// FIX (see person-column scan below): the person-column headers (GF, BF,
// etc.) must be CONTIGUOUS starting right after the "Muscle Group" column.
// A blank header cell means "no more people" and ends the scan. Previously
// this used `continue` on a blank cell, which skipped over it and kept
// reading columns further to the right — so any unrelated content placed
// elsewhere in the same row (e.g. a personal "sets per muscle group"
// summary table living a couple columns over) got misread as extra
// "people" columns. Now it `break`s on the first gap instead. A numeric-
// header guard is also kept as a second line of defense in case a stray
// number ever lands directly in a person-column slot with no gap before it.

import XLSX from "xlsx"
import * as FileSystem from "expo-file-system/legacy"
import type { WorkoutData, WorkoutDay } from "../types/types"

const MAX_TOTAL_COLUMNS = 52
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_ROWS = 1000
const MAX_NAME_LENGTH = 50

interface PeopleColumn {
  index: number
  name: string
}

type WorkingDay = WorkoutDay & { peopleColumns?: PeopleColumn[] }

// A header that is purely numeric (e.g. "10", "3.5") can never be a valid
// person name — if the contiguous-columns scan below is ever bypassed or a
// sheet is malformed in some other way, this stops a bare number from being
// registered as a "person".
function isNumericLike(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value)
}

export async function parseWorkoutFileClient(
  fileUri: string,
): Promise<WorkoutData> {
  const info = await FileSystem.getInfoAsync(fileUri)
  if (!info.exists) {
    throw new Error("File not found")
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("File too large (max 5 MB)")
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const workbook = XLSX.read(base64, {
    type: "base64",
    sheetRows: MAX_ROWS,
    cellFormula: false,
    cellHTML: false,
  })

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  })

  const days: WorkingDay[] = []
  const people: string[] = []
  let currentDay: WorkingDay | null = null

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as unknown[]
    const firstCell = String(row[0] ?? "").trim()

    if (firstCell.toLowerCase().startsWith("day ")) {
      if (currentDay) days.push(currentDay)

      currentDay = {
        dayNumber: extractDayNumber(firstCell),
        dayTitle: firstCell,
        muscleGroups: extractMuscleGroups(firstCell),
        exercises: [],
        people: {},
      }

      // The next row contains column headers (person names)
      if (i + 1 < data.length) {
        const headers = data[i + 1] as unknown[]
        const peopleColumns: PeopleColumn[] = []

        // Person columns are CONTIGUOUS, starting right after the
        // "Muscle Group" column (index 1). The first blank header cell
        // marks the end of the people section — stop there, don't skip
        // past it. Anything sitting further to the right in the same row
        // (notes, legends, per-muscle-group summaries, etc.) belongs to
        // the user, not to the parser.
        const colLimit = Math.min(headers.length, MAX_TOTAL_COLUMNS)
        for (let j = 2; j < colLimit; j++) {
          const header = String(headers[j] ?? "").trim()

          if (!header) break // end of contiguous person columns
          if (header.length > MAX_NAME_LENGTH) break
          if (isNumericLike(header)) break // never treat a bare number as a person

          peopleColumns.push({ index: j, name: header })
          if (!people.includes(header)) people.push(header)
          if (!currentDay.people[header])
            currentDay.people[header] = { exercises: [], totalSets: 0 }
        }

        currentDay.peopleColumns = peopleColumns
      }

      console.log(currentDay.peopleColumns)

      i++ // skip the header row
      continue
    }

    if (!currentDay || !firstCell) continue

    if (firstCell === "Total Sets:") {
      currentDay.peopleColumns?.forEach(({ index, name }: PeopleColumn) => {
        const raw = row[index]
        if (raw === "" || raw === undefined) return
        const total = typeof raw === "number" ? raw : parseInt(String(raw))
        if (!isNaN(total)) currentDay!.people[name].totalSets = total
      })
      continue
    }

    if (firstCell === "Exercise") continue

    // Exercise row
    const muscleGroup = String(row[1] ?? "")
    const setsByPerson: Record<string, number> = {}

    currentDay.peopleColumns?.forEach(({ index, name }: PeopleColumn) => {
      const raw = row[index]
      if (raw === "" || raw === undefined) return
      const sets = typeof raw === "number" ? raw : parseInt(String(raw))
      if (isNaN(sets)) return

      setsByPerson[name] = sets
      if (sets > 0) {
        currentDay!.people[name].exercises.push({
          name: firstCell,
          muscleGroup,
          sets,
        })
      }
    })

    if (Object.keys(setsByPerson).length > 0) {
      if (!currentDay.exercises) currentDay.exercises = []
      currentDay.exercises.push({ name: firstCell, muscleGroup, setsByPerson })
    }
  }

  if (currentDay) days.push(currentDay)
  return { days, people }
}

function extractDayNumber(dayTitle: string): number {
  const match = dayTitle.match(/Day (\d+)/i)
  return match ? parseInt(match[1]) : 0
}

function extractMuscleGroups(dayTitle: string): string[] {
  const parts = dayTitle.split("—")
  return parts.length > 1 ? parts[1].split("/").map((g) => g.trim()) : []
}
