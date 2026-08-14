import { useState, useCallback, useEffect } from "react";
import type { MacrosEntry } from "@shared/types";
import type { MacrosEntryWithFields, SavedMacroFood } from "../types";
import { macrosTrackingApi } from "../services";
import { createDeleteHandler } from "../helpers";
import { isoToLocalDateStr } from "../utils";
import { toDateString } from "@utils/format";
import { generateId } from "@utils/format";
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from "@shared/services/storage";
import { useAuth } from "@shared/context/AuthContext";

export interface UseMacrosTabDeps {
  alert: (t: string, m: string, b?: any[], type?: any) => void;
  loadData: () => void;
  setDayModal: (updater: (prev: any) => any) => void;
  selectedLogDate: Date | null;
  setSelectedLogDate: (d: Date | null) => void;
}

export function useMacrosTab(deps: UseMacrosTabDeps) {
  const { alert, loadData, setDayModal, selectedLogDate, setSelectedLogDate } = deps;
  const { user } = useAuth();

  const [macrosEntries, setMacrosEntries] = useState<MacrosEntryWithFields[]>([]);
  const [savedFoods, setSavedFoods] = useState<SavedMacroFood[]>([]);
  const [rememberMacrosEntry, setRememberMacrosEntry] = useState(false);
  const [dailyMacrosGoals, setDailyMacrosGoals] = useState({
    protein: 150,
    carbs: 250,
    fat: 65,
    calories: 2000,
  });
  const [showMacrosModal, setShowMacrosModal] = useState(false);
  const [newMacrosProtein, setNewMacrosProtein] = useState("");
  const [newMacrosCarbs, setNewMacrosCarbs] = useState("");
  const [newMacrosFat, setNewMacrosFat] = useState("");
  const [newMacrosCalories, setNewMacrosCalories] = useState("");
  const [newMacrosTime, setNewMacrosTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [newMacrosError, setNewMacrosError] = useState("5");
  const [newMacrosName, setNewMacrosName] = useState("");
  const [showMacrosGoalModal, setShowMacrosGoalModal] = useState(false);
  const [macrosGoalInput, setMacrosGoalInput] = useState({
    protein: "",
    carbs: "",
    fat: "",
    calories: "",
  });

  useEffect(() => {
    loadFromStorage<SavedMacroFood[]>(STORAGE_KEYS.MACROS_SAVED_FOODS, user?.id ?? null).then(
      (saved) => setSavedFoods(saved ?? []),
    );
  }, [user?.id]);

  const handleDeleteMacro = createDeleteHandler(
    macrosTrackingApi.deleteMacrosEntry,
    setMacrosEntries,
    setDayModal,
    alert,
    () => loadData(),
  );

  const deleteMacroEntry = useCallback(
    (entry: MacrosEntry) => {
      alert(
        "Delete Entry",
        entry.name ? `Remove "${entry.name}"?` : "Remove this entry?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDeleteMacro(entry) },
        ],
        "warning",
      );
    },
    [alert, handleDeleteMacro],
  );

  const addMacrosEntry = useCallback(async () => {
    const protein = newMacrosProtein !== "" ? parseFloat(newMacrosProtein) : undefined;
    const carbs = newMacrosCarbs !== "" ? parseFloat(newMacrosCarbs) : undefined;
    const fat = newMacrosFat !== "" ? parseFloat(newMacrosFat) : undefined;
    const calories = newMacrosCalories !== "" ? parseFloat(newMacrosCalories) : undefined;

    const hasValue = protein != null || carbs != null || fat != null || calories != null;
    if (!hasValue && !newMacrosName.trim()) {
      return alert("Nothing to log", "Enter at least a name or one value", [{ text: "OK" }], "warning");
    }

    try {
      const dateStr = selectedLogDate ? toDateString(selectedLogDate) : null;
      const errorMargin = parseFloat(newMacrosError) || 0;
      await macrosTrackingApi.logMacros({
        name: newMacrosName.trim() || undefined,
        protein,
        carbs,
        fat,
        calories,
        errorMargin,
        time: newMacrosTime,
        date: dateStr,
      });

      if (rememberMacrosEntry && newMacrosName.trim()) {
        const food: SavedMacroFood = {
          id: generateId(),
          name: newMacrosName.trim(),
          protein,
          carbs,
          fat,
          calories,
          errorMargin,
        };
        const next = [food, ...savedFoods.filter((f) => f.name !== food.name)];
        setSavedFoods(next);
        saveToStorage(STORAGE_KEYS.MACROS_SAVED_FOODS, next, user?.id ?? null);
      }

      setNewMacrosName("");
      setNewMacrosProtein("");
      setNewMacrosCarbs("");
      setNewMacrosFat("");
      setNewMacrosCalories("");
      setNewMacrosError("5");
      setNewMacrosTime(new Date().toTimeString().slice(0, 5));
      setRememberMacrosEntry(false);
      setShowMacrosModal(false);
      setSelectedLogDate(null);
      alert("Logged", "Macros logged!", [{ text: "OK" }], "success");
      loadData();
    } catch (error) {
      alert("Error", error instanceof Error ? error.message : "An error occurred", [{ text: "OK" }], "error");
    }
  }, [newMacrosName, newMacrosProtein, newMacrosCarbs, newMacrosFat, newMacrosCalories, newMacrosTime, newMacrosError, rememberMacrosEntry, savedFoods, user?.id, selectedLogDate, alert, loadData, setSelectedLogDate]);

  const quickLogSavedFood = useCallback(
    async (food: SavedMacroFood) => {
      try {
        await macrosTrackingApi.logMacros({
          name: food.name,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          calories: food.calories,
          errorMargin: food.errorMargin ?? 0,
          time: new Date().toTimeString().slice(0, 5),
          date: selectedLogDate ? toDateString(selectedLogDate) : null,
        });
        setShowMacrosModal(false);
        setSelectedLogDate(null);
        alert("Logged", `${food.name} logged!`, [{ text: "OK" }], "success");
        loadData();
      } catch (error) {
        alert("Error", error instanceof Error ? error.message : "An error occurred", [{ text: "OK" }], "error");
      }
    },
    [selectedLogDate, alert, loadData, setSelectedLogDate],
  );

  const removeSavedFood = useCallback(
    (id: string) => {
      const next = savedFoods.filter((f) => f.id !== id);
      setSavedFoods(next);
      saveToStorage(STORAGE_KEYS.MACROS_SAVED_FOODS, next, user?.id ?? null);
    },
    [savedFoods, user?.id],
  );

  const getDailyMacrosStats = useCallback((date: Date) => {
    const dateStr = toDateString(date);
    const entries = macrosEntries.filter(
      (e) => isoToLocalDateStr(e.date ?? e.logged_at) === dateStr,
    );
    if (entries.length === 0) return null;
    const normed = entries.map((e: MacrosEntryWithFields) => ({
      id: e.id,
      name: e.name,
      date: e.date ?? e.logged_at,
      protein: e.protein != null ? parseFloat(String(e.protein)) : null,
      carbs: e.carbs != null ? parseFloat(String(e.carbs)) : null,
      fat: e.fat != null ? parseFloat(String(e.fat)) : null,
      calories: e.calories != null ? parseFloat(String(e.calories)) : null,
      errorMargin: parseFloat(String(e.errorMargin ?? e.error_margin ?? 0)) || 0,
    }));
    type NormedEntry = (typeof normed)[0];
    const sumField = (field: keyof NormedEntry) =>
      normed.reduce((s, e) => {
        const v = e[field];
        return v != null && typeof v === "number" ? s + v : s;
      }, 0);
    const hasAny = (field: keyof NormedEntry) =>
      normed.some((e) => e[field] != null);
    const avgError = normed.reduce((s, e) => s + e.errorMargin, 0) / normed.length;
    const makeStat = (field: keyof NormedEntry, goal: number | null) => {
      if (!hasAny(field)) return null;
      const total = sumField(field);
      return {
        total,
        min: total * (1 - avgError / 100),
        max: total * (1 + avgError / 100),
        goal,
        percentage: goal != null && goal > 0 ? (total / goal) * 100 : 0,
      };
    };
    return {
      protein: makeStat("protein", dailyMacrosGoals.protein),
      carbs: makeStat("carbs", dailyMacrosGoals.carbs),
      fat: makeStat("fat", dailyMacrosGoals.fat),
      calories: makeStat("calories", dailyMacrosGoals.calories),
      entries: normed.length,
      entriesList: normed,
    };
  }, [macrosEntries, dailyMacrosGoals]);

  const updateMacrosGoals = useCallback(async () => {
    const protein = parseFloat(macrosGoalInput.protein);
    const carbs = parseFloat(macrosGoalInput.carbs);
    const fat = parseFloat(macrosGoalInput.fat);
    const calories = parseFloat(macrosGoalInput.calories);
    if (isNaN(protein) || protein <= 0 || isNaN(carbs) || carbs <= 0 || isNaN(fat) || fat <= 0 || isNaN(calories) || calories <= 0) {
      return alert("Invalid Input", "Please enter valid goals", [{ text: "OK" }], "error");
    }
    try {
      await macrosTrackingApi.setMacrosGoals({ protein, carbs, fat, calories });
      setDailyMacrosGoals({ protein, carbs, fat, calories });
      setShowMacrosGoalModal(false);
    } catch (error) {
      alert("Error", error instanceof Error ? error.message : "An error occurred", [{ text: "OK" }], "error");
    }
  }, [macrosGoalInput, alert]);

  const hasMacrosData = useCallback(
    (date: Date) => {
      const dateStr = toDateString(date);
      return macrosEntries.some((e) => isoToLocalDateStr(e.date ?? e.logged_at) === dateStr);
    },
    [macrosEntries],
  );

  const openMacrosModal = useCallback(() => setShowMacrosModal(true), []);

  return {
    macrosEntries, setMacrosEntries,
    dailyMacrosGoals, setDailyMacrosGoals,
    showMacrosModal, setShowMacrosModal,
    newMacrosProtein, setNewMacrosProtein,
    newMacrosCarbs, setNewMacrosCarbs,
    newMacrosFat, setNewMacrosFat,
    newMacrosCalories, setNewMacrosCalories,
    newMacrosTime, setNewMacrosTime,
    newMacrosError, setNewMacrosError,
    newMacrosName, setNewMacrosName,
    showMacrosGoalModal, setShowMacrosGoalModal,
    macrosGoalInput, setMacrosGoalInput,
    handleDeleteMacro,
    deleteMacroEntry,
    addMacrosEntry,
    getDailyMacrosStats,
    updateMacrosGoals,
    hasMacrosData,
    openMacrosModal,
    savedFoods,
    rememberMacrosEntry, setRememberMacrosEntry,
    quickLogSavedFood,
    removeSavedFood,
  };
}
