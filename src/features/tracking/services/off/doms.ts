import { createRecordStore } from "@shared/services/offlineHelpers";
import type {
  ActiveSoreness,
  DOMSStats,
  LogSorenessParams,
  UpdateSorenessParams,
} from "../../types/muscleRecovery";
import type { ApiResponse } from "../types";

const STORAGE_KEY = "@off_active_soreness";

const store = createRecordStore<ActiveSoreness>(
  "doms_soreness",
  STORAGE_KEY,
  (e) => e.id,
  (e) => e.loggedAt,
);

async function readEntries(): Promise<ActiveSoreness[]> {
  return store.getAll();
}

let idCounter = Date.now();
function nextId(): number {
  return ++idCounter;
}

export const domsApi = {
  logSoreness: async (params: LogSorenessParams): Promise<ApiResponse<ActiveSoreness>> => {
    const entries = await readEntries();
    if (entries.some((e) => e.muscleGroup === params.muscleGroup && e.status !== "recovered")) {
      throw new Error(`Active soreness already exists for ${params.muscleGroup}. Update it or mark it recovered first.`);
    }
    const now = new Date().toISOString();
    const entry: ActiveSoreness = {
      id: nextId(),
      muscleGroup: params.muscleGroup,
      intensity: params.intensity,
      notes: params.notes || undefined,
      loggedAt: now,
      updatedAt: now,
      status: "active",
      followUps: [],
    };
    await store.put(entry);
    return { success: true, data: entry };
  },

  getActiveSoreness: async (): Promise<ApiResponse<ActiveSoreness[]>> => {
    const entries = await readEntries();
    const active = entries
      .filter((e) => e.status !== "recovered")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: active };
  },

  updateSoreness: async (params: UpdateSorenessParams): Promise<ApiResponse<ActiveSoreness>> => {
    const entries = await readEntries();
    const entry = entries.find((e) => e.id === params.sorenessId);
    if (!entry) throw new Error("Active soreness not found");
    const now = new Date().toISOString();
    entry.intensity = params.intensity;
    entry.status = params.status === "recovered" ? "recovered" : params.status === "better" ? "recovering" : "active";
    entry.updatedAt = now;
    if (params.status === "recovered" && !entry.recoveredAt) entry.recoveredAt = now;
    if (params.notes) entry.notes = params.notes;
    entry.followUps = [
      ...entry.followUps,
      { id: nextId(), sorenessId: entry.id, intensity: params.intensity, status: params.status, notes: params.notes, updatedAt: now },
    ];
    await store.put(entry);
    return { success: true, data: entry };
  },

  batchFollowUp: async (
    updates: Array<{ sorenessId: number; intensity: number; status: "still_sore" | "better" | "recovered"; notes?: string }>,
  ): Promise<ApiResponse<ActiveSoreness[]>> => {
    const results: ActiveSoreness[] = [];
    for (const update of updates) {
      const result = await domsApi.updateSoreness(update);
      results.push(result.data as ActiveSoreness);
    }
    return { success: true, data: results };
  },

  getHistoryByMuscle: async (muscle: string): Promise<ApiResponse<ActiveSoreness[]>> => {
    const entries = await readEntries();
    const filtered = entries
      .filter((e) => e.muscleGroup === muscle)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    return { success: true, data: filtered };
  },

  getStats: async (days: number = 30): Promise<ApiResponse<DOMSStats>> => {
    const entries = await readEntries();
    const cutoff = Date.now() - days * 86400000;
    const active = entries.filter((e) => e.status !== "recovered");
    const recovered = entries.filter((e) => e.status === "recovered" && e.recoveredAt);
    const avgRecoveryDays = recovered.length
      ? recovered.reduce((sum, e) => sum + (new Date(e.recoveredAt!).getTime() - new Date(e.loggedAt).getTime()) / 86400000, 0) / recovered.length
      : 0;
    const mostSore = [...active].sort((a, b) => b.intensity - a.intensity)[0] ?? null;
    const recent = entries.filter((e) => new Date(e.loggedAt).getTime() >= cutoff);
    const heatmapData: Record<string, number> = {};
    recent.forEach((e) => {
      heatmapData[e.muscleGroup] = (heatmapData[e.muscleGroup] ?? 0) + 1;
    });
    const trendByDate: Record<string, number[]> = {};
    recent.forEach((e) => {
      const date = e.loggedAt.slice(0, 10);
      (trendByDate[date] ??= []).push(e.intensity);
    });
    const severityTrend = Object.entries(trendByDate)
      .map(([date, intensities]) => ({
        date,
        averageIntensity: parseFloat((intensities.reduce((s, v) => s + v, 0) / intensities.length).toFixed(1)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        totalActiveSoreness: active.length,
        totalRecoveryEpisodes: recovered.length,
        averageRecoveryDays: parseFloat(avgRecoveryDays.toFixed(1)),
        mostSoreMuscle: mostSore?.muscleGroup ?? null,
        muscleRecoveryStats: [],
        severityTrend,
        heatmapData: heatmapData as DOMSStats["heatmapData"],
      },
    };
  },
};
