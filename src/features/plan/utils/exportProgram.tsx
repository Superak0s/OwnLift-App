import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { WorkoutData } from "@shared/types";

export interface ExportedProgram {
  exportedAt: string;
  selectedSplit: string | null;
  program: WorkoutData;
}

export type ExportTarget = "downloads" | "documents" | "ask";

async function writeJson(
  filePath: string,
  payload: ExportedProgram,
): Promise<void> {
  await FileSystem.writeAsStringAsync(
    filePath,
    JSON.stringify(payload, null, 2),
    {
      encoding: FileSystem.EncodingType.UTF8,
    },
  );
}

/**
 * Attempts to save the export via Android's Storage Access Framework,
 * letting the user pick a destination directory. Returns the created file's
 * URI on success, or null if SAF isn't available/usable and the caller
 * should fall back to the share sheet.
 */
async function exportViaSAF(
  fileName: string,
  payload: ExportedProgram,
): Promise<string | null> {
  if (
    Platform.OS !== "android" ||
    !(FileSystem as any).StorageAccessFramework
  ) {
    return null;
  }

  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    const directoryUri = await getSAFDirectoryUri(SAF);
    if (!directoryUri) return null;

    const created = await SAF.createFileAsync(
      directoryUri,
      fileName,
      "application/json",
    );
    await writeJson(created, payload);
    return created;
  } catch (err) {
    console.warn("SAF export failed, falling back to share sheet:", err);
    return null;
  }
}

async function getSAFDirectoryUri(SAF: any): Promise<string | undefined> {
  if (typeof SAF.requestDirectoryPermissionsAsync === "function") {
    const res = await SAF.requestDirectoryPermissionsAsync();
    return res?.directoryUri || res?.uri;
  }
  if (typeof SAF.requestDirectoryUriAsync === "function") {
    const res = await SAF.requestDirectoryUriAsync();
    return res?.uri || res?.directoryUri;
  }
  return undefined;
}

async function exportViaShareSheet(
  fileName: string,
  payload: ExportedProgram,
): Promise<string> {
  const cacheDir =
    FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
  const filePath = `${cacheDir}${fileName}`;
  await writeJson(filePath, payload);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: "application/json",
      dialogTitle: "Export workout program",
      UTI: "public.json",
    });
  }

  return filePath;
}

async function exportToAppDirectory(
  target: Exclude<ExportTarget, "ask">,
  fileName: string,
  payload: ExportedProgram,
): Promise<string> {
  const baseDir =
    target === "downloads"
      ? `${FileSystem.documentDirectory || FileSystem.cacheDirectory}Downloads/`
      : FileSystem.documentDirectory || FileSystem.cacheDirectory || "";

  try {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  } catch (err) {
    console.warn("Could not make directory for export:", err);
  }

  const filePath = `${baseDir}${fileName}`;
  await writeJson(filePath, payload);
  return filePath;
}

export async function exportProgramData(
  workoutData: WorkoutData | null,
  selectedSplit: string | null,
  target: ExportTarget = "downloads",
): Promise<string | null> {
  if (!workoutData) return null;

  const payload: ExportedProgram = {
    exportedAt: new Date().toISOString(),
    selectedSplit,
    program: workoutData,
  };

  const fileName = `workout-program-${Date.now()}.json`;

  if (target === "ask") {
    const safResult = await exportViaSAF(fileName, payload);
    if (safResult) return safResult;
    return exportViaShareSheet(fileName, payload);
  }

  return exportToAppDirectory(target, fileName, payload);
}
