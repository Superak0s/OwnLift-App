import { useState, useCallback, useEffect } from "react";
import { bodyMeasurementsApi } from "../services";
import { customMeasurementsApi } from "../services/on/customMeasurements";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr } from "../utils";
import { toDateString } from "@utils/format";

export interface UseMeasurementsTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadTabData: () => Promise<void>;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  buildLocalISOForDate: (d: Date, t?: string) => string;
  activeTab: string;
}

export function useMeasurementsTab(deps: UseMeasurementsTabDeps) {
  const { alert, loadTabData, setDayModal, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab } = deps;

  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);
  const [customMeasurementEntries, setCustomMeasurementEntries] = useState<any[]>([]);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [newWaist, setNewWaist] = useState("");
  const [newArmLeft, setNewArmLeft] = useState("");
  const [newArmRight, setNewArmRight] = useState("");
  const [newChest, setNewChest] = useState("");
  const [newCustomBodyPart, setNewCustomBodyPart] = useState("");
  const [newCustomBodyPartValue, setNewCustomBodyPartValue] = useState("");

  useEffect(() => {
    if (activeTab === "measurements") loadTabData();
  }, [activeTab, loadTabData]);

  const handleDeleteMeasurement = createDeleteHandler(
    bodyMeasurementsApi.deleteMeasurementEntry,
    setMeasurementHistory,
    setDayModal,
    alert,
  );

  const deleteMeasurementEntry = useCallback(
    (entry: any) => {
      alert(
        "Delete Entry",
        "Remove this measurement?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteMeasurement(entry) },
        ],
        "warning",
      );
    },
    [alert, handleDeleteMeasurement],
  );

  const ensureCustomMeasurementType = async (label: string) => {
    const normalizedLabel = label.trim();
    const keyName = normalizedLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    try {
      return await customMeasurementsApi.createType(keyName, normalizedLabel, "cm");
    } catch (error) {
      const types = await customMeasurementsApi.listTypes();
      const existing = types?.data?.find(
        (type: any) => type.keyName === keyName || type.label.toLowerCase() === normalizedLabel.toLowerCase(),
      );
      if (existing) return existing;
      throw error;
    }
  };

  const handleLogMeasurement = useCallback(async () => {
    const hasStandard = newWaist.trim() !== "" || newArmLeft.trim() !== "" || newArmRight.trim() !== "" || newChest.trim() !== "";
    const hasCustom = newCustomBodyPart.trim() !== "" && newCustomBodyPartValue.trim() !== "";

    if (!hasStandard && !hasCustom)
      return alert("Invalid Input", "Enter at least one measurement or a custom body part", [{ text: "OK" }], "error");
    if (newCustomBodyPartValue.trim() !== "" && isNaN(parseFloat(newCustomBodyPartValue)))
      return alert("Invalid Input", "Enter a valid value for the custom body part", [{ text: "OK" }], "error");

    try {
      const recordedAt = selectedLogDate ? buildLocalISOForDate(selectedLogDate, "08:00") : undefined;
      if (hasStandard) {
        await bodyMeasurementsApi.logMeasurement(
          newWaist ? parseFloat(newWaist) : undefined,
          newArmLeft ? parseFloat(newArmLeft) : undefined,
          newArmRight ? parseFloat(newArmRight) : undefined,
          newChest ? parseFloat(newChest) : undefined,
          recordedAt,
        );
      }
      if (hasCustom) {
        const type = await ensureCustomMeasurementType(newCustomBodyPart);
        await customMeasurementsApi.logValue(type.id, parseFloat(newCustomBodyPartValue), recordedAt);
      }
      setNewWaist("");
      setNewArmLeft("");
      setNewArmRight("");
      setNewChest("");
      setNewCustomBodyPart("");
      setNewCustomBodyPartValue("");
      setShowMeasurementModal(false);
      setSelectedLogDate(null);
      alert("Success", "Measurement logged!", [{ text: "OK" }], "success");
      loadTabData();
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [newWaist, newArmLeft, newArmRight, newChest, newCustomBodyPart, newCustomBodyPartValue, selectedLogDate, buildLocalISOForDate, alert, loadTabData, setSelectedLogDate]);

  const hasMeasurementsData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return measurementHistory.some((m) => isoToLocalDateStr(m?.measuredAt ?? m?.recorded_at) === dateStr);
    },
    [measurementHistory],
  );

  return {
    measurementHistory, setMeasurementHistory,
    customMeasurementEntries, setCustomMeasurementEntries,
    showMeasurementModal, setShowMeasurementModal,
    newWaist, setNewWaist,
    newArmLeft, setNewArmLeft,
    newArmRight, setNewArmRight,
    newChest, setNewChest,
    newCustomBodyPart, setNewCustomBodyPart,
    newCustomBodyPartValue, setNewCustomBodyPartValue,
    handleDeleteMeasurement,
    deleteMeasurementEntry,
    handleLogMeasurement,
    hasMeasurementsData,
  };
}
