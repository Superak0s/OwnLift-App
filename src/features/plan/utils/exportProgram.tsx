import * as FileSystem from "expo-file-system/legacy"
import * as Sharing from "expo-sharing"
import { Platform } from "react-native"
import type { WorkoutData } from "@shared/types"

export interface ExportedProgram {
  exportedAt: string
  selectedSplit: string | null
  program: WorkoutData
}

export type ExportTarget = "downloads" | "documents" | "ask"

export async function exportProgramData(
  workoutData: WorkoutData | null,
  selectedSplit: string | null,
  target: ExportTarget = "downloads",
): Promise<string | null> {
  if (!workoutData) return null

  const payload: ExportedProgram = {
    exportedAt: new Date().toISOString(),
    selectedSplit,
    program: workoutData,
  }

  const fileName = `workout-program-${Date.now()}.json`

  if (target === "ask") {
    if (
      Platform.OS === "android" &&
      (FileSystem as any).StorageAccessFramework
    ) {
      try {
        const SAF = (FileSystem as any).StorageAccessFramework

        let directoryUri: string | undefined
        if (typeof SAF.requestDirectoryPermissionsAsync === "function") {
          const res = await SAF.requestDirectoryPermissionsAsync()
          directoryUri = res?.directoryUri || res?.uri
        } else if (typeof SAF.requestDirectoryUriAsync === "function") {
          const res = await SAF.requestDirectoryUriAsync()
          directoryUri = res?.uri || res?.directoryUri
        }

        if (directoryUri) {
          const mimeType = "application/json"

          const created = await SAF.createFileAsync(
            directoryUri,
            fileName,
            mimeType,
          )

          await FileSystem.writeAsStringAsync(
            created,
            JSON.stringify(payload, null, 2),
            {
              encoding: FileSystem.EncodingType.UTF8,
            },
          )
          return created
        }
      } catch (err) {
        console.warn("SAF export failed, falling back to share sheet:", err)
      }
    }

    const cacheDir =
      FileSystem.cacheDirectory || FileSystem.documentDirectory || ""
    const filePath = `${cacheDir}${fileName}`
    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(payload, null, 2),
      {
        encoding: FileSystem.EncodingType.UTF8,
      },
    )

    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(filePath, {
        mimeType: "application/json",
        dialogTitle: "Export workout program",
        UTI: "public.json",
      })
    }

    return filePath
  }

  const baseDir =
    target === "downloads"
      ? `${FileSystem.documentDirectory || FileSystem.cacheDirectory}Downloads/`
      : FileSystem.documentDirectory || FileSystem.cacheDirectory || ""

  try {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true })
  } catch (err) {
    console.warn("Could not make directory for export:", err)
  }

  const filePath = `${baseDir}${fileName}`
  await FileSystem.writeAsStringAsync(
    filePath,
    JSON.stringify(payload, null, 2),
    {
      encoding: FileSystem.EncodingType.UTF8,
    },
  )

  return filePath
}
