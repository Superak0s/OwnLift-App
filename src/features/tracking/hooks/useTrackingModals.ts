import { useState, useCallback } from "react";
import { bodyTrackingApi, macrosTrackingApi, bodyFatApi, menstrualApi, bodyMeasurementsApi, hydrationApi, sorenessApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr, getCycleStartIso, buildLocalISOForDate } from "../utils";
import { toDateString } from "@utils/format";
import type { DayModalState } from "../types";
import type { WeightEntry, MacrosEntry, ProgressPhoto, HeightData } from "@shared/types";
import type { BodyFatEntryWithFields } from "../types";

export interface UseTrackingModalsDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadData: () => Promise<void>;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  activeTab: string;
  weightUnit: string;
  gender: string;
  measurementUnit: string;
  height: HeightData | null;
  getDailyMacrosStats: (date: Date) => any;
  weightHistory: WeightEntry[];
  bodyFatHistory: BodyFatEntryWithFields[];
  measurementHistory: any[];
  hydrationEntries: any[];
  sorenessEntries: any[];
  cycleEntries: any[];
  cycleActualDays: Set<string>;
  getPhotosForDate: (date: Date) => ProgressPhoto[];
  prefetchPhotosForDate: (photos: ProgressPhoto[]) => Promise<void>;
  setWeightHistory: (u: any) => void;
  setMacrosEntries: (u: any) => void;
  setBodyFatHistory: (u: any) => void;
  setMeasurementHistory: (u: any) => void;
  setHydrationEntries: (u: any) => void;
  setSorenessEntries: (u: any) => void;
  setProgressPhotos: (u: any) => void;
  setFlowModalDate: (d: string | null) => void;
  setFlowModalIntensity: (i: "light" | "moderate" | "heavy") => void;
  setFlowModalCycleEntry: (e: any) => void;
  setShowFlowModal: (v: boolean) => void;
  setShowWeightModal: (v: boolean) => void;
  setNewWeight: (v: string) => void;
  setShowMacrosModal: (v: boolean) => void;
  setNewMacrosName: (v: string) => void;
  setNewMacrosProtein: (v: string) => void;
  setNewMacrosCarbs: (v: string) => void;
  setNewMacrosFat: (v: string) => void;
  setNewMacrosCalories: (v: string) => void;
  setNewMacrosError: (v: string) => void;
  setNewMacrosTime: (v: string) => void;
  setShowBodyFatModal: (v: boolean) => void;
  setWaist: (v: string) => void;
  setNeck: (v: string) => void;
  setHip: (v: string) => void;
  setShowMeasurementModal: (v: boolean) => void;
  setNewWaist: (v: string) => void;
  setNewArmLeft: (v: string) => void;
  setNewArmRight: (v: string) => void;
  setNewChest: (v: string) => void;
  setNewHydrationAmount: (v: string) => void;
  openHydrationModal: () => void;
  openSorenessModal: () => void;
  openCycleModal: () => void;
  setNewCycleStart: (v: string) => void;
  setFlowIntensity: (i: "light" | "moderate" | "heavy") => void;
  setCycleSymptoms: (s: string[]) => void;
  takePhoto: () => Promise<void>;
  pickPhotoFromGallery: () => Promise<void>;
  pickPhotoForDate: (date: Date) => Promise<void>;
}

