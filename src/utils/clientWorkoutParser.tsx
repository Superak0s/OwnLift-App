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
// FIX (see split-column scan below): the split-column headers (GF, BF,
// etc.) must be CONTIGUOUS starting right after the "Muscle Group" column.
// A blank header cell means "no more splits" and ends the scan. Previously
// this used `continue` on a blank cell, which skipped over it and kept
// reading columns further to the right — so any unrelated content placed
// elsewhere in the same row (e.g. a personal "sets per muscle group"
// summary table living a couple columns over) got misread as extra
// split columns. Now it `break`s on the first gap instead. A numeric-
// header guard is also kept as a second line of defense in case a stray
// number ever lands directly in a split-column slot with no gap before it.

import XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import type { WorkoutData, WorkoutDay } from "@shared/types";

const MAX_TOTAL_COLUMNS = 52;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 1000;
const MAX_NAME_LENGTH = 50;

interface SplitColumn {
  index: number;
  name: string;
}

// One header cell from the row right after a "Day " row, as shown to the
// user in the column picker. `autoSelected` reflects what the old
// contiguous-scan heuristic would have picked, so the UI can pre-check
// sensible defaults — but the user has the final say.
export interface SplitColumnCandidate {
  index: number;
  name: string;
  autoSelected: boolean;
}

type WorkingDay = WorkoutDay & { splitColumns?: SplitColumn[] };

// A header that is purely numeric (e.g. "10", "3.5") can never be a valid
// person name — if the contiguous-columns scan below is ever bypassed or a
// sheet is malformed in some other way, this stops a bare number from being
// registered as a "person".
function isNumericLike(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value);
}

// Sheet cells come back typed as `unknown` (could be a string, number,
// boolean, Date, or in malformed sheets even an object/array). Stringifying
// a non-primitive with `String(x)` silently produces "[object Object]",
// which is exactly what SonarQube (S6551) flags. This helper makes the
// "not a primitive → empty string" decision explicit instead of relying on
// default Object stringification, and is used everywhere a cell needs to
// become a string.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value);
}

// Shared by both the auto-parse path and the candidate list shown to the
// user, so the two never drift apart. Mirrors the old behavior: contiguous
// non-blank headers starting at column index 2, stopping at the first
// blank, oversized, or numeric-looking cell.
function scanContiguousSplitColumns(
  headers: unknown[],
  colLimit: number,
): SplitColumn[] {
  const columns: SplitColumn[] = [];
  for (let j = 2; j < colLimit; j++) {
    const header = cellToString(headers[j]).trim();
    if (!header) break; // end of contiguous split columns
    if (header.length > MAX_NAME_LENGTH) break;
    if (isNumericLike(header)) break; // never treat a bare number as a split name
    columns.push({ index: j, name: header });
  }
  return columns;
}

async function readWorkbookFirstHeaderRow(
  fileUri: string,
): Promise<{ headers: unknown[]; colLimit: number } | null> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error("File not found");
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("File too large (max 5 MB)");
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, {
    type: "base64",
    sheetRows: MAX_ROWS,
    cellFormula: false,
    cellHTML: false,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = cellToString(row[0]).trim();
    if (firstCell.toLowerCase().startsWith("day ") && i + 1 < data.length) {
      const headers = data[i + 1];
      return { headers, colLimit: Math.min(headers.length, MAX_TOTAL_COLUMNS) };
    }
  }
  return null;
}

/**
 * Reads just the first day's header row and returns EVERY non-blank cell
 * from column index 2 onward as a candidate split column — no auto-scan
 * cutoff applied. Intended for a UI step where the user picks which
 * columns are actually splits (people) before the file is parsed for
 * real, instead of the app silently guessing from contiguous headers.
 *
 * `autoSelected` marks which candidates the old heuristic would have
 * chosen, purely as a starting point for the picker's checkboxes.
 */
export async function extractSplitColumnCandidates(
  fileUri: string,
): Promise<SplitColumnCandidate[]> {
  const found = await readWorkbookFirstHeaderRow(fileUri);
  if (!found) return [];
  const { headers, colLimit } = found;

  const autoColumns = scanContiguousSplitColumns(headers, colLimit);
  const autoIndices = new Set(autoColumns.map((c) => c.index));

  const candidates: SplitColumnCandidate[] = [];
  for (let j = 2; j < colLimit; j++) {
    const header = cellToString(headers[j]).trim();
    if (!header) continue;
    if (header.length > MAX_NAME_LENGTH) continue;
    candidates.push({
      index: j,
      name: header,
      autoSelected: autoIndices.has(j),
    });
  }
  return candidates;
}

