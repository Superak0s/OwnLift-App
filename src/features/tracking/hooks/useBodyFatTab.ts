import { useState, useCallback } from "react";
import { setStorageItem } from "@shared/services/sqliteStorage"
import type { BodyFatEntry } from "@shared/types";
import type { BodyFatEntryWithFields } from "../types";
import { bodyFatApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { toDateString } from "@utils/format";

export interface UseBodyFatTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadData: () => void;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  height: any;
  getUserKey: (key: string) => string;
}

export function useBodyFatTab(deps: UseBodyFatTabDeps) {
  const { alert, loadData, setDayModal, selectedLogDate, setSelectedLogDate, height, getUserKey } = deps;

  const [bodyFatHistory, setBodyFatHistory] = useState<BodyFatEntryWithFields[]>([]);
  const [showBodyFatModal, setShowBodyFatModal] = useState(false);
  const [gender, setGender] = useState("male");
  const [waist, setWaist] = useState("");
  const [neck, setNeck] = useState("");
  const [hip, setHip] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("cm");

  const handleDeleteBodyFat = createDeleteHandler(
    bodyFatApi.deleteBodyFatEntry,
    setBodyFatHistory,
    setDayModal,
    alert,
  );

  const deleteBodyFatEntry = useCallback(
    (entry: BodyFatEntryWithFields) => {
      const pct = entry.percentage ?? (entry as { body_fat_percentage?: number }).body_fat_percentage ?? 0;
      alert(
        "Delete Entry",
        `Remove ${pct}% reading?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteBodyFat(entry) },
        ],
        "warning",
      );
    },
    [alert, handleDeleteBodyFat],
  );

  const calculateBodyFat = useCallback(async () => {
    if (!waist || !neck || (gender === "female" && !hip)) {
      return alert("Missing Data", "Please enter all measurements", [{ text: "OK" }], "error");
    }
    let heightCm = height?.height_cm ? parseFloat(String(height.height_cm)) : null;
    if (!heightCm) {
      return alert(
        "Height Required",
        "Please set your height first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Height",
            onPress: () => {
              setShowBodyFatModal(false);
              // Parent handles showing height modal
            },
          },
        ],
        "warning",
      );
    }
    let waistCm = parseFloat(waist);
    let neckCm = parseFloat(neck);
    let hipCm = hip ? parseFloat(hip) : 0;
    if (measurementUnit === "in") {
      waistCm *= 2.54;
      neckCm *= 2.54;
      hipCm *= 2.54;
    }
    let bodyFatPercentage;
    if (gender === "male") {
      bodyFatPercentage = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
    } else {
      bodyFatPercentage = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
    }
    try {
      const dateStr = selectedLogDate ? toDateString(selectedLogDate) : null;
      await bodyFatApi.logBodyFat(
        parseFloat(bodyFatPercentage.toFixed(1)),
        { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" },
        gender as "male" | "female",
        dateStr,
      );
      setSelectedLogDate(null);
      alert("Body Fat Calculated", `Your body fat is ${bodyFatPercentage.toFixed(1)}%`, [{ text: "OK" }], "success");
      loadData();
    } catch (error) {
      alert("Error", error instanceof Error ? error.message : "An error occurred", [{ text: "OK" }], "error");
    }
  }, [waist, neck, hip, gender, measurementUnit, height, selectedLogDate, alert, loadData, setSelectedLogDate]);

  const hasBodyFatData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return bodyFatHistory.some((b) => {
        const d = b?.date;
        if (!d) return false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d === dateStr;
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return false;
        return toDateString(parsed) === dateStr;
      });
    },
    [bodyFatHistory],
  );

  const openBodyFatModal = useCallback(() => setShowBodyFatModal(true), []);

  const setGenderPersist = useCallback(async (g: string) => {
    setGender(g);
    await setStorageItem(getUserKey("gender"), g);
  }, [getUserKey]);

  return {
    bodyFatHistory, setBodyFatHistory,
    showBodyFatModal, setShowBodyFatModal,
    gender, setGender, setGenderPersist,
    waist, setWaist,
    neck, setNeck,
    hip, setHip,
    measurementUnit, setMeasurementUnit,
    handleDeleteBodyFat,
    deleteBodyFatEntry,
    calculateBodyFat,
    hasBodyFatData,
    openBodyFatModal,
  };
}