export function useTrackingModals(deps: UseTrackingModalsDeps) {
  const {
    alert, loadData, setSelectedLogDate,
    weightUnit, gender, measurementUnit, height,
    getDailyMacrosStats, weightHistory, bodyFatHistory, measurementHistory,
    hydrationEntries, sorenessEntries, cycleEntries, cycleActualDays,
    getPhotosForDate, prefetchPhotosForDate,
    setWeightHistory, setMacrosEntries, setBodyFatHistory, setMeasurementHistory,
    setHydrationEntries, setSorenessEntries, setProgressPhotos,
    setFlowModalDate, setFlowModalIntensity, setFlowModalCycleEntry, setShowFlowModal,
    setShowWeightModal, setNewWeight, setShowMacrosModal, setNewMacrosName,
    setNewMacrosProtein, setNewMacrosCarbs, setNewMacrosFat, setNewMacrosCalories,
    setNewMacrosError, setNewMacrosTime, setShowBodyFatModal, setWaist, setNeck, setHip,
    setShowMeasurementModal, setNewWaist, setNewArmLeft, setNewArmRight, setNewChest,
    setNewHydrationAmount, openHydrationModal, openSorenessModal, openCycleModal,
    setNewCycleStart, setFlowIntensity, setCycleSymptoms,
    takePhoto, pickPhotoFromGallery, pickPhotoForDate,
  } = deps;

  const [dayModal, setDayModal] = useState<DayModalState | null>(null);
  const [pastWeight, setPastWeight] = useState("");
  const [pastMacrosName, setPastMacrosName] = useState("");
  const [pastMacrosProtein, setPastMacrosProtein] = useState("");
  const [pastMacrosCarbs, setPastMacrosCarbs] = useState("");
  const [pastMacrosFat, setPastMacrosFat] = useState("");
  const [pastMacrosCalories, setPastMacrosCalories] = useState("");
  const [pastMacrosTime, setPastMacrosTime] = useState("12:00");
  const [pastMacrosError, setPastMacrosError] = useState("5");
  const [pastWaist, setPastWaist] = useState("");
  const [pastNeck, setPastNeck] = useState("");
  const [pastHip, setPastHip] = useState("");
  const [pastGender, setPastGender] = useState("male");
  const [pastMeasurementUnit, setPastMeasurementUnit] = useState("cm");

  const resetDayModalFields = useCallback(() => {
    setPastWeight("");
    setPastMacrosName("");
    setPastMacrosProtein("");
    setPastMacrosCarbs("");
    setPastMacrosFat("");
    setPastMacrosCalories("");
    setPastMacrosTime("12:00");
    setPastMacrosError("5");
    setPastWaist("");
    setPastNeck("");
    setPastHip("");
    setPastGender(gender);
    setPastMeasurementUnit(measurementUnit);
  }, [gender, measurementUnit]);

  const handleCalendarDatePress = useCallback(
    async (date: Date, tab: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pressedDate = new Date(date);
      pressedDate.setHours(0, 0, 0, 0);
      const isToday = pressedDate.getTime() === today.getTime();

      resetDayModalFields();
      setSelectedLogDate(date);

      const dateStr = toDateString(date);
      let existingEntries = null;

      const tabEntryFetcher: Record<string, () => any[]> = {
        weight: () => weightHistory.filter((e) => isoToLocalDateStr(e?.recorded_at) === dateStr),
        macros: () => getDailyMacrosStats(date)?.entriesList || [],
        photos: () => {
          const p = getPhotosForDate(date);
          if (p.length) prefetchPhotosForDate(p);
          return p;
        },
        bodyfat: () => {
          const b = bodyFatHistory.find((x) => isoToLocalDateStr(x?.date) === dateStr);
          return b ? [b] : [];
        },
        measurements: () =>
          measurementHistory.filter(
            (m) => isoToLocalDateStr(m?.measuredAt ?? m?.recorded_at) === dateStr,
          ),
        hydration: () =>
          hydrationEntries.filter(
            (h) => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === dateStr,
          ),
        soreness: () =>
          sorenessEntries.filter(
            (s) => isoToLocalDateStr(s?.loggedAt ?? s?.recorded_at ?? s?.date) === dateStr,
          ),
      };
      const fetcher = tabEntryFetcher[tab];
      if (fetcher) {
        const entries = fetcher();
        if (entries.length > 0) existingEntries = entries;
      }

      if (tab === "menstrual") {
        if (cycleActualDays.has(dateStr)) {
          try {
            const resp = await menstrualApi.getDayFlow(dateStr);
            const entry = resp?.data || null;
            const matchingCycle = cycleEntries.find(
              (c) => isoToLocalDateStr(getCycleStartIso(c)) === dateStr,
            );
            setFlowModalDate(dateStr);
            setFlowModalIntensity((entry && entry.intensity) || "moderate");
            setFlowModalCycleEntry(matchingCycle ?? null);
            setShowFlowModal(true);
            setDayModal(null);
            return;
          } catch (e) {
            console.warn("Failed to fetch day flow:", e);
          }
        }
      }

      setDayModal({ date, tab, existingEntries, isToday });
    },
    [
      resetDayModalFields, setSelectedLogDate, weightHistory, getDailyMacrosStats,
      getPhotosForDate, prefetchPhotosForDate, bodyFatHistory, measurementHistory,
      hydrationEntries, sorenessEntries, cycleActualDays, cycleEntries,
      setFlowModalDate, setFlowModalIntensity, setFlowModalCycleEntry, setShowFlowModal,
    ],
  );

  const openLogModalForTab = useCallback(
    (tab: string) => {
      setDayModal(null);
      switch (tab) {
        case "weight":
          setNewWeight("");
          setShowWeightModal(true);
          break;
        case "macros":
          setNewMacrosName("");
          setNewMacrosProtein("");
          setNewMacrosCarbs("");
          setNewMacrosFat("");
          setNewMacrosCalories("");
          setNewMacrosError("5");
          setNewMacrosTime(new Date().toTimeString().slice(0, 5));
          setShowMacrosModal(true);
          break;
        case "photos":
          alert(
            "Add Photo",
            "Choose a source",
            [
              { text: "Camera", onPress: takePhoto },
              { text: "Gallery", onPress: pickPhotoFromGallery },
              { text: "Cancel", style: "cancel" },
            ],
            "info",
          );
          break;
        case "bodyfat":
          setWaist("");
          setNeck("");
          setHip("");
          setShowBodyFatModal(true);
          break;
        case "measurements":
          setNewWaist("");
          setNewArmLeft("");
          setNewArmRight("");
          setNewChest("");
          setShowMeasurementModal(true);
          break;
        case "hydration":
          setNewHydrationAmount("");
          openHydrationModal();
          break;
        case "soreness":
          openSorenessModal();
          break;
        case "menstrual":
          setNewCycleStart("");
          setFlowIntensity("moderate");
          setCycleSymptoms([]);
          openCycleModal();
          break;
      }
    },
    [
      alert, takePhoto, pickPhotoFromGallery, gender, measurementUnit,
      setNewWeight, setShowWeightModal, setNewMacrosName, setNewMacrosProtein,
      setNewMacrosCarbs, setNewMacrosFat, setNewMacrosCalories, setNewMacrosError,
      setNewMacrosTime, setShowMacrosModal, setWaist, setNeck, setHip, setShowBodyFatModal,
      setNewWaist, setNewArmLeft, setNewArmRight, setNewChest, setShowMeasurementModal,
      setNewHydrationAmount, openHydrationModal, openSorenessModal,
      setNewCycleStart, setFlowIntensity, setCycleSymptoms, openCycleModal,
    ],
  );

  const submitPastDayEntry = useCallback(
    async () => {
      if (!dayModal) return;
      const { date, tab } = dayModal;

      try {
        if (tab === "weight") {
          if (!pastWeight || isNaN(parseFloat(pastWeight)))
            return alert("Invalid Input", "Enter a valid weight", [{ text: "OK" }], "error");
          const recordedAt = buildLocalISOForDate(date, "08:00");
          await bodyTrackingApi.logWeight(parseFloat(pastWeight), weightUnit as "kg" | "lbs", null, recordedAt);
          alert("Logged", "Weight entry added", [{ text: "OK" }], "success");
        }

        if (tab === "macros") {
          const protein = pastMacrosProtein !== "" ? parseFloat(pastMacrosProtein) : undefined;
          const carbs = pastMacrosCarbs !== "" ? parseFloat(pastMacrosCarbs) : undefined;
          const fat = pastMacrosFat !== "" ? parseFloat(pastMacrosFat) : undefined;
          const calories = pastMacrosCalories !== "" ? parseFloat(pastMacrosCalories) : undefined;
          const hasValue = protein != null || carbs != null || fat != null || calories != null;
          if (!hasValue && !pastMacrosName.trim())
            return alert("Nothing to log", "Enter at least a name or one macro value", [{ text: "OK" }], "warning");
          await macrosTrackingApi.logMacros({
            name: pastMacrosName.trim() || undefined,
            protein, carbs, fat, calories,
            errorMargin: parseFloat(pastMacrosError) || 0,
            time: pastMacrosTime,
            date: toDateString(date),
          });
          alert("Logged", "Macros entry added", [{ text: "OK" }], "success");
        }

        if (tab === "photos") {
          setDayModal(null);
          await pickPhotoForDate(date);
          return;
        }

        if (tab === "bodyfat") {
          if (!pastWaist || !pastNeck || (pastGender === "female" && !pastHip))
            return alert("Missing Data", "Please enter all measurements", [{ text: "OK" }], "error");
          let heightCm = height?.height_cm ? parseFloat(String(height.height_cm)) : null;
          if (!heightCm)
            return alert("Height Required", "Set your height in the Body Fat tab first.", [{ text: "OK" }], "warning");
          let waistCm = parseFloat(pastWaist);
          let neckCm = parseFloat(pastNeck);
          let hipCm = pastHip ? parseFloat(pastHip) : 0;
          if (pastMeasurementUnit === "in") {
            waistCm *= 2.54;
            neckCm *= 2.54;
            hipCm *= 2.54;
          }
          let pct: number;
          if (pastGender === "male") {
            pct = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
          } else {
            pct = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
          }
          const dateIso = buildLocalISOForDate(date);
          await bodyFatApi.logBodyFat(parseFloat(pct.toFixed(1)), { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" }, pastGender as "male" | "female", dateIso);
          alert("Logged", `Body fat ${pct.toFixed(1)}% added`, [{ text: "OK" }], "success");
        }

        setDayModal(null);
        loadData();
      } catch (err) {
        alert("Error", err instanceof Error ? err.message : "Failed to save entry", [{ text: "OK" }], "error");
      }
    },
    [dayModal, pastWeight, weightUnit, pastMacrosName, pastMacrosProtein, pastMacrosCarbs, pastMacrosFat, pastMacrosCalories, pastMacrosError, pastMacrosTime, pastWaist, pastNeck, pastHip, pastGender, pastMeasurementUnit, height, pickPhotoForDate, loadData, alert],
  );

  const confirmDelete = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onConfirm }], "warning");
    },
    [alert],
  );

  const handleDeleteWeight = createDeleteHandler<WeightEntry>(
    bodyTrackingApi.deleteWeightEntry, setWeightHistory, setDayModal, alert,
  );

  const handleDeleteMacro = createDeleteHandler<MacrosEntry>(
    macrosTrackingApi.deleteMacrosEntry, setMacrosEntries, setDayModal, alert,
  );

  const handleDeletePhoto = createDeleteHandler<ProgressPhoto>(
    bodyTrackingApi.deleteProgressPhoto, setProgressPhotos, setDayModal, alert,
  );

  const handleDeleteBodyFat = createDeleteHandler<BodyFatEntryWithFields>(
    bodyFatApi.deleteBodyFatEntry, setBodyFatHistory, setDayModal, alert,
  );

  const handleDeleteMeasurement = createDeleteHandler<any>(
    bodyMeasurementsApi.deleteMeasurementEntry, setMeasurementHistory, setDayModal, alert,
  );

  const handleDeleteHydration = createDeleteHandler<any>(
    hydrationApi.deleteHydrationEntry, setHydrationEntries, setDayModal, alert,
  );

  const handleDeleteSoreness = createDeleteHandler<any>(
    sorenessApi.deleteSorenessEntry, setSorenessEntries, setDayModal, alert,
  );

  const deleteWeightEntry = useCallback(
    (entry: WeightEntry) => {
      const label = weightUnit === "kg"
        ? `${Number(entry.weight_kg).toFixed(1)} kg`
        : `${(Number(entry.weight_kg) * 2.20462).toFixed(1)} lbs`;
      confirmDelete("Delete Entry", `Remove ${label}?`, () => handleDeleteWeight(entry));
    },
    [weightUnit, confirmDelete, handleDeleteWeight],
  );

  const deleteMacroEntry = useCallback(
    (entry: MacrosEntry) => {
      confirmDelete("Delete Entry", entry.name ? `Remove "${entry.name}"?` : "Remove this entry?", () => handleDeleteMacro(entry));
    },
    [confirmDelete, handleDeleteMacro],
  );

  const deletePhoto = useCallback(
    (photo: ProgressPhoto) => {
      confirmDelete("Delete Photo", "Permanently delete this progress photo?", () => handleDeletePhoto(photo));
    },
    [confirmDelete, handleDeletePhoto],
  );

  const deleteBodyFatEntry = useCallback(
    (entry: BodyFatEntryWithFields) => {
      const pct = entry.percentage ?? (entry as any).body_fat_percentage ?? 0;
      confirmDelete("Delete Entry", `Remove ${pct}% reading?`, () => handleDeleteBodyFat(entry));
    },
    [confirmDelete, handleDeleteBodyFat],
  );

  const deleteMeasurementEntry = useCallback(
    (entry: any) => confirmDelete("Delete Entry", "Remove this measurement?", () => handleDeleteMeasurement(entry)),
    [confirmDelete, handleDeleteMeasurement],
  );

  const deleteHydrationEntry = useCallback(
    (entry: any) => confirmDelete("Delete Entry", "Remove this hydration entry?", () => handleDeleteHydration(entry)),
    [confirmDelete, handleDeleteHydration],
  );

  const deleteSorenessEntry = useCallback(
    (entry: any) => confirmDelete("Delete Entry", "Remove this soreness entry?", () => handleDeleteSoreness(entry)),
    [confirmDelete, handleDeleteSoreness],
  );

  return {
    dayModal, setDayModal,
    pastWeight, setPastWeight,
    pastMacrosName, setPastMacrosName,
    pastMacrosProtein, setPastMacrosProtein,
    pastMacrosCarbs, setPastMacrosCarbs,
    pastMacrosFat, setPastMacrosFat,
    pastMacrosCalories, setPastMacrosCalories,
    pastMacrosTime, setPastMacrosTime,
    pastMacrosError, setPastMacrosError,
    pastWaist, setPastWaist,
    pastNeck, setPastNeck,
    pastHip, setPastHip,
    pastGender, setPastGender,
    pastMeasurementUnit, setPastMeasurementUnit,
    resetDayModalFields,
    handleCalendarDatePress,
    openLogModalForTab,
    submitPastDayEntry,
    confirmDelete,
    handleDeleteWeight,
    handleDeleteMacro,
    handleDeletePhoto,
    handleDeleteBodyFat,
    handleDeleteMeasurement,
    handleDeleteHydration,
    handleDeleteSoreness,
    deleteWeightEntry,
    deleteMacroEntry,
    deletePhoto,
    deleteBodyFatEntry,
    deleteMeasurementEntry,
    deleteHydrationEntry,
    deleteSorenessEntry,
  };
}
