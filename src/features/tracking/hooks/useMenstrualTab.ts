import { useState, useCallback, useMemo } from "react";
import { menstrualApi } from "../services";
import type { MenstrualPrefs } from "../services/types";
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from "@shared/services/storage";
import { parseSafeDate, getCycleStartIso, getCycleDuration, computeUpcomingPredictedDays } from "../utils";
import { toDateString } from "@utils/format";

export interface UseMenstrualTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadFromServer: () => Promise<void>;
  user?: { id?: string } | null;
}

export function useMenstrualTab(deps: UseMenstrualTabDeps) {
  const { alert, loadFromServer, user } = deps;

  const [cycleEntries, setCycleEntries] = useState<any[]>([]);
  const [periodOverrides, setPeriodOverrides] = useState<Record<string, number>>({});
  const [menstrualPrefs, setMenstrualPrefs] = useState<MenstrualPrefs>({
    cycleLengthDays: 28,
    periodLengthDays: 5,
  });
  const [newCycleStart, setNewCycleStart] = useState("");
  const [flowIntensity, setFlowIntensity] = useState<"light" | "moderate" | "heavy">("moderate");
  const [cycleSymptoms, setCycleSymptoms] = useState<string[]>([]);

  // Per-day flow modal
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowModalDate, setFlowModalDate] = useState<string | null>(null);
  const [flowModalIntensity, setFlowModalIntensity] = useState<"light" | "moderate" | "heavy">("moderate");
  const [flowModalCycleEntry, setFlowModalCycleEntry] = useState<any>(null);

  // Calendar decorations
  const [cycleActualDays, setCycleActualDays] = useState<Set<string>>(new Set());
  const [cyclePredictedDays, setCyclePredictedDays] = useState<Set<string>>(new Set());
  const [cycleStats, setCycleStats] = useState<any>(null);
  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(new Set());

  const loadMenstrualData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cyclesResp = await menstrualApi.getMenstrualHistory(24);
      const rawCycles = cyclesResp?.data || [];

      const overrides =
        (await loadFromStorage<Record<string, number>>(
          STORAGE_KEYS.MENSTRUAL_PERIOD_OVERRIDES,
          String(user.id),
        )) || {};
      setPeriodOverrides(overrides);
      const cycles = rawCycles
        .map((c: any) =>
          overrides[String(c.id)] ? { ...c, duration_days: overrides[String(c.id)] } : c,
        )
        .sort((a: any, b: any) => {
          const bStart = parseSafeDate(getCycleStartIso(b))?.getTime() ?? 0;
          const aStart = parseSafeDate(getCycleStartIso(a))?.getTime() ?? 0;
          return bStart - aStart;
        });
      setCycleEntries(cycles);

      // Resolved fresh below and used for the actual/predicted day-range math
      // further down instead of the closured `menstrualPrefs` state, which is
      // deliberately excluded from this callback's deps (see note below) and
      // would otherwise stay stuck at whatever it was when the callback was
      // first created — usually the hardcoded default, not the user's setting.
      let currentPrefs = menstrualPrefs;

      try {
        const settingsResp = await menstrualApi.getSettings();
        const settings = settingsResp?.data;
        if (settings) {
          const prefs = {
            cycleLengthDays: settings.cycleLengthDays ?? menstrualPrefs.cycleLengthDays,
            periodLengthDays: settings.periodDays ?? menstrualPrefs.periodLengthDays,
          };
          setMenstrualPrefs(prefs);
          currentPrefs = prefs;
          await saveToStorage(STORAGE_KEYS.MENSTRUAL_PREFS, prefs, String(user.id));
        }
      } catch (e) {
        console.warn("Failed to load menstrual settings from server:", e);
      }

      try {
        const prefs = await loadFromStorage<MenstrualPrefs>(STORAGE_KEYS.MENSTRUAL_PREFS, String(user.id));
        if (prefs) {
          setMenstrualPrefs(prefs);
          currentPrefs = prefs;
        }
      } catch (e) {
        console.warn("Failed to load menstrual prefs", e);
      }

      try {
        const statsResp = await menstrualApi.getCycleStats({
          periodDays: currentPrefs.periodLengthDays,
          cycleLengthDays: currentPrefs.cycleLengthDays,
        });
        const stats = statsResp?.data;
        setCycleStats(stats ?? null);

        const actualSet = new Set<string>();
        const predictedSet = new Set<string>();
        const pd = currentPrefs.periodLengthDays || 5;

        const addRangeToSet = (startDate: Date, length: number, set: Set<string>) => {
          for (let i = 0; i < length; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            set.add(toDateString(d));
          }
        };

        cycles.forEach((c: any) => {
          const startIso = getCycleStartIso(c);
          if (!startIso) return;
          const start = parseSafeDate(startIso);
          if (!start) return;
          addRangeToSet(start, getCycleDuration(c, pd), actualSet);
        });

        const mostRecentStartIso = cycles.length > 0 ? getCycleStartIso(cycles[0]) : null;
        const upcomingPredicted = computeUpcomingPredictedDays(
          mostRecentStartIso,
          currentPrefs.cycleLengthDays,
          pd,
        );
        upcomingPredicted.forEach((d) => predictedSet.add(d));

        setCycleActualDays(actualSet);
        setCyclePredictedDays(predictedSet);
      } catch (e) {
        console.warn("Failed to compute menstrual stats/marks:", e);
        setCycleStats(null);
        setCycleActualDays(new Set());
        setCyclePredictedDays(new Set());
      }
    } catch (e) {
      console.warn("Failed to load menstrual history:", e);
    }
    // menstrualPrefs intentionally excluded: this function itself calls
    // setMenstrualPrefs, so depending on it would re-create the callback
    // every load and re-trigger the effect below forever.
  }, [user]);

  const toggleExpandedCycle = useCallback((id: number | string | null | undefined) => {
    if (id == null) return;
    const key = String(id);
    setExpandedCycleIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const hasCycleData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return cycleEntries.some((c) => {
        const d = c?.cycleStart ?? c?.startDate ?? c?.recorded_at ?? c?.date;
        if (!d) return false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d === dateStr;
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return false;
        return toDateString(parsed) === dateStr;
      });
    },
    [cycleEntries],
  );

  const handleFlowModalConfirm = useCallback(async () => {
    if (!flowModalDate) return;
    try {
      await menstrualApi.setDayFlow(flowModalDate, flowModalIntensity);
      setShowFlowModal(false);
      setFlowModalDate(null);
      setFlowModalCycleEntry(null);
      await loadFromServer();
      alert("Saved", "Flow intensity saved", [{ text: "OK" }], "success");
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [flowModalDate, flowModalIntensity, loadFromServer, alert]);

  const isOnPeriod = useMemo(() => {
    if (cycleEntries.length === 0) return false;
    const latest = cycleEntries[0];
    if (periodOverrides[String(latest.id)]) return false;
    const start = parseSafeDate(getCycleStartIso(latest));
    if (!start) return false;
    const daysSince = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
    return daysSince >= 0 && daysSince < menstrualPrefs.periodLengthDays;
  }, [cycleEntries, periodOverrides, menstrualPrefs.periodLengthDays]);

  const markPeriodOver = useCallback(async () => {
    if (!user?.id || cycleEntries.length === 0) return;
    const latest = cycleEntries[0];
    const start = parseSafeDate(getCycleStartIso(latest));
    if (!start) return;
    const daysSince = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
    const durationDays = Math.max(1, daysSince + 1);
    try {
      const updated = { ...periodOverrides, [String(latest.id)]: durationDays };
      setPeriodOverrides(updated);
      await saveToStorage(STORAGE_KEYS.MENSTRUAL_PERIOD_OVERRIDES, updated, String(user.id));
      await loadMenstrualData();
      alert("Saved", "Period marked as over", [{ text: "OK" }], "success");
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [user, cycleEntries, periodOverrides, loadMenstrualData, alert]);

  const handleDeletePeriod = useCallback(async () => {
    if (!flowModalCycleEntry?.id) return;
    try {
      await menstrualApi.deleteMenstrualEntry(flowModalCycleEntry.id);
      setShowFlowModal(false);
      setFlowModalDate(null);
      setFlowModalCycleEntry(null);
      await loadFromServer();
      alert("Deleted", "Period deleted", [{ text: "OK" }], "success");
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [flowModalCycleEntry, loadFromServer, alert]);

  return {
    cycleEntries, setCycleEntries,
    menstrualPrefs, setMenstrualPrefs,
    newCycleStart, setNewCycleStart,
    flowIntensity, setFlowIntensity,
    cycleSymptoms, setCycleSymptoms,
    showFlowModal, setShowFlowModal,
    flowModalDate, setFlowModalDate,
    flowModalIntensity, setFlowModalIntensity,
    flowModalCycleEntry, setFlowModalCycleEntry,
    cycleActualDays, setCycleActualDays,
    cyclePredictedDays, setCyclePredictedDays,
    cycleStats, setCycleStats,
    expandedCycleIds, setExpandedCycleIds,
    toggleExpandedCycle,
    hasCycleData,
    loadMenstrualData,
    handleFlowModalConfirm,
    handleDeletePeriod,
    isOnPeriod,
    markPeriodOver,
  };
}