// Resolves which columns count as "split columns" for a day: either the
// user's explicit picks (as-is, no contiguity requirement) or the old
// auto contiguous-scan as a fallback for callers that skip the picker.
function buildSplitColumnsForDay(
  headers: unknown[],
  colLimit: number,
  selectedColumnIndices: number[] | undefined,
): SplitColumn[] {
  if (!selectedColumnIndices) {
    return scanContiguousSplitColumns(headers, colLimit);
  }
  return selectedColumnIndices
    .filter((j) => j >= 2 && j < colLimit)
    .map((j) => ({ index: j, name: cellToString(headers[j]).trim() }))
    .filter((c) => c.name.length > 0);
}

// Records the resolved split columns on the day and makes sure every split
// name has an entry in both the day's `split` map and the workbook-wide
// `splits` list.
function registerSplitColumns(
  day: WorkingDay,
  splitColumns: SplitColumn[],
  splits: string[],
): void {
  day.splitColumns = splitColumns;
  for (const { name } of splitColumns) {
    if (!splits.includes(name)) splits.push(name);
    day.split[name] ??= { exercises: [], totalSets: 0 };
  }
}

// Builds a fresh WorkingDay from a "Day ..." row plus the header row right
// after it (if present).
function startNewDay(
  firstCell: string,
  data: unknown[][],
  rowIndex: number,
  selectedColumnIndices: number[] | undefined,
  splits: string[],
): WorkingDay {
  const day: WorkingDay = {
    dayNumber: extractDayNumber(firstCell),
    dayTitle: firstCell,
    muscleGroups: extractMuscleGroups(firstCell),
    exercises: [],
    split: {},
  };

  if (rowIndex + 1 < data.length) {
    const headers = data[rowIndex + 1];
    const colLimit = Math.min(headers.length, MAX_TOTAL_COLUMNS);
    const splitColumns = buildSplitColumnsForDay(
      headers,
      colLimit,
      selectedColumnIndices,
    );
    registerSplitColumns(day, splitColumns, splits);
  }

  return day;
}

function applyTotalSetsRow(day: WorkingDay, row: unknown[]): void {
  day.splitColumns?.forEach(({ index, name }: SplitColumn) => {
    const raw = row[index];
    if (raw === "" || raw === undefined) return;
    const total =
      typeof raw === "number" ? raw : Number.parseInt(cellToString(raw));
    if (!Number.isNaN(total)) day.split[name].totalSets = total;
  });
}

function applyExerciseRow(
  day: WorkingDay,
  row: unknown[],
  firstCell: string,
): void {
  const muscleGroup = cellToString(row[1]);
  const setsByPerson: Record<string, number> = {};

  day.splitColumns?.forEach(({ index, name }: SplitColumn) => {
    const raw = row[index];
    if (raw === "" || raw === undefined) return;
    const sets =
      typeof raw === "number" ? raw : Number.parseInt(cellToString(raw));
    if (Number.isNaN(sets)) return;

    setsByPerson[name] = sets;
    if (sets > 0) {
      day.split[name].exercises.push({ name: firstCell, muscleGroup, sets });
    }
  });

  if (Object.keys(setsByPerson).length > 0) {
    if (!day.exercises) day.exercises = [];
    day.exercises.push({ name: firstCell, muscleGroup, setsByPerson });
  }
}

export async function parseWorkoutFileClient(
  fileUri: string,
  // Column indices the user explicitly picked (via extractSplitColumnCandidates
  // + a picker UI). When provided, these are used as-is instead of the
  // auto contiguous-scan below, for every day in the sheet — the app no
  // longer guesses which columns are splits on the user's behalf.
  selectedColumnIndices?: number[],
): Promise<WorkoutData> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error("File not found");
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("File too large (max 5 MB)");
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, {
    type: "base64",
    sheetRows: MAX_ROWS,
    cellFormula: false,
    cellHTML: false,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  const days: WorkingDay[] = [];
  const splits: string[] = [];
  let currentDay: WorkingDay | null = null;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = cellToString(row[0]).trim();

    if (firstCell.toLowerCase().startsWith("day ")) {
      if (currentDay) days.push(currentDay);
      currentDay = startNewDay(
        firstCell,
        data,
        i,
        selectedColumnIndices,
        splits,
      );
      i++; // skip the header row
      continue;
    }

    if (!currentDay || !firstCell) continue;

    if (firstCell === "Total Sets:") {
      applyTotalSetsRow(currentDay, row);
      continue;
    }

    if (firstCell === "Exercise") continue;

    applyExerciseRow(currentDay, row, firstCell);
  }

  if (currentDay) days.push(currentDay);
  return { days, split: splits };
}

function extractDayNumber(dayTitle: string): number {
  const match = /Day (\d+)/i.exec(dayTitle);
  return match ? Number.parseInt(match[1]) : 0;
}

function extractMuscleGroups(dayTitle: string): string[] {
  const parts = dayTitle.split("—");
  return parts.length > 1 ? parts[1].split("/").map((g) => g.trim()) : [];
}
