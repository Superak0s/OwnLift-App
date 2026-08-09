import { useState, useCallback, useEffect } from "react";
import { hydrationApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr } from "../utils";
import { toDateString } from "@utils/format";

export interface UseHydrationTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadTabData: () => Promise<void>;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
  buildLocalISOForDate: (d: Date, t?: string) => string;
  activeTab: string;
}

export function useHydrationTab(deps: UseHydrationTabDeps) {
  const { alert, loadTabData, setDayModal, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab } = deps;

  const [hydrationEntries, setHydrationEntries] = useState<any[]>([]);
  const [showHydrationModal, setShowHydrationModal] = useState(false);
  const [newHydrationAmount, setNewHydrationAmount] = useState("");
  const [hydrationGoal, setHydrationGoal] = useState(2000);

  useEffect(() => {
    if (activeTab === "hydration") loadTabData();
  }, [activeTab, loadTabData]);

  const handleDeleteHydration = createDeleteHandler(
    hydrationApi.deleteHydrationEntry,
    setHydrationEntries,
    setDayModal,
    alert,
  );

  const deleteHydrationEntry = useCallback(
    (entry: any) => {
      alert(
        "Delete Entry",
        "Remove this hydration entry?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteHydration(entry) },
        ],
        "warning",
      );
    },
    [alert, handleDeleteHydration],
  );

  const handleLogHydration = useCallback(async () => {
    const amt = parseFloat(newHydrationAmount);
    if (!newHydrationAmount || isNaN(amt))
      return alert("Invalid Input", "Enter a valid amount in ml", [{ text: "OK" }], "error");
    try {
      const recordedAt = selectedLogDate ? buildLocalISOForDate(selectedLogDate, "12:00") : null;
      await hydrationApi.logHydration(amt);
      setNewHydrationAmount("");
      setShowHydrationModal(false);
      setSelectedLogDate(null);
      alert("Success", "Hydration logged!", [{ text: "OK" }], "success");
      loadTabData();
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error");
    }
  }, [newHydrationAmount, selectedLogDate, buildLocalISOForDate, alert, loadTabData, setSelectedLogDate]);

  const hasHydrationData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return hydrationEntries.some((h) => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === dateStr);
    },
    [hydrationEntries],
  );

  return {
    hydrationEntries, setHydrationEntries,
    showHydrationModal, setShowHydrationModal,
    newHydrationAmount, setNewHydrationAmount,
    hydrationGoal, setHydrationGoal,
    handleDeleteHydration,
    deleteHydrationEntry,
    handleLogHydration,
    hasHydrationData,
  };
}
