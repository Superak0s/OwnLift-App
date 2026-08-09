import { useState, useCallback, useEffect } from "react";
import { sorenessApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr } from "../utils";
import { toDateString } from "@utils/format";

export interface UseSorenessTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadTabData: () => Promise<void>;
  setDayModal: (updater: (prev: any) => any) => void;
  activeTab: string;
}

export function useSorenessTab(deps: UseSorenessTabDeps) {
  const { alert, loadTabData, setDayModal, activeTab } = deps;

  const [sorenessEntries, setSorenessEntries] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "soreness") loadTabData();
  }, [activeTab, loadTabData]);

  const handleDeleteSoreness = createDeleteHandler(
    sorenessApi.deleteSorenessEntry,
    setSorenessEntries,
    setDayModal,
    alert,
  );

  const deleteSorenessEntry = useCallback(
    (entry: any) => {
      alert(
        "Delete Entry",
        "Remove this soreness entry?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteSoreness(entry) },
        ],
        "warning",
      );
    },
    [alert, handleDeleteSoreness],
  );

  const hasSorenessData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return sorenessEntries.some((s) => isoToLocalDateStr(s?.loggedAt ?? s?.recorded_at ?? s?.date) === dateStr);
    },
    [sorenessEntries],
  );

  return {
    sorenessEntries, setSorenessEntries,
    handleDeleteSoreness,
    deleteSorenessEntry,
    hasSorenessData,
  };
}
