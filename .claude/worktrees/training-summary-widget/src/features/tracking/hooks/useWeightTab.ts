import { useState, useCallback, useEffect } from "react";
import type { WeightEntry, WeightHistoryResponse, HeightData } from "@shared/types";
import { bodyTrackingApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { toDateString } from "@utils/format";
import { getUserKey as sharedGetUserKey } from "@shared/services/storage";
import { getStorageItem, setStorageItem } from "@shared/services/sqliteStorage";

export interface UseWeightTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadData: () => void;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  buildLocalISOForDate: (d: Date, t?: string) => string;
  user?: { id?: string } | null;
}

export function useWeightTab(deps: UseWeightTabDeps) {
  const { alert, loadData, setDayModal, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, user } = deps;

  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<string>("kg");
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [weightEntriesShown, setWeightEntriesShown] = useState(10);
  const [trendAverageDays, setTrendAverageDays] = useState(7);

  const [height, setHeight] = useState<HeightData | null>(null);
  const [heightUnit, setHeightUnit] = useState<string>("cm");
  const [showHeightModal, setShowHeightModal] = useState(false);
  const [newHeightCm, setNewHeightCm] = useState("");
  const [newHeightFt, setNewHeightFt] = useState("");
  const [newHeightIn, setNewHeightIn] = useState("");

  const getUserKey = (key: string) => sharedGetUserKey(key, user?.id ?? null);

  useEffect(() => {
    (async () => {
      const stored = await getStorageItem(getUserKey("height_cm"));
      const cm = stored ? parseFloat(stored) : NaN;
      if (!isNaN(cm)) setHeight({ height_cm: cm });
    })();
  }, [user?.id]);

  const saveHeight = useCallback(async () => {
    const cm =
      heightUnit === "cm"
        ? parseFloat(newHeightCm)
        : (parseFloat(newHeightFt || "0") * 12 + parseFloat(newHeightIn || "0")) * 2.54;
    if (!cm || isNaN(cm))
      return alert("Invalid Input", "Enter a valid height", [{ text: "OK" }], "error");
    await setStorageItem(getUserKey("height_cm"), String(cm));
    setHeight({ height_cm: cm });
    setNewHeightCm("");
    setNewHeightFt("");
    setNewHeightIn("");
    setShowHeightModal(false);
    alert("Success", "Height saved!", [{ text: "OK" }], "success");
  }, [heightUnit, newHeightCm, newHeightFt, newHeightIn, alert, getUserKey]);

  const handleDeleteWeight = createDeleteHandler(
    bodyTrackingApi.deleteWeightEntry,
    setWeightHistory,
    setDayModal,
    alert,
  );

  const deleteWeightEntry = useCallback(
    (entry: WeightEntry) => {
      const label =
        weightUnit === "kg"
          ? `${Number(entry.weight_kg).toFixed(1)} kg`
          : `${(Number(entry.weight_kg) * 2.20462).toFixed(1)} lbs`;
      alert(
        "Delete Entry",
        `Remove ${label}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteWeight(entry) },
        ],
        "warning",
      );
    },
    [weightUnit, alert, handleDeleteWeight],
  );

  const addWeight = useCallback(async () => {
    if (!newWeight || isNaN(parseFloat(newWeight)))
      return alert("Invalid Input", "Enter a valid weight", [{ text: "OK" }], "error");
    try {
      const recordedAt = selectedLogDate
        ? buildLocalISOForDate(selectedLogDate, "08:00")
        : null;
      await bodyTrackingApi.logWeight(
        parseFloat(newWeight),
        weightUnit as "kg" | "lbs",
        null,
        recordedAt,
      );
      setNewWeight("");
      setShowWeightModal(false);
      setSelectedLogDate(null);
      alert("Success", "Weight logged!", [{ text: "OK" }], "success");
      loadData();
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [newWeight, weightUnit, selectedLogDate, buildLocalISOForDate, alert, loadData, setSelectedLogDate]);

  const getWeightTrend = useCallback(() => {
    if (weightHistory.length < 2) return null;
    const currentWeight = Number(weightHistory[0].weight_kg);
    const compareEntries = weightHistory.slice(1, trendAverageDays + 1);
    if (compareEntries.length === 0) return null;
    const avgWeight =
      compareEntries.reduce((sum, e) => sum + Number(e.weight_kg), 0) /
      compareEntries.length;
    const diff = currentWeight - avgWeight;
    const percentChange = (diff / avgWeight) * 100;
    return {
      diff,
      percentChange,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "stable",
      avgWeight,
      daysCompared: compareEntries.length,
    };
  }, [weightHistory, trendAverageDays]);

  const getWeightChartData = useCallback(() => {
    if (weightHistory.length < 2)
      return { labels: ["No data"], datasets: [{ data: [0] }] };
    const recentEntries = [...weightHistory].slice(0, 30).reverse();
    const maxLabels = 8;
    const labelInterval = Math.ceil(recentEntries.length / maxLabels);
    const labels = recentEntries.map((entry, index) => {
      if (recentEntries.length <= maxLabels || index % labelInterval === 0) {
        return new Date(entry.recorded_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
      return "";
    });
    const data: number[] = recentEntries.map((entry) =>
      weightUnit === "kg"
        ? Number(entry.weight_kg)
        : Number(entry.weight_kg) * 2.20462,
    );
    return { labels, datasets: [{ data }] };
  }, [weightHistory, weightUnit]);

  const loadMoreWeightEntries = useCallback(() => {
    setWeightEntriesShown((prev) => Math.min(prev + 10, weightHistory.length));
  }, [weightHistory.length]);

  const hasWeightData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return weightHistory.some((e) => {
        const d = e?.recorded_at;
        if (!d) return false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d === dateStr;
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return false;
        return toDateString(parsed) === dateStr;
      });
    },
    [weightHistory],
  );

  const openWeightModal = useCallback(() => setShowWeightModal(true), []);

  return {
    weightHistory, setWeightHistory,
    weightUnit, setWeightUnit,
    showWeightModal, setShowWeightModal,
    newWeight, setNewWeight,
    weightEntriesShown, setWeightEntriesShown,
    trendAverageDays, setTrendAverageDays,
    height, setHeight,
    heightUnit, setHeightUnit,
    showHeightModal, setShowHeightModal,
    newHeightCm, setNewHeightCm,
    newHeightFt, setNewHeightFt,
    newHeightIn, setNewHeightIn,
    getUserKey,
    handleDeleteWeight,
    deleteWeightEntry,
    addWeight,
    getWeightTrend,
    getWeightChartData,
    loadMoreWeightEntries,
    hasWeightData,
    openWeightModal,
    saveHeight,
  };
}
