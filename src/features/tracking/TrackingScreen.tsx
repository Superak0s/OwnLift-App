import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  saveToStorage,
  loadFromStorage,
  STORAGE_KEYS,
} from "@shared/services/storage";
import type { MenstrualPrefs } from "./services/types";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@shared/context/AuthContext";
import { useTheme } from "@shared/context/ThemeContext";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import ProgressChart from "@shared/components/ProgressChart";
import ModalSheet from "@shared/components/ModalSheet";
import ScrollTabBar from "@shared/components/ScrollTabBar";
import { useAlert } from "@shared/components/CustomAlert";
import {
  bodyTrackingApi,
  macrosTrackingApi,
  bodyFatApi,
  hydrationApi,
  sorenessApi,
  bodyMeasurementsApi,
  menstrualApi,
} from "./services";
import { customMeasurementsApi } from "./services/on/customMeasurements";
import { useTrackingModals } from "./context/TrackingModalsContext";
import {
  LogCycleModal,
  LogSorenessModal,
  LogHydrationModal,
  CycleSettingsWidget,
  HydrationSettingsWidget,
} from "./tabs";
import {
  // MuscleMapWidget,
  DOMSFollowUpWidget,
  DOMSHeatmapWidget,
  InjuryTrackerWidget,
} from "./tabs/SorenessTab";
import {
  PhotosCalendarWidget,
  PhotosGalleryWidget,
  PhotosComparisonWidget,
  PhotosMuscleNotesWidget,
  PhotosMuscleViewWidget,
} from "./tabs/PhotosTab";
import { useWidgets } from "@shared/context/hooks/useWidgets";
import { useTwoFingerPull } from "@shared/context/hooks/useTwoFingerPull";
import WidgetGallery from "@shared/components/widgets/WidgetGallery";
import WidgetsPanel from "@shared/components/widgets/WidgetsPanel";
import {
  TRACKING_TABS,
  WEIGHT_WIDGET_REGISTRY,
  DEFAULT_WEIGHT_WIDGETS,
  WEIGHT_WIDGETS_STORAGE_KEY,
  type WeightWidgetType,
  PHOTOS_WIDGET_REGISTRY,
  DEFAULT_PHOTOS_WIDGETS,
  PHOTOS_WIDGETS_STORAGE_KEY,
  type PhotosWidgetType,
  MACROS_WIDGET_REGISTRY,
  DEFAULT_MACROS_WIDGETS,
  MACROS_WIDGETS_STORAGE_KEY,
  type MacrosWidgetType,
  BODYFAT_WIDGET_REGISTRY,
  DEFAULT_BODYFAT_WIDGETS,
  BODYFAT_WIDGETS_STORAGE_KEY,
  type BodyFatWidgetType,
  MEASUREMENTS_WIDGET_REGISTRY,
  DEFAULT_MEASUREMENTS_WIDGETS,
  MEASUREMENTS_WIDGETS_STORAGE_KEY,
  type MeasurementsWidgetType,
  HYDRATION_WIDGET_REGISTRY,
  DEFAULT_HYDRATION_WIDGETS,
  HYDRATION_WIDGETS_STORAGE_KEY,
  type HydrationWidgetType,
  SORENESS_WIDGET_REGISTRY,
  DEFAULT_SORENESS_WIDGETS,
  SORENESS_WIDGETS_STORAGE_KEY,
  type SorenessWidgetType,
  MENSTRUAL_WIDGET_REGISTRY,
  DEFAULT_MENSTRUAL_WIDGETS,
  MENSTRUAL_WIDGETS_STORAGE_KEY,
  type MenstrualWidgetType,
} from "./tabs";
import type {
  WeightEntry,
  WeightHistoryResponse,
  HeightData,
  MacrosEntry,
  DailyMacrosStats,
  ProgressPhoto,
  BodyFatEntry,
  WidgetInstance,
} from "@shared/types";
import type {
  DayModalState,
  SelectedDatePhotos,
  ExpandedPhoto,
  MacrosEntryWithFields,
  SelectedDateMacros,
  BodyFatEntryWithFields,
} from "./types";
import type { ThemeColors } from "@shared/context/ThemeContext";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");

function filterDayModalEntry(prev: DayModalState | null, entryId: string | number) {
  if (!prev) return null;
  const remaining = (prev.existingEntries || []).filter((e: any) => e.id !== entryId);
  return {
    ...prev,
    existingEntries: remaining.length > 0 ? remaining : null,
  };
}

export default function TrackingScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user, authToken } = useAuth();
  const { alert, AlertComponent } = useAlert();
  const {
    state: modalState,
    openHydrationModal,
    openSorenessModal,
    openCycleModal,
    closeHydrationModal,
    closeSorenessModal,
    closeCycleModal,
  } = useTrackingModals();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("weight");

  // ─────────────────────────────────────────────────────────────
  // WIDGETS — one independent board per tab
  // ─────────────────────────────────────────────────────────────
  const [showWidgetGallery, setShowWidgetGallery] = useState<boolean>(false);
  const [widgetEditMode, setWidgetEditMode] = useState<boolean>(false);

  // Reset the gallery/edit affordances when switching tabs so "Editing
  // Widgets" from one tab doesn't linger, confusingly, on another.
  useEffect(() => {
    setShowWidgetGallery(false);
    setWidgetEditMode(false);
  }, [activeTab]);

  const weightBoard = useWidgets<WeightWidgetType>(user?.id ?? null, {
    registry: WEIGHT_WIDGET_REGISTRY,
    defaults: DEFAULT_WEIGHT_WIDGETS,
    storageKey: WEIGHT_WIDGETS_STORAGE_KEY,
  });
  const photosBoard = useWidgets<PhotosWidgetType>(user?.id ?? null, {
    registry: PHOTOS_WIDGET_REGISTRY,
    defaults: DEFAULT_PHOTOS_WIDGETS,
    storageKey: PHOTOS_WIDGETS_STORAGE_KEY,
  });
  const macrosBoard = useWidgets<MacrosWidgetType>(user?.id ?? null, {
    registry: MACROS_WIDGET_REGISTRY,
    defaults: DEFAULT_MACROS_WIDGETS,
    storageKey: MACROS_WIDGETS_STORAGE_KEY,
  });
  const bodyFatBoard = useWidgets<BodyFatWidgetType>(user?.id ?? null, {
    registry: BODYFAT_WIDGET_REGISTRY,
    defaults: DEFAULT_BODYFAT_WIDGETS,
    storageKey: BODYFAT_WIDGETS_STORAGE_KEY,
  });
  const measurementsBoard = useWidgets<MeasurementsWidgetType>(
    user?.id ?? null,
    {
      registry: MEASUREMENTS_WIDGET_REGISTRY,
      defaults: DEFAULT_MEASUREMENTS_WIDGETS,
      storageKey: MEASUREMENTS_WIDGETS_STORAGE_KEY,
    },
  );
  const hydrationBoard = useWidgets<HydrationWidgetType>(user?.id ?? null, {
    registry: HYDRATION_WIDGET_REGISTRY,
    defaults: DEFAULT_HYDRATION_WIDGETS,
    storageKey: HYDRATION_WIDGETS_STORAGE_KEY,
  });
  const sorenessBoard = useWidgets<SorenessWidgetType>(user?.id ?? null, {
    registry: SORENESS_WIDGET_REGISTRY,
    defaults: DEFAULT_SORENESS_WIDGETS,
    storageKey: SORENESS_WIDGETS_STORAGE_KEY,
  });
  const menstrualBoard = useWidgets<MenstrualWidgetType>(user?.id ?? null, {
    registry: MENSTRUAL_WIDGET_REGISTRY,
    defaults: DEFAULT_MENSTRUAL_WIDGETS,
    storageKey: MENSTRUAL_WIDGETS_STORAGE_KEY,
  });

  // Whichever tab is active, this is its widget board — the gallery and
  // the "+ Widget" / "Edit Widgets" affordances all key off this.
  const activeBoard =
    activeTab === "weight"
      ? weightBoard
      : activeTab === "photos"
        ? photosBoard
        : activeTab === "macros"
          ? macrosBoard
          : activeTab === "bodyfat"
            ? bodyFatBoard
            : activeTab === "measurements"
              ? measurementsBoard
              : activeTab === "hydration"
                ? hydrationBoard
                : activeTab === "soreness"
                  ? sorenessBoard
                  : menstrualBoard;

  // Which registry backs the currently-active tab — WidgetsPanel needs the
  // registry so it can render available widget types, icons and help text.
  const activeRegistry =
    activeTab === "weight"
      ? WEIGHT_WIDGET_REGISTRY
      : activeTab === "photos"
        ? PHOTOS_WIDGET_REGISTRY
        : activeTab === "macros"
          ? MACROS_WIDGET_REGISTRY
          : activeTab === "bodyfat"
            ? BODYFAT_WIDGET_REGISTRY
            : activeTab === "measurements"
              ? MEASUREMENTS_WIDGET_REGISTRY
              : activeTab === "hydration"
                ? HYDRATION_WIDGET_REGISTRY
                : activeTab === "soreness"
                  ? SORENESS_WIDGET_REGISTRY
                  : MENSTRUAL_WIDGET_REGISTRY;

  // Two-finger pull brings up the "deploy" panel for the active tab's
  // widgets, same gesture as HomeScreen. To rearrange, resize, or remove
  // widgets already on the tab, open that same panel and tap "Edit
  // Widgets".
  const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
    setShowWidgetGallery(true);
  });
  const handleEditWidgets = () => {
    setShowWidgetGallery(false);
    setWidgetEditMode(true);
  };

  const handleAddWidget = async (type: string): Promise<void> => {
    const result = await activeBoard.addWidget(type as never);
    if (!result.success && result.error) {
      alert("Can't Add Widget", result.error, [{ text: "OK" }]);
      return;
    }
    setShowWidgetGallery(false);
  };

  // ─────────────────────────────────────────────────────────────
  // WEIGHT TRACKING
  // ─────────────────────────────────────────────────────────────
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<string>("kg");
  const [showWeightModal, setShowWeightModal] = useState<boolean>(false);
  const [newWeight, setNewWeight] = useState<string>("");
  const [weightGoal, setWeightGoal] = useState<number | null>(null);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [goalInputValue, setGoalInputValue] = useState<string>("");
  const [weightEntriesShown, setWeightEntriesShown] = useState<number>(10);
  const [trendAverageDays, setTrendAverageDays] = useState<number>(7);

  // ─────────────────────────────────────────────────────────────
  // UNIFIED DAY MODAL
  // ─────────────────────────────────────────────────────────────
  const [dayModal, setDayModal] = useState<DayModalState | null>(null);

  // Past-day weight
  const [pastWeight, setPastWeight] = useState<string>("");
  // Past-day macros
  const [pastMacrosName, setPastMacrosName] = useState<string>("");
  const [pastMacrosProtein, setPastMacrosProtein] = useState<string>("");
  const [pastMacrosCarbs, setPastMacrosCarbs] = useState<string>("");
  const [pastMacrosFat, setPastMacrosFat] = useState<string>("");
  const [pastMacrosCalories, setPastMacrosCalories] = useState<string>("");
  const [pastMacrosTime, setPastMacrosTime] = useState<string>("12:00");
  const [pastMacrosError, setPastMacrosError] = useState<string>("5");
  // Past-day body fat
  const [pastWaist, setPastWaist] = useState<string>("");
  const [pastNeck, setPastNeck] = useState<string>("");
  const [pastHip, setPastHip] = useState<string>("");
  const [pastMeasurementUnit, setPastMeasurementUnit] = useState<string>("cm");
  const [pastGender, setPastGender] = useState<string>("male");
  const [dayModalShowAddForm, setDayModalShowAddForm] =
    useState<boolean>(false);

  // ─────────────────────────────────────────────────────────────
  // HEIGHT
  // ─────────────────────────────────────────────────────────────
  const [height, setHeight] = useState<HeightData | null>(null);
  const [heightUnit, setHeightUnit] = useState<string>("cm");
  const [showHeightModal, setShowHeightModal] = useState<boolean>(false);
  const [newHeightCm, setNewHeightCm] = useState<string>("");
  const [newHeightFt, setNewHeightFt] = useState<string>("");
  const [newHeightIn, setNewHeightIn] = useState<string>("");

  // ─────────────────────────────────────────────────────────────
  // PROGRESS PHOTOS
  // ─────────────────────────────────────────────────────────────
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(
    null,
  );
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [photoUriCache, setPhotoUriCache] = useState<Record<string, string>>(
    {},
  );
  const [photoUriLoading, setPhotoUriLoading] = useState<
    Record<string, boolean>
  >({});
  const [selectedDatePhotos, setSelectedDatePhotos] =
    useState<SelectedDatePhotos | null>(null);
  const [showDatePhotosModal, setShowDatePhotosModal] =
    useState<boolean>(false);
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto | null>(
    null,
  );

  // ─────────────────────────────────────────────────────────────
  // MACROS TRACKING
  // ─────────────────────────────────────────────────────────────
  const [macrosEntries, setMacrosEntries] = useState<MacrosEntryWithFields[]>(
    [],
  );
  const [dailyMacrosGoals, setDailyMacrosGoals] = useState({
    protein: 150,
    carbs: 250,
    fat: 65,
    calories: 2000,
  });
  const [showMacrosModal, setShowMacrosModal] = useState<boolean>(false);
  const [newMacrosProtein, setNewMacrosProtein] = useState("");
  const [newMacrosCarbs, setNewMacrosCarbs] = useState("");
  const [newMacrosFat, setNewMacrosFat] = useState("");
  const [newMacrosCalories, setNewMacrosCalories] = useState("");
  const [newMacrosTime, setNewMacrosTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [newMacrosError, setNewMacrosError] = useState("5");
  const [showMacrosGoalModal, setShowMacrosGoalModal] =
    useState<boolean>(false);
  const [macrosGoalInput, setMacrosGoalInput] = useState({
    protein: "",
    carbs: "",
    fat: "",
    calories: "",
  });
  const [selectedDateMacros, setSelectedDateMacros] =
    useState<SelectedDateMacros | null>(null);
  const [showDateMacrosModal, setShowDateMacrosModal] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // BODY FAT
  // ─────────────────────────────────────────────────────────────
  const [bodyFatHistory, setBodyFatHistory] = useState<
    BodyFatEntryWithFields[]
  >([]);
  const [showBodyFatModal, setShowBodyFatModal] = useState<boolean>(false);
  const [gender, setGender] = useState("male");
  const [waist, setWaist] = useState("");
  const [neck, setNeck] = useState("");
  const [hip, setHip] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("cm");
  const [selectedDateBodyFat, setSelectedDateBodyFat] = useState(null);
  const [showDateBodyFatModal, setShowDateBodyFatModal] = useState(false);
  const [newMacrosName, setNewMacrosName] = useState("");

  // ─────────────────────────────────────────────────────────────
  // NEW TRACKING STATE (Measurements, Hydration, Soreness, Menstrual)
  // ─────────────────────────────────────────────────────────────
  // MEASUREMENTS
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);
  const [customMeasurementEntries, setCustomMeasurementEntries] = useState<
    any[]
  >([]);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [newWaist, setNewWaist] = useState("");
  const [newArmLeft, setNewArmLeft] = useState("");
  const [newArmRight, setNewArmRight] = useState("");
  const [newChest, setNewChest] = useState("");
  const [newCustomBodyPart, setNewCustomBodyPart] = useState("");
  const [newCustomBodyPartValue, setNewCustomBodyPartValue] = useState("");

  // HYDRATION
  const [hydrationEntries, setHydrationEntries] = useState<any[]>([]);
  const [showHydrationModal, setShowHydrationModal] = useState(false);
  const [newHydrationAmount, setNewHydrationAmount] = useState("");
  const [hydrationGoal, setHydrationGoal] = useState(2000);

  // SORENESS (DOMS)
  const [sorenessEntries, setSorenessEntries] = useState<any[]>([]);
  const [showSorenessModal, setShowSorenessModal] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState("");
  const [sorenessIntensity, setSorenessIntensity] = useState(5);
  const [validMuscles, setValidMuscles] = useState<string[]>([]);

  // MENSTRUAL
  const [cycleEntries, setCycleEntries] = useState<any[]>([]);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [menstrualPrefs, setMenstrualPrefs] = useState<MenstrualPrefs>({
    cycleLengthDays: 28,
    periodLengthDays: 5,
  });
  const [newCycleStart, setNewCycleStart] = useState("");
  const [flowIntensity, setFlowIntensity] = useState<
    "light" | "moderate" | "heavy"
  >("moderate");
  const [cycleSymptoms, setCycleSymptoms] = useState<string[]>([]);

  // Per-day flow modal state
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowModalDate, setFlowModalDate] = useState<string | null>(null);
  const [flowModalIntensity, setFlowModalIntensity] = useState<
    "light" | "moderate" | "heavy"
  >("moderate");
  const [flowModalCycleEntry, setFlowModalCycleEntry] = useState<any>(null);

  // Computed sets for calendar decorations (YYYY-MM-DD strings)
  const [cycleActualDays, setCycleActualDays] = useState<Set<string>>(
    new Set(),
  );
  const [cyclePredictedDays, setCyclePredictedDays] = useState<Set<string>>(
    new Set(),
  );
  const [cycleStats, setCycleStats] = useState<any>(null);
  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(
    new Set(),
  );

  // ─────────────────────────────────────────────────────────────
  // SELECTED LOG DATE
  // ─────────────────────────────────────────────────────────────
  const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);

  const getUserKey = (key: string) =>
    user?.id ? `${key}_user_${user.id}` : key;

  // ─────────────────────────────────────────────────────────────
  // DATE HELPERS
  // ─────────────────────────────────────────────────────────────
  const toLocalDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const isoToLocalDateStr = (isoStr: string | null | undefined) => {
    if (!isoStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return toLocalDateStr(d);
  };

  const parseSafeDate = (isoStr: string | null | undefined): Date | null => {
    if (!isoStr) return null;
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDateLabel = (isoStr: string | null | undefined) => {
    const date = parseSafeDate(isoStr);
    return date ? date.toLocaleDateString() : "Unknown date";
  };

  const getCycleStartIso = (entry: any): string | null => {
    return (
      entry.cycleStart ??
      entry.cycle_start ??
      entry.startDate ??
      entry.started_at ??
      entry.start_date ??
      entry.date ??
      null
    );
  };

  const getCycleDuration = (entry: any) => {
    const len =
      entry.duration_days ??
      entry.durationDays ??
      entry.duration ??
      entry.length ??
      entry.days ??
      menstrualPrefs.periodLengthDays ??
      5;
    return Number(len) || menstrualPrefs.periodLengthDays || 5;
  };

  const getCycleFlowLabel = (entry: any) => {
    return entry.flow ?? entry.flowIntensity ?? entry.flow_intensity ?? "—";
  };

  // Computes a best-guess phase (Menstrual / Follicular / Ovulation / Luteal)
  // for a cycle that started on `startIso`, given the user's average period
  // and cycle lengths. Entries no longer have a server-provided phase field,
  // so this is derived from simple day-of-cycle math instead.
  const getCyclePhaseLabel = (
    startIso: string | null,
    periodLengthDays: number,
    cycleLengthDays: number,
  ): string | null => {
    const start = parseSafeDate(startIso);
    if (!start) return null;

    const start0 = new Date(start);
    start0.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (today.getTime() - start0.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) return null;

    const cLen = cycleLengthDays || 28;
    const pLen = Math.min(periodLengthDays || 5, cLen - 1);
    // day 1 = cycle start; wrap into the current cycle window so this still
    // works for the most recent entry even a bit past a full cycle length
    const dayOfCycle = (diffDays % cLen) + 1;

    if (dayOfCycle <= pLen) return "Menstrual";

    const ovulationDay = Math.max(pLen + 1, cLen - 14);
    if (dayOfCycle < ovulationDay - 1) return "Follicular";
    if (dayOfCycle <= ovulationDay + 1) return "Ovulation";
    return "Luteal";
  };

  // How far ahead to predict — lives here so callers don't have to think
  // about it. Bump this if you want predictions further into the future.
  const MONTHS_TO_PREDICT = 6;

  // Projects future period windows forward from the most recent known
  // cycle start, using the user's average cycle length. Returns a Set of
  // YYYY-MM-DD strings covering every predicted period day for the next
  // MONTHS_TO_PREDICT months.
  const computeUpcomingPredictedDays = (
    lastCycleStartIso: string | null,
    cycleLengthDays: number,
    periodLengthDays: number,
  ): Set<string> => {
    const predicted = new Set<string>();
    const start = parseSafeDate(lastCycleStartIso);
    if (!start) return predicted;

    const cLen = cycleLengthDays || 28;
    const pLen = periodLengthDays || 5;

    // Round up so short cycle lengths still generate enough future
    // occurrences to cover the target window.
    const daysToCover = MONTHS_TO_PREDICT * 30;
    const cyclesAhead = Math.max(1, Math.ceil(daysToCover / cLen));

    for (let i = 1; i <= cyclesAhead; i++) {
      const cycleStart = new Date(start);
      cycleStart.setDate(cycleStart.getDate() + cLen * i);
      for (let d = 0; d < pLen; d++) {
        const day = new Date(cycleStart);
        day.setDate(day.getDate() + d);
        predicted.add(toLocalDateStr(day));
      }
    }

    return predicted;
  };

  const buildLocalISOForDate = (date: Date, timeStr = "09:00") => {
    const dateStr = toLocalDateStr(date);
    return `${dateStr}T${timeStr}:00`;
  };

  const toggleExpandedCycle = (id: number | string | null | undefined) => {
    if (id == null) return;
    const key = String(id);
    setExpandedCycleIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────
  // RESET FIELDS
  // ─────────────────────────────────────────────────────────────
  const resetDayModalFields = () => {
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
    setDayModalShowAddForm(false);
  };

  // ─────────────────────────────────────────────────────────────
  // UNIFIED CALENDAR DATE PRESS
  // ─────────────────────────────────────────────────────────────
  const handleCalendarDatePress = async (date: Date, tab: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pressedDate = new Date(date);
    pressedDate.setHours(0, 0, 0, 0);
    const isToday = pressedDate.getTime() === today.getTime();

    resetDayModalFields();
    setSelectedLogDate(date);

    const dateStr = toLocalDateStr(date);
    let existingEntries = null;

    if (tab === "weight") {
      const entries = weightHistory.filter(
        (e) => isoToLocalDateStr(e?.recorded_at) === dateStr,
      );
      if (entries.length > 0) existingEntries = entries;
    }

    if (tab === "macros") {
      const stats = getDailyMacrosStats(date);
      if (stats) existingEntries = stats.entriesList;
    }

    if (tab === "photos") {
      const photos = getPhotosForDate(date);
      if (photos.length > 0) {
        existingEntries = photos;
        prefetchPhotosForDate(photos);
      }
    }

    if (tab === "bodyfat") {
      const entry = bodyFatHistory.find(
        (b) => isoToLocalDateStr(b?.date) === dateStr,
      );
      if (entry) existingEntries = [entry];
    }

    if (tab === "measurements") {
      const entries = measurementHistory.filter(
        (m) => isoToLocalDateStr(m?.measuredAt ?? m?.recorded_at) === dateStr,
      );
      if (entries.length > 0) existingEntries = entries;
    }

    if (tab === "hydration") {
      const entries = hydrationEntries.filter(
        (h) => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === dateStr,
      );
      if (entries.length > 0) existingEntries = entries;
    }

    if (tab === "soreness") {
      const entries = sorenessEntries.filter(
        (s) =>
          isoToLocalDateStr(s?.loggedAt ?? s?.recorded_at ?? s?.date) ===
          dateStr,
      );
      if (entries.length > 0) existingEntries = entries;
    }

    // MENSTRUAL: if tapping a day that is an actual period day, open the
    // per-day flow modal to set intensity. Otherwise fall back to the
    // regular cycle day modal behavior.
    if (tab === "menstrual") {
      if (cycleActualDays.has(dateStr)) {
        try {
          const resp = await menstrualApi.getDayFlow(dateStr);
          const entry = resp?.data || null;
          // If this date is the first day of a logged period, keep a
          // reference to it so the flow modal can offer to delete it
          const matchingCycle = cycleEntries.find(
            (c) => isoToLocalDateStr(getCycleStartIso(c)) === dateStr,
          );
          setFlowModalDate(dateStr);
          setFlowModalIntensity((entry && entry.intensity) || "moderate");
          setFlowModalCycleEntry(matchingCycle ?? null);
          setShowFlowModal(true);
          // Do not show the unified day modal in this case
          setDayModal(null);
          return;
        } catch (e) {
          console.warn("Failed to fetch day flow:", e);
          // fallthrough to opening day modal if API fails
        }
      }
    }

    setDayModalShowAddForm(existingEntries === null);
    setDayModal({ date, tab, existingEntries, isToday });
  };

  // ─────────────────────────────────────────────────────────────
  // OPEN LOG MODAL FOR TAB
  // ─────────────────────────────────────────────────────────────
  const openLogModalForTab = (tab: string) => {
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
        setSelectedMuscle("");
        setSorenessIntensity(5);
        openSorenessModal();
        break;
      case "menstrual":
        setNewCycleStart("");
        setFlowIntensity("moderate");
        setCycleSymptoms([]);
        openCycleModal();
        break;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DELETE HANDLERS
  // ─────────────────────────────────────────────────────────────

  // LOAD TAB DATA
  useEffect(() => {
    loadTabData();
  }, [activeTab, user?.id]);

  const loadTabData = async () => {
    if (!user?.id) return;

    try {
      switch (activeTab) {
        case "measurements": {
          const measurements =
            await bodyMeasurementsApi.getMeasurementHistory();
          setMeasurementHistory(measurements?.data || []);
          try {
            const todayStr = toLocalDateStr(new Date());
            const customValues =
              await customMeasurementsApi.getValuesForDate(todayStr);
            setCustomMeasurementEntries(customValues?.data || []);
          } catch (err) {
            console.warn("Unable to load custom measurements:", err);
            setCustomMeasurementEntries([]);
          }
          break;
        }
        case "hydration": {
          const hydration = await hydrationApi.getHydrationHistory();
          setHydrationEntries(hydration?.data || []);
          // hydration goal is client-side for now; server doesn't currently return a goal in stats
          try {
            const stats = await hydrationApi.getHydrationStats();
            // If server includes a goal field in the future, apply it here safely
            // if ((stats?.data as any)?.goal) setHydrationGoal((stats.data as any).goal)
          } catch (e) {}
          break;
        }
        case "soreness": {
          const sr = await sorenessApi.getSorenessHistory();
          setSorenessEntries(sr?.data || []);
          try {
            const muscles = await sorenessApi.getValidMuscleGroups();
            setValidMuscles(muscles?.data || []);
          } catch (e) {}
          break;
        }
        case "menstrual": {
          const cycles = await menstrualApi.getMenstrualHistory();
          setCycleEntries(cycles?.data || []);
          // load stored menstrual preferences
          try {
            const prefs = await loadFromStorage<MenstrualPrefs>(
              STORAGE_KEYS.MENSTRUAL_PREFS,
              String(user.id),
            );
            if (prefs) setMenstrualPrefs(prefs);
          } catch (e) {
            console.warn("Failed to load menstrual prefs", e);
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error("Error loading tab data:", error);
    }
  };
  const createDeleteHandler = <T,>(
    apiDelete: (id: any) => Promise<any>,
    setHistory: (updater: (prev: T[]) => T[]) => void,
    extraCleanup?: (entry: T) => void,
  ) => {
    return async (entry: T) => {
      const entryId = (entry as { id: string | number }).id;
      try {
        await apiDelete(entryId);
        setHistory((prev) => prev.filter((e) => (e as { id: string | number }).id !== entryId));
        setDayModal((prev) => filterDayModalEntry(prev, entryId));
        extraCleanup?.(entry);
      } catch (err) {
        alert(
          "Error",
          err instanceof Error ? err.message : String(err),
          [{ text: "OK" }],
          "error",
        );
      }
    };
  };

  const handleDeleteWeight = createDeleteHandler(
    bodyTrackingApi.deleteWeightEntry,
    setWeightHistory,
  );
  const handleDeleteMacro = createDeleteHandler(
    macrosTrackingApi.deleteMacrosEntry,
    setMacrosEntries,
    () => loadData(),
  );
  const handleDeletePhoto = createDeleteHandler<ProgressPhoto>(
    bodyTrackingApi.deleteProgressPhoto,
    setProgressPhotos,
    (photo) => {
      setPhotoUriCache((prev) => {
        const next = { ...prev };
        delete next[photo.id];
        return next;
      });
      setSelectedDatePhotos((prev) => {
        if (!prev) return null;
        const remaining = prev.photos.filter((p) => p.id !== photo.id);
        return remaining.length > 0
          ? { ...prev, photos: remaining }
          : null;
      });
      if (
        !selectedDatePhotos ||
        selectedDatePhotos.photos.filter((p) => p.id !== photo.id)
          .length === 0
      ) {
        setShowDatePhotosModal(false);
      }
    },
  );
  const handleDeleteBodyFat = createDeleteHandler(
    bodyFatApi.deleteBodyFatEntry,
    setBodyFatHistory,
  );
  const handleDeleteMeasurement = createDeleteHandler(
    bodyMeasurementsApi.deleteMeasurementEntry,
    setMeasurementHistory,
  );
  const handleDeleteHydration = createDeleteHandler(
    hydrationApi.deleteHydrationEntry,
    setHydrationEntries,
  );
  const handleDeleteSoreness = createDeleteHandler(
    sorenessApi.deleteSorenessEntry,
    setSorenessEntries,
  );

  const deleteWeightEntry = (entry: WeightEntry) => {
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
  };

  const deleteMacroEntry = (entry: MacrosEntry) => {
    alert(
      "Delete Entry",
      entry.name ? `Remove "${entry.name}"?` : "Remove this entry?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteMacro(entry) },
      ],
      "warning",
    );
  };

  const deletePhoto = (photo: ProgressPhoto) => {
    alert(
      "Delete Photo",
      "Permanently delete this progress photo?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeletePhoto(photo) },
      ],
      "warning",
    );
  };

  const deleteBodyFatEntry = (entry: BodyFatEntryWithFields) => {
    const pct =
      entry.percentage ??
      (entry as { body_fat_percentage?: number }).body_fat_percentage ??
      0;
    alert(
      "Delete Entry",
      `Remove ${pct}% reading?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteBodyFat(entry) },
      ],
      "warning",
    );
  };

  const deleteMeasurementEntry = (entry: any) => {
    alert(
      "Delete Entry",
      "Remove this measurement?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteMeasurement(entry) },
      ],
      "warning",
    );
  };

  const deleteHydrationEntry = (entry: any) => {
    alert(
      "Delete Entry",
      "Remove this hydration entry?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteHydration(entry) },
      ],
      "warning",
    );
  };

  const deleteSorenessEntry = (entry: any) => {
    alert(
      "Delete Entry",
      "Remove this soreness entry?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteSoreness(entry) },
      ],
      "warning",
    );
  };

  // ─────────────────────────────────────────────────────────────
  // SUBMIT PAST DAY ENTRY
  // ─────────────────────────────────────────────────────────────
  const submitPastDayEntry = async () => {
    if (!dayModal) return;
    const { date, tab } = dayModal;

    try {
      if (tab === "weight") {
        if (!pastWeight || isNaN(parseFloat(pastWeight)))
          return alert(
            "Invalid Input",
            "Enter a valid weight",
            [{ text: "OK" }],
            "error",
          );
        const value = parseFloat(pastWeight);
        const recordedAt = buildLocalISOForDate(date, "08:00");
        await bodyTrackingApi.logWeight(
          value,
          weightUnit as "kg" | "lbs",
          null,
          recordedAt,
        );
        alert("Logged", "Weight entry added", [{ text: "OK" }], "success");
      }

      if (tab === "macros") {
        const protein =
          pastMacrosProtein !== "" ? parseFloat(pastMacrosProtein) : undefined;
        const carbs =
          pastMacrosCarbs !== "" ? parseFloat(pastMacrosCarbs) : undefined;
        const fat =
          pastMacrosFat !== "" ? parseFloat(pastMacrosFat) : undefined;
        const calories =
          pastMacrosCalories !== ""
            ? parseFloat(pastMacrosCalories)
            : undefined;
        const hasValue =
          protein != null || carbs != null || fat != null || calories != null;
        if (!hasValue && !pastMacrosName.trim())
          return alert(
            "Nothing to log",
            "Enter at least a name or one macro value",
            [{ text: "OK" }],
            "warning",
          );
        const dateStr = toLocalDateStr(date);
        await macrosTrackingApi.logMacros({
          name: pastMacrosName.trim() || undefined,
          protein,
          carbs,
          fat,
          calories,
          errorMargin: parseFloat(pastMacrosError) || 0,
          time: pastMacrosTime,
          date: dateStr,
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
          return alert(
            "Missing Data",
            "Please enter all measurements",
            [{ text: "OK" }],
            "error",
          );
        let heightCm = height?.height_cm
          ? parseFloat(String(height.height_cm))
          : null;
        if (!heightCm) {
          return alert(
            "Height Required",
            "Set your height in the Body Fat tab first.",
            [{ text: "OK" }],
            "warning",
          );
        }
        let waistCm = parseFloat(pastWaist);
        let neckCm = parseFloat(pastNeck);
        let hipCm = pastHip ? parseFloat(pastHip) : 0;
        if (pastMeasurementUnit === "in") {
          waistCm *= 2.54;
          neckCm *= 2.54;
          hipCm *= 2.54;
        }
        let pct;
        if (pastGender === "male") {
          pct =
            495 /
              (1.0324 -
                0.19077 * Math.log10(waistCm - neckCm) +
                0.15456 * Math.log10(heightCm)) -
            450;
        } else {
          pct =
            495 /
              (1.29579 -
                0.35004 * Math.log10(waistCm + hipCm - neckCm) +
                0.221 * Math.log10(heightCm)) -
            450;
        }
        const dateIso = buildLocalISOForDate(date);
        await bodyFatApi.logBodyFat(
          parseFloat(pct.toFixed(1)),
          { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" },
          pastGender as "male" | "female",
          dateIso,
        );
        alert(
          "Logged",
          `Body fat ${pct.toFixed(1)}% added`,
          [{ text: "OK" }],
          "success",
        );
      }

      setDayModal(null);
      loadData();
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save entry",
        [{ text: "OK" }],
        "error",
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────
  const getWeightChartData = () => {
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
  };

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await loadFromServer();
    } catch (err) {
      console.warn(
        "Server load failed:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFromServer();
    } catch (err) {
      console.warn(
        "Refresh failed:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const loadFromServer = async () => {
    const weightData =
      (await bodyTrackingApi.getWeightHistory()) as WeightHistoryResponse;
    const weightEntries = weightData.entries || [];
    const validWeightEntries = weightEntries
      .map((e: WeightEntry) => ({
        ...e,
        weight_kg: parseFloat(String(e.weight_kg)),
      }))
      .filter(
        (e: WeightEntry & { weight_kg: number }) =>
          !isNaN(e.weight_kg) && e.weight_kg > 0,
      )
      .sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
    setWeightHistory(validWeightEntries);
    setWeightUnit((weightData as unknown as { unit?: string }).unit || "kg");

    try {
      const heightData =
        (await bodyTrackingApi.getHeightAndUnits()) as unknown as {
          height?: HeightData & { height_unit?: string };
        };
      if (heightData?.height) {
        setHeight(heightData.height as unknown as HeightData);
        setHeightUnit(heightData.height.height_unit || "cm");
      }
    } catch {}

    const photoData = (await bodyTrackingApi.getPhotoList()) as {
      photos?: ProgressPhoto[];
    };
    setProgressPhotos(photoData.photos || []);

    const macrosData = (await macrosTrackingApi.getMacrosHistory(30)) as {
      entries?: MacrosEntry[];
    };
    setMacrosEntries((macrosData.entries || []) as MacrosEntryWithFields[]);
    const macrosGoals =
      (await macrosTrackingApi.getMacrosGoals()) as unknown as {
        goals?: typeof dailyMacrosGoals;
      } & typeof dailyMacrosGoals;
    setDailyMacrosGoals(
      macrosGoals.goals ?? {
        protein: (macrosGoals as { protein?: number }).protein ?? 150,
        carbs: (macrosGoals as { carbs?: number }).carbs ?? 250,
        fat: (macrosGoals as { fat?: number }).fat ?? 65,
        calories: (macrosGoals as { calories?: number }).calories ?? 2000,
      },
    );

    const bodyFatData = (await bodyFatApi.getBodyFatHistory()) as {
      entries?: BodyFatEntry[];
    };
    const sortedBodyFat = (
      (bodyFatData.entries || []) as BodyFatEntryWithFields[]
    ).sort(
      (a, b) =>
        new Date(b.date ?? b.recorded_at ?? "").getTime() -
        new Date(a.date ?? a.recorded_at ?? "").getTime(),
    );
    setBodyFatHistory(sortedBodyFat);

    // Load menstrual data + settings + compute calendar markings
    try {
      const cyclesResp = await menstrualApi.getMenstrualHistory(24);
      const cycles = cyclesResp?.data || [];
      setCycleEntries(cycles);

      // Prefer server settings, fallback to local storage
      try {
        const settingsResp = await menstrualApi.getSettings();
        const settings = settingsResp?.data;
        if (settings) {
          setMenstrualPrefs({
            cycleLengthDays:
              settings.cycleLengthDays ?? menstrualPrefs.cycleLengthDays,
            periodLengthDays:
              settings.periodDays ?? menstrualPrefs.periodLengthDays,
          });
          // persist locally for quick access
          await saveToStorage(
            STORAGE_KEYS.MENSTRUAL_PREFS,
            {
              cycleLengthDays:
                settings.cycleLengthDays ?? menstrualPrefs.cycleLengthDays,
              periodLengthDays:
                settings.periodDays ?? menstrualPrefs.periodLengthDays,
            },
            String(user?.id ?? ""),
          );
        }
      } catch (e) {
        console.warn("Failed to load menstrual settings from server:", e);
        // try local cache below (no-op)
      }

      try {
        const statsResp = await menstrualApi.getCycleStats();
        const stats = statsResp?.data;
        setCycleStats(stats ?? null);

        // Build sets of actual and predicted days for calendar decorations
        const actualSet = new Set<string>();
        const predictedSet = new Set<string>();
        const pd = menstrualPrefs.periodLengthDays || 5;

        const addRangeToSet = (
          startDate: Date,
          length: number,
          set: Set<string>,
        ) => {
          for (let i = 0; i < length; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            set.add(toLocalDateStr(d));
          }
        };

        // Actuals: from recorded cycles
        cycles.forEach((c: any) => {
          const startIso = getCycleStartIso(c);
          if (!startIso) return;
          const start = parseSafeDate(startIso);
          if (!start) return;
          addRangeToSet(start, getCycleDuration(c), actualSet);
        });

        // Predicted: project forward from the most recent logged cycle
        // using the user's average cycle length, covering the next
        // several months (see computeUpcomingPredictedDays).
        const mostRecentStartIso =
          cycles.length > 0 ? getCycleStartIso(cycles[0]) : null;
        const upcomingPredicted = computeUpcomingPredictedDays(
          mostRecentStartIso,
          menstrualPrefs.cycleLengthDays,
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

    const savedGoal = await AsyncStorage.getItem(getUserKey("weightGoal"));
    if (savedGoal) setWeightGoal(parseFloat(savedGoal));

    const savedGender = await AsyncStorage.getItem(getUserKey("gender"));
    if (savedGender) setGender(savedGender);
  };

  useEffect(() => {
    if (progressPhotos.length > 0) {
      progressPhotos.slice(0, 20).forEach((p) => fetchPhotoUri(p.id));
    }
  }, [progressPhotos]);

  // ─────────────────────────────────────────────────────────────
  // WEIGHT TREND
  // ─────────────────────────────────────────────────────────────
  const getWeightTrend = () => {
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
  };

  // ─────────────────────────────────────────────────────────────
  // MACROS HELPERS
  // ─────────────────────────────────────────────────────────────
  const addMacrosEntry = async () => {
    const protein =
      newMacrosProtein !== "" ? parseFloat(newMacrosProtein) : undefined;
    const carbs =
      newMacrosCarbs !== "" ? parseFloat(newMacrosCarbs) : undefined;
    const fat = newMacrosFat !== "" ? parseFloat(newMacrosFat) : undefined;
    const calories =
      newMacrosCalories !== "" ? parseFloat(newMacrosCalories) : undefined;

    const hasValue =
      protein != null || carbs != null || fat != null || calories != null;
    if (!hasValue && !newMacrosName.trim()) {
      return alert(
        "Nothing to log",
        "Enter at least a name or one value",
        [{ text: "OK" }],
        "warning",
      );
    }

    try {
      const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null;
      await macrosTrackingApi.logMacros({
        name: newMacrosName.trim() || undefined,
        protein,
        carbs,
        fat,
        calories,
        errorMargin: parseFloat(newMacrosError) || 0,
        time: newMacrosTime,
        date: dateStr,
      });
      setNewMacrosName("");
      setNewMacrosProtein("");
      setNewMacrosCarbs("");
      setNewMacrosFat("");
      setNewMacrosCalories("");
      setNewMacrosError("5");
      setNewMacrosTime(new Date().toTimeString().slice(0, 5));
      setShowMacrosModal(false);
      setSelectedLogDate(null);
      alert("Logged", "Macros logged!", [{ text: "OK" }], "success");
      loadData();
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "An error occurred",
        [{ text: "OK" }],
        "error",
      );
    }
  };

  const getDailyMacrosStats = (date: Date) => {
    const dateStr = toLocalDateStr(date);
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
      errorMargin:
        parseFloat(String(e.errorMargin ?? e.error_margin ?? 0)) || 0,
    }));
    type NormedEntry = (typeof normed)[0];
    const sumField = (field: keyof NormedEntry) =>
      normed.reduce((s, e) => {
        const v = e[field];
        return v != null && typeof v === "number" ? s + v : s;
      }, 0);
    const hasAny = (field: keyof NormedEntry) =>
      normed.some((e) => e[field] != null);
    const avgError =
      normed.reduce((s, e) => s + e.errorMargin, 0) / normed.length;
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
  };

  const updateMacrosGoals = async () => {
    const protein = parseFloat(macrosGoalInput.protein);
    const carbs = parseFloat(macrosGoalInput.carbs);
    const fat = parseFloat(macrosGoalInput.fat);
    const calories = parseFloat(macrosGoalInput.calories);
    if (
      isNaN(protein) ||
      protein <= 0 ||
      isNaN(carbs) ||
      carbs <= 0 ||
      isNaN(fat) ||
      fat <= 0 ||
      isNaN(calories) ||
      calories <= 0
    ) {
      return alert(
        "Invalid Input",
        "Please enter valid goals",
        [{ text: "OK" }],
        "error",
      );
    }
    try {
      await macrosTrackingApi.setMacrosGoals({ protein, carbs, fat, calories });
      setDailyMacrosGoals({ protein, carbs, fat, calories });
      setShowMacrosGoalModal(false);
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "An error occurred",
        [{ text: "OK" }],
        "error",
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // BODY FAT CALCULATION
  // ─────────────────────────────────────────────────────────────
  const calculateBodyFat = async () => {
    if (!waist || !neck || (gender === "female" && !hip)) {
      return alert(
        "Missing Data",
        "Please enter all measurements",
        [{ text: "OK" }],
        "error",
      );
    }
    let heightCm = height?.height_cm
      ? parseFloat(String(height.height_cm))
      : null;
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
              setShowHeightModal(true);
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
      bodyFatPercentage =
        495 /
          (1.0324 -
            0.19077 * Math.log10(waistCm - neckCm) +
            0.15456 * Math.log10(heightCm)) -
        450;
    } else {
      bodyFatPercentage =
        495 /
          (1.29579 -
            0.35004 * Math.log10(waistCm + hipCm - neckCm) +
            0.221 * Math.log10(heightCm)) -
        450;
    }
    try {
      const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null;
      await bodyFatApi.logBodyFat(
        parseFloat(bodyFatPercentage.toFixed(1)),
        { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" },
        gender as "male" | "female",
        dateStr,
      );
      setSelectedLogDate(null);
      alert(
        "Body Fat Calculated",
        `Your body fat is ${bodyFatPercentage.toFixed(1)}%`,
        [{ text: "OK" }],
        "success",
      );
      loadData();
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "An error occurred",
        [{ text: "OK" }],
        "error",
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PHOTO METHODS
  // ─────────────────────────────────────────────────────────────
  const fetchPhotoUri = async (photoId: string | number) => {
    if (photoUriCache[photoId] || photoUriLoading[photoId]) return;
    setPhotoUriLoading((prev) => ({ ...prev, [photoId]: true }));
    try {
      const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`;
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) {
        setPhotoUriCache((prev) => ({ ...prev, [photoId]: localUri }));
        return;
      }
      const result = await FileSystem.downloadAsync(
        bodyTrackingApi.getPhotoUrl(photoId),
        localUri,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      if (result.status === 200) {
        setPhotoUriCache((prev) => ({ ...prev, [photoId]: result.uri }));
      } else {
        throw new Error(`Server returned ${result.status}`);
      }
    } catch (error) {
      setPhotoUriCache((prev) => ({ ...prev, [photoId]: "error" }));
    } finally {
      setPhotoUriLoading((prev) => ({ ...prev, [photoId]: false }));
    }
  };

  const prefetchPhotosForDate = async (photos: ProgressPhoto[]) => {
    await Promise.all(photos.map((p) => fetchPhotoUri(p.id)));
  };

  useEffect(() => {
    if (showDatePhotosModal && selectedDatePhotos?.photos?.length) {
      prefetchPhotosForDate(selectedDatePhotos.photos);
    }
  }, [showDatePhotosModal, selectedDatePhotos]);

  useEffect(() => {
    if (dayModal?.tab === "photos" && dayModal?.existingEntries?.length) {
      prefetchPhotosForDate(dayModal.existingEntries as ProgressPhoto[]);
    }
  }, [dayModal]);

  const takePhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Camera access is needed",
          [{ text: "OK" }],
          "warning",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate
          ? toLocalDateStr(selectedLogDate)
          : null;
        await uploadPhoto(result.assets[0].uri, dateStr);
      }
    } catch (error) {
      alert("Error", "Failed to take photo.", [{ text: "OK" }], "error");
    }
  };

  const pickPhotoFromGallery = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Photo library access is needed",
          [{ text: "OK" }],
          "warning",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate
          ? toLocalDateStr(selectedLogDate)
          : null;
        await uploadPhoto(result.assets[0].uri, dateStr);
      }
    } catch (error) {
      alert("Error", "Failed to select photo.", [{ text: "OK" }], "error");
    }
  };

  const pickPhotoForDate = async (date: Date) => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Photo library access is needed",
          [{ text: "OK" }],
          "warning",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets?.[0]) {
        await bodyTrackingApi.uploadProgressPhoto(
          result.assets[0].uri,
          "image/jpeg",
          null,
          toLocalDateStr(date),
        );
        alert(
          "Photo added",
          `Photo saved for ${date.toLocaleDateString()}`,
          [{ text: "OK" }],
          "success",
        );
        loadData();
      }
    } catch (error) {
      alert("Error", "Failed to add photo.", [{ text: "OK" }], "error");
    }
  };

  const uploadPhoto = async (uri: string, dateStr: string | null = null) => {
    try {
      await bodyTrackingApi.uploadProgressPhoto(
        uri,
        "image/jpeg",
        null,
        dateStr,
      );
      setSelectedLogDate(null);
      alert("Success", "Progress photo saved!", [{ text: "OK" }], "success");
      loadData();
    } catch (error) {
      alert("Error", "Failed to upload photo", [{ text: "OK" }], "error");
    }
  };

  const getPhotosForDate = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return progressPhotos.filter(
      (p) => isoToLocalDateStr(p?.takenAt) === dateStr,
    );
  };

  // ─────────────────────────────────────────────────────────────
  // WEIGHT ACTIONS
  // ─────────────────────────────────────────────────────────────
  const addWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight)))
      return alert(
        "Invalid Input",
        "Enter a valid weight",
        [{ text: "OK" }],
        "error",
      );
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
      alert(
        "Error",
        err instanceof Error ? err.message : String(err),
        [{ text: "OK" }],
        "error",
      );
    }
  };

  const ensureCustomMeasurementType = async (label: string) => {
    const normalizedLabel = label.trim();
    const keyName = normalizedLabel
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    try {
      const type = await customMeasurementsApi.createType(
        keyName,
        normalizedLabel,
        "cm",
      );
      return type;
    } catch (error) {
      const types = await customMeasurementsApi.listTypes();
      const existing = types?.data?.find(
        (type: any) =>
          type.keyName === keyName ||
          type.label.toLowerCase() === normalizedLabel.toLowerCase(),
      );
      if (existing) return existing;
      throw error;
    }
  };

  const handleLogMeasurement = async () => {
    const hasStandardMeasurement =
      newWaist.trim() !== "" ||
      newArmLeft.trim() !== "" ||
      newArmRight.trim() !== "" ||
      newChest.trim() !== "";
    const hasCustomMeasurement =
      newCustomBodyPart.trim() !== "" && newCustomBodyPartValue.trim() !== "";

    if (!hasStandardMeasurement && !hasCustomMeasurement)
      return alert(
        "Invalid Input",
        "Enter at least one measurement or a custom body part",
        [{ text: "OK" }],
        "error",
      );

    if (
      newCustomBodyPartValue.trim() !== "" &&
      isNaN(parseFloat(newCustomBodyPartValue))
    )
      return alert(
        "Invalid Input",
        "Enter a valid value for the custom body part",
        [{ text: "OK" }],
        "error",
      );

    try {
      const recordedAt = selectedLogDate
        ? buildLocalISOForDate(selectedLogDate, "08:00")
        : undefined;

      if (hasStandardMeasurement) {
        await bodyMeasurementsApi.logMeasurement(
          newWaist ? parseFloat(newWaist) : undefined,
          newArmLeft ? parseFloat(newArmLeft) : undefined,
          newArmRight ? parseFloat(newArmRight) : undefined,
          newChest ? parseFloat(newChest) : undefined,
          recordedAt,
        );
      }

      if (hasCustomMeasurement) {
        const type = await ensureCustomMeasurementType(newCustomBodyPart);
        await customMeasurementsApi.logValue(
          type.id,
          parseFloat(newCustomBodyPartValue),
          recordedAt,
        );
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
      alert(
        "Error",
        err instanceof Error ? err.message : String(err),
        [{ text: "OK" }],
        "error",
      );
    }
  };

  const handleLogHydration = async () => {
    const amt = parseFloat(newHydrationAmount);
    if (!newHydrationAmount || isNaN(amt))
      return alert(
        "Invalid Input",
        "Enter a valid amount in ml",
        [{ text: "OK" }],
        "error",
      );
    try {
      const recordedAt = selectedLogDate
        ? buildLocalISOForDate(selectedLogDate, "12:00")
        : null;
      await hydrationApi.logHydration(amt);
      setNewHydrationAmount("");
      setShowHydrationModal(false);
      setSelectedLogDate(null);
      alert("Success", "Hydration logged!", [{ text: "OK" }], "success");
      loadTabData();
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : String(err),
        [{ text: "OK" }],
        "error",
      );
    }
  };

  const loadMoreWeightEntries = () =>
    setWeightEntriesShown((prev: number) =>
      Math.min(prev + 10, weightHistory.length),
    );

  // ─────────────────────────────────────────────────────────────
  // CALENDAR HAS-DATA CHECKERS
  // ─────────────────────────────────────────────────────────────
  const hasWeightData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return weightHistory.some(
      (e) => isoToLocalDateStr(e?.recorded_at) === dateStr,
    );
  };

  const hasPhotoData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return progressPhotos.some(
      (p) => isoToLocalDateStr(p?.takenAt) === dateStr,
    );
  };

  const hasMacrosData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return macrosEntries.some((e) => isoToLocalDateStr(e?.date) === dateStr);
  };

  const hasBodyFatData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return bodyFatHistory.some((b) => isoToLocalDateStr(b?.date) === dateStr);
  };

  const hasMeasurementsData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return measurementHistory.some(
      (m) => isoToLocalDateStr(m?.measuredAt ?? m?.recorded_at) === dateStr,
    );
  };

  const hasHydrationData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return hydrationEntries.some(
      (h) => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === dateStr,
    );
  };

  const hasSorenessData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return sorenessEntries.some(
      (s) =>
        isoToLocalDateStr(s?.loggedAt ?? s?.recorded_at ?? s?.date) === dateStr,
    );
  };

  const hasCycleData = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return cycleEntries.some(
      (c) =>
        isoToLocalDateStr(
          c?.cycleStart ?? c?.startDate ?? c?.recorded_at ?? c?.date,
        ) === dateStr,
    );
  };

  // ─────────────────────────────────────────────────────────────
  // HEIGHT
  // ─────────────────────────────────────────────────────────────
  const saveHeight = async () => {
    try {
      let heightValue;
      if (heightUnit === "cm") {
        heightValue = parseFloat(newHeightCm);
        if (!heightValue || isNaN(heightValue) || heightValue <= 0)
          return alert(
            "Invalid Input",
            "Enter a valid height",
            [{ text: "OK" }],
            "error",
          );
      } else {
        const ft = parseFloat(newHeightFt);
        if (!ft || isNaN(ft) || ft <= 0)
          return alert(
            "Invalid Input",
            "Enter valid feet",
            [{ text: "OK" }],
            "error",
          );
        heightValue = ft;
      }
      const heightData = {
        value: heightValue,
        unit: heightUnit,
        ...(heightUnit === "ft" && { inches: parseFloat(newHeightIn) || 0 }),
      };
      // FIX: cast as any to satisfy HeightInput interface
      await bodyTrackingApi.saveHeightAndUnits(
        heightData as any,
        weightUnit as "kg" | "lbs",
      );
      await loadData();
      setShowHeightModal(false);
      setNewHeightCm("");
      setNewHeightFt("");
      setNewHeightIn("");
      alert("Success", "Height saved!", [{ text: "OK" }], "success");
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "An error occurred",
        [{ text: "OK" }],
        "error",
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size='large' color='#667eea' />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>
          Loading tracking data…
        </Text>
      </SafeAreaView>
    );
  }

  const weightTrend = getWeightTrend();

  const renderPhotoGrid = () => {
    if (progressPhotos.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No progress photos yet</Text>
        </View>
      );
    }
    const grouped: Record<string, ProgressPhoto[]> = {};
    progressPhotos.forEach((p) => {
      const d = isoToLocalDateStr(p?.takenAt);
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(p);
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    return sortedDates.slice(0, 10).map((dateStr: string) => {
      const photos = grouped[dateStr];
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "short", month: "short", day: "numeric" },
      );
      return (
        <View key={dateStr} style={styles.photoGroupContainer}>
          <Text style={styles.photoGroupDate}>{label}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoGroupRow}
          >
            {photos.map((photo: ProgressPhoto) => {
              const uri = photoUriCache[photo.id];
              const isLoading = !uri && photoUriLoading[photo.id];
              const isError = uri === "error";
              const isReady = uri && !isError;
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoThumbWrap}
                  activeOpacity={isReady ? 0.8 : 1}
                  onPress={() => isReady && setExpandedPhoto({ uri, photo })}
                >
                  {isReady ? (
                    <Image
                      source={{ uri }}
                      style={styles.photoThumb}
                      resizeMode='cover'
                    />
                  ) : isError ? (
                    <View style={[styles.photoThumb, styles.photoThumbError]}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      <ActivityIndicator size='small' color='#667eea' />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoThumbDelete}
                    onPress={() => deletePhoto(photo)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.photoThumbDeleteText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    });
  };

  const renderDayModalExistingEntries = () => {
    const existingEntries = dayModal?.existingEntries as
      | any[]
      | null
      | undefined;
    if (!existingEntries || existingEntries.length === 0) return null;
    // FIX: use non-null assertion since we already checked dayModal via existingEntries
    const { tab } = dayModal!;

    if (tab === "weight") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry, i: number) => {
            const wkg = Number(entry.weight_kg);
            const val =
              weightUnit === "kg"
                ? `${wkg.toFixed(1)} kg`
                : `${(wkg * 2.20462).toFixed(1)} lbs`;
            const time = new Date(entry.recorded_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <Text style={styles.existingEntryTime}>{time}</Text>
                <Text style={styles.existingEntryValue}>{val}</Text>
                <TouchableOpacity
                  onPress={() => deleteWeightEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.existingEntryDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      );
    }

    if (tab === "macros") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry, i: number) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                {entry.name ? (
                  <Text style={styles.existingEntryName}>{entry.name}</Text>
                ) : null}
                <Text style={styles.existingEntryTime}>{entry.time}</Text>
                <Text style={styles.existingEntryMacros}>
                  {[
                    entry.calories != null
                      ? `${parseFloat(entry.calories).toFixed(0)} kcal`
                      : null,
                    entry.protein != null
                      ? `P:${parseFloat(entry.protein).toFixed(0)}g`
                      : null,
                    entry.carbs != null
                      ? `C:${parseFloat(entry.carbs).toFixed(0)}g`
                      : null,
                    entry.fat != null
                      ? `F:${parseFloat(entry.fat).toFixed(0)}g`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteMacroEntry(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    if (tab === "photos") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Photos on this day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 6 }}
          >
            {existingEntries.map((photo: ProgressPhoto) => {
              const uri = photoUriCache[photo.id];
              const isLoading = !uri && photoUriLoading[photo.id];
              const isError = uri === "error";
              const isReady = uri && !isError;
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoThumbWrap}
                  activeOpacity={isReady ? 0.8 : 1}
                  onPress={() => isReady && setExpandedPhoto({ uri, photo })}
                >
                  {isReady ? (
                    <Image
                      source={{ uri }}
                      style={styles.photoThumb}
                      resizeMode='cover'
                    />
                  ) : isError ? (
                    <View style={[styles.photoThumb, styles.photoThumbError]}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      <ActivityIndicator size='small' color='#667eea' />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoThumbDelete}
                    onPress={() => deletePhoto(photo)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.photoThumbDeleteText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (tab === "bodyfat") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged measurement</Text>
          {existingEntries.map((entry, i: number) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.existingEntryValue}>
                  {Number(entry.percentage).toFixed(1)}%
                </Text>
                <Text style={styles.existingEntryTime}>
                  Waist{" "}
                  {entry.measurements?.waist != null
                    ? Number(entry.measurements.waist).toFixed(1)
                    : "—"}
                  cm · Neck{" "}
                  {entry.measurements?.neck != null
                    ? Number(entry.measurements.neck).toFixed(1)
                    : "—"}
                  cm
                  {entry.measurements?.hip != null &&
                  entry.measurements.hip !== 0
                    ? ` · Hip ${Number(entry.measurements.hip).toFixed(1)}cm`
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteBodyFatEntry(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    if (tab === "measurements") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged measurements</Text>
          {existingEntries.map((entry: any, i: number) => {
            const time = new Date(
              entry.measuredAt ?? entry.recorded_at ?? "",
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.existingEntryTime}>{time}</Text>
                  <Text style={styles.existingEntryValue}>
                    {entry.typeLabel ?? entry.type_label ?? "Measurement"}:{" "}
                    {entry.value}
                    {entry.unit ? ` ${entry.unit}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteMeasurementEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.existingEntryDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      );
    }

    if (tab === "hydration") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry: any, i: number) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.existingEntryTime}>
                  {entry.time ?? new Date(entry.createdAt).toLocaleTimeString()}
                </Text>
                <Text style={styles.existingEntryValue}>
                  {(entry.amount ?? 0).toFixed(0)} ml
                </Text>
                <TouchableOpacity
                  onPress={() => deleteHydrationEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.existingEntryDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (tab === "soreness") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry: any, i: number) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.existingEntryValue}>
                  {entry.muscleGroup ??
                    entry.muscle ??
                    entry.muscle_group ??
                    "—"}
                </Text>
                <Text style={styles.existingEntryTime}>
                  Intensity: {entry.intensity ?? entry.value ?? 0}/10
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteSorenessEntry(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER HELPERS — WIDGET CONTENT
  // ─────────────────────────────────────────────────────────────
  // Everything that used to live statically behind each tab is now a
  // widget within that tab's own board. This one function renders the
  // body of any widget from any of the four registries (Weight / Photos /
  // Macros / Body Fat) — WidgetsPanel handles the shared card chrome
  // (icon, title, drag/resize/remove in edit mode); it's typed loosely
  // here since it's shared across four differently-typed boards.
  const renderWidgetContent = (
    instance: WidgetInstance<string>,
  ): React.ReactNode => {
    switch (instance.type) {
      case "weight_overview": {
        return weightHistory.length > 0 ? (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Current Weight</Text>
            <Text style={styles.statsValue}>
              {weightUnit === "kg"
                ? `${Number(weightHistory[0].weight_kg).toFixed(1)} kg`
                : `${(Number(weightHistory[0].weight_kg) * 2.20462).toFixed(1)} lbs`}
            </Text>
            <Text style={styles.statsDate}>
              {new Date(weightHistory[0].recorded_at).toLocaleDateString()}
            </Text>
            {weightTrend && (
              <View style={styles.trendContainer}>
                <View
                  style={[
                    styles.trendBadge,
                    weightTrend.direction === "up"
                      ? styles.trendUp
                      : weightTrend.direction === "down"
                        ? styles.trendDown
                        : styles.trendStable,
                  ]}
                >
                  <Text style={styles.trendIcon}>
                    {weightTrend.direction === "up"
                      ? "↗"
                      : weightTrend.direction === "down"
                        ? "↘"
                        : "→"}
                  </Text>
                  <Text style={styles.trendText}>
                    {Math.abs(weightTrend.diff).toFixed(1)} {weightUnit}
                  </Text>
                  <Text style={styles.trendPercent}>
                    ({weightTrend.percentChange > 0 ? "+" : ""}
                    {weightTrend.percentChange.toFixed(1)}%)
                  </Text>
                </View>
                <Text style={styles.trendSubtext}>
                  vs. {weightTrend.daysCompared}-day average
                </Text>
                <View style={styles.trendSelector}>
                  {[3, 7, 14, 30].map((days: number) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.trendOption,
                        trendAverageDays === days && styles.trendOptionActive,
                      ]}
                      onPress={() => setTrendAverageDays(days)}
                    >
                      <Text
                        style={[
                          styles.trendOptionText,
                          trendAverageDays === days &&
                            styles.trendOptionTextActive,
                        ]}
                      >
                        {days}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                setShowWeightModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Weight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No weight data logged yet</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                setShowWeightModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Weight</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "weight_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasWeightData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "weight")
            }
            initialView='week'
            legendText='Weight logged · tap any day to view/add'
            dotColor='#667eea'
          />
        );
      }

      case "weight_history": {
        if (weightHistory.length === 0) {
          return (
            <Text style={styles.widgetLineMuted}>
              Log a weight entry to see your history here.
            </Text>
          );
        }
        return (
          <View>
            {weightHistory.slice(0, weightEntriesShown).map((entry, index) => {
              const val =
                weightUnit === "kg"
                  ? `${Number(entry.weight_kg).toFixed(1)} kg`
                  : `${(Number(entry.weight_kg) * 2.20462).toFixed(1)} lbs`;
              const isLatest = index === 0;
              return (
                <View
                  key={entry.id ?? index}
                  style={[
                    styles.weightEntryRow,
                    index ==
                      weightHistory.slice(0, weightEntriesShown).length - 1 &&
                      styles.weightEntryRowBorder,
                  ]}
                >
                  <View>
                    <Text style={styles.weightEntryDate}>
                      {new Date(entry.recorded_at).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text style={styles.weightEntryTime}>
                      {new Date(entry.recorded_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.weightEntryRight}>
                    <View style={styles.weightEntryValueRow}>
                      <Text
                        style={[
                          styles.weightEntryValue,
                          isLatest && styles.weightEntryValueLatest,
                        ]}
                      >
                        {val}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteEntryBtn}
                        onPress={() => deleteWeightEntry(entry)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteEntryBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                    {isLatest && (
                      <Text style={styles.weightEntryLatestBadge}>latest</Text>
                    )}
                  </View>
                </View>
              );
            })}
            {weightEntriesShown < weightHistory.length && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMoreWeightEntries}
              >
                <Text style={styles.loadMoreText}>
                  View More ({weightHistory.length - weightEntriesShown} more)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case "weight_chart": {
        if (weightHistory.length <= 1) {
          return (
            <Text style={styles.widgetLineMuted}>
              Log at least two weight entries to see a trend chart here.
            </Text>
          );
        }
        return (
          <ProgressChart
            title='Weight Trend'
            icon='📈'
            data={getWeightChartData()}
            yAxisSuffix={weightUnit}
          />
        );
      }

      case "photos_calendar":
        return <PhotosCalendarWidget />;

      case "photos_gallery":
        return <PhotosGalleryWidget />;

      case "macros_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasMacrosData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "macros")
            }
            initialView='week'
            legendText='Macros logged · tap any day to view/add'
            dotColor='#ef4444'
          />
        );
      }

      case "macros_today": {
        const todayStats = getDailyMacrosStats(new Date());
        return (
          <View>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => {
                setMacrosGoalInput({
                  protein: String(dailyMacrosGoals.protein),
                  carbs: String(dailyMacrosGoals.carbs),
                  fat: String(dailyMacrosGoals.fat),
                  calories: String(dailyMacrosGoals.calories),
                });
                setShowMacrosGoalModal(true);
              }}
            >
              <Text style={styles.goalButtonText}>
                {dailyMacrosGoals.calories} kcal goal
              </Text>
            </TouchableOpacity>
            {todayStats ? (
              <View style={styles.macrosStatsCard}>
                <Text style={styles.macrosStatsTitle}>Today's Intake</Text>
                {[
                  {
                    key: "calories",
                    label: "Calories",
                    unit: "kcal",
                    color: colors.warning,
                  },
                  {
                    key: "protein",
                    label: "Protein",
                    unit: "g",
                    color: colors.accent,
                  },
                  {
                    key: "carbs",
                    label: "Carbs",
                    unit: "g",
                    color: colors.success,
                  },
                  { key: "fat", label: "Fat", unit: "g", color: colors.error },
                ]
                  .filter(
                    ({ key }) =>
                      todayStats[key as keyof DailyMacrosStats] != null,
                  )
                  .map(({ key, label, unit, color }) => {
                    const macro = todayStats[key as keyof DailyMacrosStats]!;
                    return (
                      <View key={key} style={styles.macroRow}>
                        <View style={styles.macroLabelRow}>
                          <Text style={styles.macroLabel}>{label}</Text>
                          <Text style={styles.macroValue}>
                            {macro.total.toFixed(0)}
                            {unit}
                            <Text style={styles.macroRange}>
                              {" "}
                              ({macro.min.toFixed(0)}–{macro.max.toFixed(0)})
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.macroProgressBar}>
                          <View
                            style={[
                              styles.macroProgressFill,
                              {
                                width: `${Math.min(macro.percentage, 100)}%`,
                                backgroundColor: color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.macroProgressText}>
                          {macro.percentage.toFixed(0)}% of {macro.goal}
                          {unit} goal
                        </Text>
                      </View>
                    );
                  })}
                <Text style={styles.macrosEntriesCount}>
                  {todayStats.entries}{" "}
                  {todayStats.entries === 1 ? "entry" : "entries"} logged
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No macros logged today</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                setShowMacrosModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Macros</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "bodyfat_height": {
        return (
          <View style={styles.heightCard}>
            {height && height.height_cm ? (
              <View style={styles.heightDisplay}>
                <View style={styles.heightInfo}>
                  <Text style={styles.heightLabel}>Your Height</Text>
                  <Text style={styles.heightValue}>
                    {heightUnit === "cm"
                      ? `${height.height_cm.toFixed(1)} cm`
                      : `${Math.floor(height.height_cm / 2.54 / 12)}' ${Math.round((height.height_cm / 2.54) % 12)}"`}
                  </Text>
                  <Text style={styles.heightNote}>
                    Required for body fat calculation
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.heightEditButton}
                  onPress={() => {
                    if (height?.height_cm) {
                      if (heightUnit === "cm")
                        setNewHeightCm(String(height.height_cm.toFixed(1)));
                      else {
                        const ti = height.height_cm / 2.54;
                        setNewHeightFt(String(Math.floor(ti / 12)));
                        setNewHeightIn(String(Math.round(ti % 12)));
                      }
                    }
                    setShowHeightModal(true);
                  }}
                >
                  <Text style={styles.heightEditButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.heightSetButton}
                onPress={() => setShowHeightModal(true)}
              >
                <Text style={styles.heightSetIcon}>📏</Text>
                <View style={styles.heightSetTextContainer}>
                  <Text style={styles.heightSetTitle}>Set Your Height</Text>
                  <Text style={styles.heightSetSubtitle}>
                    Required to calculate body fat percentage
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case "bodyfat_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasBodyFatData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "bodyfat")
            }
            initialView='week'
            legendText='Measurement taken · tap any day to view/add'
            dotColor='#8b5cf6'
          />
        );
      }

      case "bodyfat_latest": {
        return (
          <View>
            {bodyFatHistory.length > 0 ? (
              <View style={styles.bodyFatCard}>
                <Text style={styles.bodyFatLabel}>Latest Measurement</Text>
                <Text style={styles.bodyFatValue}>
                  {Number(
                    bodyFatHistory[0].percentage ??
                      (bodyFatHistory[0] as { body_fat_percentage?: number })
                        .body_fat_percentage ??
                      0,
                  ).toFixed(1)}
                  %
                </Text>
                <Text style={styles.bodyFatDate}>
                  {new Date(
                    bodyFatHistory[0].date ??
                      bodyFatHistory[0].recorded_at ??
                      "",
                  ).toLocaleDateString()}
                </Text>
                <Text style={styles.bodyFatMethod}>US Navy Method</Text>
                <TouchableOpacity
                  style={styles.bodyFatDeleteBtn}
                  onPress={() => deleteBodyFatEntry(bodyFatHistory[0])}
                >
                  <Text style={styles.bodyFatDeleteBtnText}>
                    🗑 Delete this reading
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.widgetLineMuted}>
                No body fat measurements yet.
              </Text>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                setShowBodyFatModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>
                📐 Calculate Body Fat
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      // ─────────────────────────────────────────────────────
      // MEASUREMENTS WIDGETS
      // ─────────────────────────────────────────────────────
      case "measurements_overview": {
        if (measurementHistory.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📏</Text>
              <Text style={styles.trackerEmptyText}>No measurements yet.</Text>
              <TouchableOpacity
                style={[
                  styles.trackerHeroButton,
                  {
                    backgroundColor: "#10b981",
                    marginTop: 0,
                    paddingHorizontal: 16,
                  },
                ]}
                onPress={() => {
                  setSelectedLogDate(null);
                  setShowMeasurementModal(true);
                }}
              >
                <Text style={styles.trackerHeroButtonText}>
                  + Log Measurements
                </Text>
              </TouchableOpacity>
            </View>
          );
        }
        const latest = measurementHistory[0];
        return (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Latest Measurements</Text>
            <Text style={styles.statsValue}>
              {`Waist: ${latest.waistCm ?? latest.waist ?? "—"} cm`}
            </Text>
            <Text style={styles.statsValue}>
              {`Left Arm: ${latest.armLeftCm ?? latest.arm_left ?? "—"} cm`}
            </Text>
            <Text style={styles.statsValue}>
              {`Right Arm: ${latest.armRightCm ?? latest.arm_right ?? "—"} cm`}
            </Text>
            <Text style={styles.statsValue}>
              {`Chest: ${latest.chestCm ?? latest.chest ?? "—"} cm`}
            </Text>
            <Text style={styles.statsDate}>
              {new Date(
                latest.measuredAt ?? latest.recorded_at ?? latest.date ?? "",
              ).toLocaleDateString()}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                setShowMeasurementModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Measurements</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "measurements_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasMeasurementsData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "measurements")
            }
            initialView='week'
            legendText='Measurements logged · tap any day to view/add'
            dotColor='#10b981'
          />
        );
      }

      case "measurements_history": {
        if (measurementHistory.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📏</Text>
              <Text style={styles.trackerEmptyText}>
                No measurement entries yet.
              </Text>
              <TouchableOpacity
                style={[
                  styles.trackerHeroButton,
                  {
                    backgroundColor: "#10b981",
                    marginTop: 0,
                    paddingHorizontal: 16,
                  },
                ]}
                onPress={() => {
                  setSelectedLogDate(null);
                  setShowMeasurementModal(true);
                }}
              >
                <Text style={styles.trackerHeroButtonText}>
                  + Log Measurements
                </Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View>
            {measurementHistory.map((entry: any, index: number) => (
              <View
                key={entry.id ?? index}
                style={[
                  styles.weightEntryRow,
                  index < measurementHistory.length - 1 &&
                    styles.weightEntryRowBorder,
                ]}
              >
                <View>
                  <Text style={styles.weightEntryDate}>
                    {new Date(
                      entry.measuredAt ?? entry.recorded_at ?? entry.date ?? "",
                    ).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.weightEntryTime}>
                    {`Waist ${Number(entry.waistCm ?? entry.waist ?? 0).toFixed(1)} cm · Chest ${Number(entry.chestCm ?? entry.chest ?? 0).toFixed(1)} cm`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteEntryBtn}
                  onPress={async () => {
                    try {
                      await bodyMeasurementsApi.deleteMeasurementEntry(
                        entry.id,
                      );
                      setMeasurementHistory((prev) =>
                        prev.filter((e) => e.id !== entry.id),
                      );
                    } catch (err) {
                      alert(
                        "Error",
                        err instanceof Error ? err.message : String(err),
                        [{ text: "OK" }],
                        "error",
                      );
                    }
                  }}
                >
                  <Text style={styles.deleteEntryBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      }

      // ─────────────────────────────────────────────────────
      // HYDRATION WIDGETS
      // ─────────────────────────────────────────────────────
      case "hydration_overview": {
        const todayStr = toLocalDateStr(new Date());
        const totalToday = hydrationEntries
          .filter(
            (h) =>
              isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === todayStr,
          )
          .reduce(
            (s, e) => s + (Number(e.amountMl ?? e.amount_ml ?? e.amount) || 0),
            0,
          );
        const pct = hydrationGoal
          ? Math.min(100, Math.round((totalToday / hydrationGoal) * 100))
          : 0;
        return (
          <View
            style={[
              styles.trackerHeroCard,
              { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" },
            ]}
          >
            <View style={styles.trackerHeroTop}>
              <View
                style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}
              >
                <Text style={styles.trackerHeroBadgeIcon}>💧</Text>
              </View>
              <Text style={[styles.trackerHeroLabel, { color: "#0369a1" }]}>
                {pct}% of goal
              </Text>
            </View>
            <Text style={[styles.trackerHeroValue, { color: "#0c4a6e" }]}>
              {`${totalToday} / ${hydrationGoal} ml`}
            </Text>
            <Text style={styles.trackerHeroDate}>
              {new Date().toLocaleDateString()}
            </Text>
            <TouchableOpacity
              style={[styles.trackerHeroButton, { backgroundColor: "#0369a1" }]}
              onPress={() => {
                setSelectedLogDate(null);
                openHydrationModal();
              }}
            >
              <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "hydration_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasHydrationData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "hydration")
            }
            initialView='week'
            legendText='Hydration logged · tap any day to view/add'
            dotColor='#667eea'
          />
        );
      }

      case "hydration_history": {
        if (hydrationEntries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>💧</Text>
              <Text style={styles.trackerEmptyText}>
                No hydration entries yet.
              </Text>
              <TouchableOpacity
                style={[
                  styles.trackerHeroButton,
                  {
                    backgroundColor: "#0369a1",
                    marginTop: 0,
                    paddingHorizontal: 16,
                  },
                ]}
                onPress={() => {
                  setSelectedLogDate(null);
                  openHydrationModal();
                }}
              >
                <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
              </TouchableOpacity>
            </View>
          );
        return (
          <View style={styles.trackerHistoryList}>
            {hydrationEntries.map((h: any, i: number) => (
              <View
                key={h.id ?? i}
                style={[
                  styles.trackerHistoryRow,
                  i < hydrationEntries.length - 1 &&
                    styles.trackerHistoryRowBorder,
                ]}
              >
                <View style={styles.trackerHistoryLeft}>
                  <View
                    style={[
                      styles.trackerHistoryDot,
                      { backgroundColor: "#0ea5e9" },
                    ]}
                  />
                  <View>
                    <Text style={styles.trackerHistoryDate}>
                      {formatDateLabel(
                        h.loggedAt ?? h.recorded_at ?? h.date ?? null,
                      )}
                    </Text>
                    <Text
                      style={styles.trackerHistoryTime}
                    >{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                  </View>
                </View>
                <View style={styles.trackerHistoryRight}>
                  <Text
                    style={styles.trackerHistoryValue}
                  >{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                  <TouchableOpacity
                    style={styles.trackerDeleteBtn}
                    onPress={async () => {
                      try {
                        await hydrationApi.deleteHydrationEntry(h.id);
                        setHydrationEntries((prev) =>
                          prev.filter((e) => e.id !== h.id),
                        );
                      } catch (err) {
                        alert(
                          "Error",
                          err instanceof Error ? err.message : String(err),
                          [{ text: "OK" }],
                          "error",
                        );
                      }
                    }}
                  >
                    <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        );
      }

      case "hydration_goal": {
        return (
          <HydrationSettingsWidget
            onSettingsUpdate={({ goalMl }: { goalMl: number }) =>
              setHydrationGoal(goalMl)
            }
          />
        );
      }

      // ─────────────────────────────────────────────────────
      // SORENESS WIDGETS
      // ─────────────────────────────────────────────────────
      case "soreness_map": {
        if (sorenessEntries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>🔥</Text>
              <Text style={styles.trackerEmptyText}>
                No soreness logged yet.
              </Text>
              <TouchableOpacity
                style={[
                  styles.trackerHeroButton,
                  {
                    backgroundColor: "#ea580c",
                    marginTop: 0,
                    paddingHorizontal: 16,
                  },
                ]}
                onPress={() => {
                  setSelectedLogDate(null);
                  openSorenessModal();
                }}
              >
                <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
              </TouchableOpacity>
            </View>
          );
        // pick most recent soreness map
        const last = sorenessEntries[0];
        const lastIntensity = Number(last.intensity ?? last.value ?? 0);
        const intensityColor =
          lastIntensity <= 3
            ? "#22c55e"
            : lastIntensity <= 6
              ? "#f59e0b"
              : "#ef4444";
        return (
          <View
            style={[
              styles.trackerHeroCard,
              { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
            ]}
          >
            <View style={styles.trackerHeroTop}>
              <View
                style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}
              >
                <Text style={styles.trackerHeroBadgeIcon}>🔥</Text>
              </View>
              <Text
                style={[styles.trackerHeroLabel, { color: intensityColor }]}
              >
                {lastIntensity}/10
              </Text>
            </View>
            <Text style={[styles.trackerHeroValue, { color: "#9a3412" }]}>
              {last.muscleGroup ?? last.muscle ?? last.muscle_group ?? "—"}
            </Text>
            <Text style={styles.trackerHeroDate}>
              {new Date(
                last.loggedAt ?? last.recorded_at ?? last.date ?? "",
              ).toLocaleDateString()}
            </Text>
            <TouchableOpacity
              style={[styles.trackerHeroButton, { backgroundColor: "#ea580c" }]}
              onPress={() => {
                setSelectedLogDate(null);
                openSorenessModal();
              }}
            >
              <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "soreness_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasSorenessData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "soreness")
            }
            initialView='week'
            legendText='Soreness logged · tap any day to view/add'
            dotColor='#f97316'
          />
        );
      }

      case "soreness_history": {
        if (sorenessEntries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>🔥</Text>
              <Text style={styles.trackerEmptyText}>
                No soreness entries yet.
              </Text>
            </View>
          );
        return (
          <View style={styles.trackerHistoryList}>
            {sorenessEntries.map((s: any, i: number) => {
              const val = Number(s.intensity ?? s.value ?? 0);
              const dotColor =
                val <= 3 ? "#22c55e" : val <= 6 ? "#f59e0b" : "#ef4444";
              return (
                <View
                  key={s.id ?? i}
                  style={[
                    styles.trackerHistoryRow,
                    i < sorenessEntries.length - 1 &&
                      styles.trackerHistoryRowBorder,
                  ]}
                >
                  <View style={styles.trackerHistoryLeft}>
                    <View
                      style={[
                        styles.trackerHistoryDot,
                        { backgroundColor: dotColor },
                      ]}
                    />
                    <View>
                      <Text style={styles.trackerHistoryDate}>
                        {new Date(
                          s.loggedAt ?? s.recorded_at ?? s.date ?? "",
                        ).toLocaleDateString()}
                      </Text>
                      <Text
                        style={styles.trackerHistoryTime}
                      >{`${s.muscleGroup ?? s.muscle ?? s.muscle_group ?? "—"} · ${val}/10`}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.trackerDeleteBtn}
                    onPress={async () => {
                      try {
                        await sorenessApi.deleteSorenessEntry(s.id);
                        setSorenessEntries((prev) =>
                          prev.filter((e) => e.id !== s.id),
                        );
                      } catch (err) {
                        alert(
                          "Error",
                          err instanceof Error ? err.message : String(err),
                          [{ text: "OK" }],
                          "error",
                        );
                      }
                    }}
                  >
                    <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      }

      // ─────────────────────────────────────────────────────
      // MENSTRUAL WIDGETS
      // ─────────────────────────────────────────────────────
      case "menstrual_overview": {
        if (cycleEntries.length === 0)
          return <Text style={styles.widgetLineMuted}>No cycle data yet.</Text>;
        const last = cycleEntries[0];
        const lastPhase =
          getCyclePhaseLabel(
            getCycleStartIso(last),
            menstrualPrefs.periodLengthDays,
            menstrualPrefs.cycleLengthDays,
          ) ?? "—";
        return (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Cycle Status</Text>
            <Text style={styles.statsValue}>{`Phase: ${lastPhase}`}</Text>
            <Text style={styles.statsDate}>
              {`Started: ${formatDateLabel(getCycleStartIso(last))}`}{" "}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setSelectedLogDate(null);
                openCycleModal();
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Cycle</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "menstrual_calendar": {
        return (
          <UniversalCalendar
            hasDataOnDate={hasCycleData}
            onDatePress={(date: Date) =>
              handleCalendarDatePress(date, "menstrual")
            }
            initialView='month'
            legendText='Cycle start · tap any day to view/add'
            dotColor='#ec4899'
            // decorate actual vs predicted menstrual days
            getDayDecoration={(date: Date) => {
              const ds = toLocalDateStr(date);
              if (cycleActualDays.has(ds)) {
                return {
                  backgroundColor: "rgba(224,79,95,0.12)",
                  dotColor: "#e04f5f",
                };
              }
              if (cyclePredictedDays.has(ds)) {
                return {
                  backgroundColor: "rgba(239,68,68,0.20)",
                  dotColor: "#ef4444",
                };
              }
              return null;
            }}
          />
        );
      }

      case "menstrual_cycle": {
        // Compact, collapsible settings widget + quick log button
        return (
          <View>
            <CycleSettingsWidget
              onSettingsUpdate={async ({
                periodDays,
                cycleLengthDays,
              }: {
                periodDays: number;
                cycleLengthDays: number;
              }) => {
                const updatedPrefs = {
                  periodLengthDays: periodDays,
                  cycleLengthDays,
                };
                setMenstrualPrefs(updatedPrefs);
                await saveToStorage(
                  STORAGE_KEYS.MENSTRUAL_PREFS,
                  updatedPrefs,
                  String(user?.id ?? ""),
                );
                // refresh predictions — project forward from the most
                // recent cycle using the newly-saved settings, covering
                // the next several months.
                try {
                  const mostRecentStartIso =
                    cycleEntries.length > 0
                      ? getCycleStartIso(cycleEntries[0])
                      : null;
                  const nextSet = computeUpcomingPredictedDays(
                    mostRecentStartIso,
                    cycleLengthDays,
                    periodDays,
                  );
                  setCyclePredictedDays(nextSet);
                } catch (e) {
                  console.warn("Failed to refresh cycle predictions:", e);
                }
              }}
            />
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={() => {
                setSelectedLogDate(new Date());
                openCycleModal();
              }}
            >
              <Text style={styles.primaryButtonText}>+ Log Cycle Today</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "menstrual_history": {
        if (cycleEntries.length === 0)
          return (
            <Text style={styles.widgetLineMuted}>No cycle history yet.</Text>
          );
        return (
          <View>
            {cycleEntries.map((c: any, i: number) => {
              const entryId = c.id ?? i;
              const entryKey = String(entryId);
              const isExpanded = expandedCycleIds.has(entryKey);
              const startDateLabel = formatDateLabel(getCycleStartIso(c));
              return (
                <View key={entryKey} style={styles.cycleHistoryRow}>
                  <TouchableOpacity
                    style={[
                      styles.weightEntryRow,
                      i < cycleEntries.length - 1 &&
                        styles.weightEntryRowBorder,
                    ]}
                    onPress={() => toggleExpandedCycle(entryKey)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weightEntryDate}>
                        {startDateLabel}
                      </Text>
                      <Text style={styles.weightEntryTime}>
                        {`Duration: ${getCycleDuration(c)} days · Flow: ${getCycleFlowLabel(c)}`}
                      </Text>
                    </View>
                    <Text style={styles.cycleToggleText}>
                      {isExpanded ? "Hide details" : "Show details"}
                    </Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.cycleDetailsBox}>
                      {i === 0 &&
                        (() => {
                          const phase = getCyclePhaseLabel(
                            getCycleStartIso(c),
                            menstrualPrefs.periodLengthDays,
                            menstrualPrefs.cycleLengthDays,
                          );
                          return phase ? (
                            <Text style={styles.cycleDetailsLine}>
                              Phase: {phase}
                            </Text>
                          ) : null;
                        })()}
                      <Text style={styles.cycleDetailsLine}>
                        Cycle start: {startDateLabel}
                      </Text>
                      <Text style={styles.cycleDetailsLine}>
                        Period length: {getCycleDuration(c)} days
                      </Text>
                      {(c.notes || c.note) && (
                        <Text style={styles.cycleDetailsNote}>
                          Note:{" "}
                          {Array.isArray(c.notes)
                            ? c.notes[0]
                            : (c.notes ?? c.note)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      }

      // ─────────────────────────────────────────────────────
      // SORENESS / RECOVERY WIDGETS
      // ─────────────────────────────────────────────────────
      // case "muscle_map":
      //   return <MuscleMapWidget />;

      case "doms_followup":
        return <DOMSFollowUpWidget />;

      case "doms_heatmap":
        return <DOMSHeatmapWidget />;

      case "injury_tracker":
        return <InjuryTrackerWidget />;

      // ─────────────────────────────────────────────────────
      // MEASUREMENTS WIDGETS
      // ─────────────────────────────────────────────────────
      case "measurements_chart": {
        if (customMeasurementEntries.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📈</Text>
              <Text style={styles.trackerEmptyText}>
                No measurements to chart yet.
              </Text>
            </View>
          );
        }
        // Build chart data from measurements history
        const raw = customMeasurementEntries
          .slice(0, 30)
          .reverse()
          .map((m: any) => {
            const date = new Date(
              m.loggedAt ?? m.recorded_at ?? m.date ?? new Date(),
            );
            return {
              label: date.toISOString().split("T")[0],
              value:
                parseFloat(String(m.waist ?? m.value ?? m.measurement ?? 0)) ||
                0,
            };
          });
        return (
          <ProgressChart
            title='Measurements'
            icon='📏'
            data={{
              labels: raw.map((r) => r.label),
              datasets: [{ data: raw.map((r) => r.value) }],
            }}
            yAxisSuffix='cm'
          />
        );
      }

      // ─────────────────────────────────────────────────────
      // PHOTOS WIDGETS
      // ─────────────────────────────────────────────────────
      case "photos_comparison":
        return <PhotosComparisonWidget />;

      case "photos_muscle_notes":
        return <PhotosMuscleNotesWidget />;

      case "photos_muscle_view":
        return <PhotosMuscleViewWidget />;

      default:
        return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  // Which registry backs the currently-active tab — WidgetsPanel needs
  // this alongside activeBoard's widgets/handlers to know each widget's
  // icon, title, sizes, etc.

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]} {...panHandlers}>
      {isPulling && (
        <View pointerEvents='none' style={styles.pullHint}>
          <Text style={styles.pullHintText}>
            {pullDistance > 90
              ? "Release to add a widget ✨"
              : "Pull to add a widget ↓"}
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.container}
        scrollEnabled={!isPulling}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor='#667eea'
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📊 Advanced Tracking</Text>
            <Text style={styles.subtitle}>
              Comprehensive body composition and nutrition tracking
            </Text>
          </View>

          {/* TAB SELECTOR */}
          <ScrollTabBar
            tabs={TRACKING_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            storageKey='trackingScreen_tabConfig'
          />

          <View style={styles.widgetsSectionHeader}>
            <Text style={styles.widgetsSectionTitle}>
              {widgetEditMode ? "Editing Widgets" : " "}
            </Text>
            {widgetEditMode ? (
              <TouchableOpacity
                onPress={() => setWidgetEditMode(false)}
                hitSlop={8}
              >
                <Text style={styles.widgetsEditToggle}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.addWidgetButton}
                onPress={() => setShowWidgetGallery(true)}
              >
                <Text style={styles.addWidgetButtonText}>+ Widget</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeBoard.isLoaded && activeBoard.widgets.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No widgets on this tab yet</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowWidgetGallery(true)}
              >
                <Text style={styles.primaryButtonText}>+ Add a Widget</Text>
              </TouchableOpacity>
            </View>
          )}

          <WidgetsPanel
            key={activeTab}
            widgets={activeBoard.widgets}
            isLoaded={activeBoard.isLoaded}
            editMode={widgetEditMode}
            onCycleSize={activeBoard.cycleWidgetSize}
            onRemove={activeBoard.removeWidget}
            onReorder={activeBoard.reorderWidgets}
            renderContent={renderWidgetContent}
            registry={activeRegistry as any}
          />
        </View>
      </ScrollView>

      <WidgetGallery
        visible={showWidgetGallery}
        onClose={() => setShowWidgetGallery(false)}
        availableWidgets={activeBoard.availableToAdd as any}
        onAddWidget={handleAddWidget}
        hasPlacedWidgets={activeBoard.widgets.length > 0}
        onEditWidgets={handleEditWidgets}
      />

      {/* ════════════════════════════════════════
          ALL MODALS — outside ScrollView
      ════════════════════════════════════════ */}

      {/* Weight Modal */}
      <ModalSheet
        visible={showWeightModal}
        onClose={() => {
          setShowWeightModal(false);
          setSelectedLogDate(null);
        }}
        title='Log Weight'
        onConfirm={addWeight}
      >
        <TextInput
          style={styles.input}
          placeholder={`Enter weight (${weightUnit})`}
          keyboardType='decimal-pad'
          value={newWeight}
          onChangeText={setNewWeight}
        />
      </ModalSheet>

      {/* Height Modal */}
      <ModalSheet
        visible={showHeightModal}
        onClose={() => {
          setShowHeightModal(false);
          setNewHeightCm("");
          setNewHeightFt("");
          setNewHeightIn("");
        }}
        title='Set Height'
        onConfirm={saveHeight}
        confirmText='Save'
        scrollable={false}
      >
        <Text style={styles.inputLabel}>Unit:</Text>
        <View style={styles.unitToggle}>
          {["cm", "ft"].map((u: string) => (
            <TouchableOpacity
              key={u}
              style={[
                styles.unitButton,
                heightUnit === u && styles.unitButtonActive,
              ]}
              onPress={() => {
                setHeightUnit(u);
                setNewHeightCm("");
                setNewHeightFt("");
                setNewHeightIn("");
              }}
            >
              <Text
                style={[
                  styles.unitButtonText,
                  heightUnit === u && styles.unitButtonTextActive,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {heightUnit === "cm" ? (
          <>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 175'
              keyboardType='decimal-pad'
              value={newHeightCm}
              onChangeText={setNewHeightCm}
            />
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Feet</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 5'
              keyboardType='decimal-pad'
              value={newHeightFt}
              onChangeText={setNewHeightFt}
            />
            <Text style={styles.inputLabel}>Inches</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 10'
              keyboardType='decimal-pad'
              value={newHeightIn}
              onChangeText={setNewHeightIn}
            />
          </>
        )}
      </ModalSheet>

      <LogCycleModal
        visible={modalState.cycleModalOpen}
        onClose={closeCycleModal}
        prefillDate={selectedLogDate ?? undefined}
        onSuccess={() => {
          loadTabData();
        }}
      />

      <LogHydrationModal
        visible={modalState.hydrationModalOpen}
        onClose={() => {
          closeHydrationModal();
          setSelectedLogDate(null);
        }}
        onSuccess={() => {
          loadTabData();
        }}
      />

      <LogSorenessModal
        visible={modalState.sorenessModalOpen}
        onClose={() => {
          closeSorenessModal();
          setSelectedLogDate(null);
        }}
        onSuccess={() => {
          loadTabData();
        }}
      />

      <ModalSheet
        visible={showMacrosModal}
        onClose={() => {
          setShowMacrosModal(false);
          setSelectedLogDate(null);
        }}
        title='Log Macros'
        onConfirm={addMacrosEntry}
        scrollable={true}
      >
        <Text style={styles.inputLabel}>
          Name{" "}
          <Text style={styles.inputLabelOptional}>(e.g. "Chicken & rice")</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder='What did you eat? (optional)'
          value={newMacrosName}
          onChangeText={setNewMacrosName}
          autoCapitalize='words'
        />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>
            Fill in what you know — all fields below are optional
          </Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Calories (kcal)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 420'
          keyboardType='decimal-pad'
          value={newMacrosCalories}
          onChangeText={setNewMacrosCalories}
        />
        <Text style={styles.inputLabel}>Protein (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 32'
          keyboardType='decimal-pad'
          value={newMacrosProtein}
          onChangeText={setNewMacrosProtein}
        />
        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 45'
          keyboardType='decimal-pad'
          value={newMacrosCarbs}
          onChangeText={setNewMacrosCarbs}
        />
        <Text style={styles.inputLabel}>Fat (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 12'
          keyboardType='decimal-pad'
          value={newMacrosFat}
          onChangeText={setNewMacrosFat}
        />
        <Text style={styles.inputLabel}>Time</Text>
        <TextInput
          style={styles.input}
          placeholder='HH:MM'
          value={newMacrosTime}
          onChangeText={setNewMacrosTime}
        />
        <Text style={styles.inputLabel}>Measurement Error (±%)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 5  →  ±5%'
          keyboardType='decimal-pad'
          value={newMacrosError}
          onChangeText={setNewMacrosError}
        />
        <Text style={styles.modalHint}>
          Error margin is used to calculate a min/max range for your totals
        </Text>
      </ModalSheet>

      {/* Macros Goals Modal */}
      <ModalSheet
        visible={showMacrosGoalModal}
        onClose={() => setShowMacrosGoalModal(false)}
        title='Set Daily Macros Goals'
        onConfirm={updateMacrosGoals}
        scrollable={true}
      >
        <Text style={styles.inputLabel}>Protein goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 150'
          keyboardType='decimal-pad'
          value={macrosGoalInput.protein}
          onChangeText={(v) =>
            setMacrosGoalInput((p) => ({ ...p, protein: v }))
          }
        />
        <Text style={styles.inputLabel}>Carbohydrates goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 250'
          keyboardType='decimal-pad'
          value={macrosGoalInput.carbs}
          onChangeText={(v) => setMacrosGoalInput((p) => ({ ...p, carbs: v }))}
        />
        <Text style={styles.inputLabel}>Fat goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 65'
          keyboardType='decimal-pad'
          value={macrosGoalInput.fat}
          onChangeText={(v) => setMacrosGoalInput((p) => ({ ...p, fat: v }))}
        />
        <Text style={styles.inputLabel}>Calories goal (kcal)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 2000'
          keyboardType='decimal-pad'
          value={macrosGoalInput.calories}
          onChangeText={(v) =>
            setMacrosGoalInput((p) => ({ ...p, calories: v }))
          }
        />
      </ModalSheet>

      {/* Body Fat Modal */}
      <ModalSheet
        visible={showBodyFatModal}
        onClose={() => {
          setShowBodyFatModal(false);
          setSelectedLogDate(null);
        }}
        title='Calculate Body Fat %'
        subtitle='US Navy Method'
        onConfirm={calculateBodyFat}
        confirmText='Calculate'
        scrollable={true}
      >
        <View style={styles.genderToggle}>
          {["male", "female"].map((g: string) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && styles.genderButtonActive,
              ]}
              onPress={() => {
                setGender(g);
                AsyncStorage.setItem(getUserKey("gender"), g);
              }}
            >
              <Text
                style={[
                  styles.genderButtonText,
                  gender === g && styles.genderButtonTextActive,
                ]}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.unitToggleContainer}>
          <Text style={styles.inputLabel}>Unit:</Text>
          <View style={styles.unitToggle}>
            {["cm", "in"].map((u: string) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.unitButton,
                  measurementUnit === u && styles.unitButtonActive,
                ]}
                onPress={() => setMeasurementUnit(u)}
              >
                <Text style={styles.unitButtonText}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={styles.inputLabel}>Waist ({measurementUnit})</Text>
        <TextInput
          style={styles.input}
          placeholder='Measure at navel'
          keyboardType='decimal-pad'
          value={waist}
          onChangeText={setWaist}
        />
        <Text style={styles.inputLabel}>Neck ({measurementUnit})</Text>
        <TextInput
          style={styles.input}
          placeholder='Measure below larynx'
          keyboardType='decimal-pad'
          value={neck}
          onChangeText={setNeck}
        />
        {gender === "female" && (
          <>
            <Text style={styles.inputLabel}>Hip ({measurementUnit})</Text>
            <TextInput
              style={styles.input}
              placeholder='Measure at widest point'
              keyboardType='decimal-pad'
              value={hip}
              onChangeText={setHip}
            />
          </>
        )}
      </ModalSheet>

      {/* Measurement Modal */}
      <ModalSheet
        visible={showMeasurementModal}
        onClose={() => {
          setShowMeasurementModal(false);
          setSelectedLogDate(null);
        }}
        title='Log Measurements'
        onConfirm={handleLogMeasurement}
      >
        <Text style={styles.inputLabel}>Waist (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 80'
          keyboardType='decimal-pad'
          value={newWaist}
          onChangeText={setNewWaist}
        />
        <Text style={styles.inputLabel}>Left Arm (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 30'
          keyboardType='decimal-pad'
          value={newArmLeft}
          onChangeText={setNewArmLeft}
        />
        <Text style={styles.inputLabel}>Right Arm (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 30'
          keyboardType='decimal-pad'
          value={newArmRight}
          onChangeText={setNewArmRight}
        />
        <Text style={styles.inputLabel}>Chest (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 100'
          keyboardType='decimal-pad'
          value={newChest}
          onChangeText={setNewChest}
        />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>Custom Body Part</Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Body Part Name</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., Calves'
          value={newCustomBodyPart}
          onChangeText={setNewCustomBodyPart}
          autoCapitalize='words'
        />
        <Text style={styles.inputLabel}>Value (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 38'
          keyboardType='decimal-pad'
          value={newCustomBodyPartValue}
          onChangeText={setNewCustomBodyPartValue}
        />
      </ModalSheet>

      {/* Hydration Modal */}
      <ModalSheet
        visible={showHydrationModal}
        onClose={() => {
          setShowHydrationModal(false);
          setSelectedLogDate(null);
        }}
        title='Log Hydration'
        onConfirm={handleLogHydration}
      >
        <Text style={styles.inputLabel}>Amount (ml)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 250'
          keyboardType='decimal-pad'
          value={newHydrationAmount}
          onChangeText={setNewHydrationAmount}
        />
      </ModalSheet>

      {/* Per-day Flow Modal (menstrual) */}
      <ModalSheet
        visible={showFlowModal}
        onClose={() => {
          setShowFlowModal(false);
          setFlowModalDate(null);
          setFlowModalCycleEntry(null);
        }}
        title='Set Flow Intensity'
        onConfirm={async () => {
          if (!flowModalDate) return;
          try {
            await menstrualApi.setDayFlow(flowModalDate, flowModalIntensity);
            setShowFlowModal(false);
            setFlowModalDate(null);
            setFlowModalCycleEntry(null);
            // reload menstrual data so decorations reflect changes
            await loadFromServer();
            alert("Saved", "Flow intensity saved", [{ text: "OK" }], "success");
          } catch (err) {
            alert(
              "Error",
              err instanceof Error ? err.message : String(err),
              [{ text: "OK" }],
              "error",
            );
          }
        }}
      >
        <Text style={styles.inputLabel}>Date</Text>
        <Text style={{ marginBottom: 12 }}>{flowModalDate}</Text>

        <Text style={styles.inputLabel}>Intensity</Text>
        <View style={{ flexDirection: "row", marginTop: 8 }}>
          {(["light", "moderate", "heavy"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionButton,
                flowModalIntensity === opt && styles.optionButtonActive,
                { marginRight: 8 },
              ]}
              onPress={() => setFlowModalIntensity(opt)}
            >
              <Text
                style={
                  flowModalIntensity === opt
                    ? styles.optionButtonTextActive
                    : styles.optionButtonText
                }
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {flowModalCycleEntry && (
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => {
              alert(
                "Delete Period?",
                "This removes the entire logged period that started on this date, not just this day.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await menstrualApi.deleteMenstrualEntry(
                          flowModalCycleEntry.id,
                        );
                        setShowFlowModal(false);
                        setFlowModalDate(null);
                        setFlowModalCycleEntry(null);
                        await loadFromServer();
                        alert(
                          "Deleted",
                          "Period deleted",
                          [{ text: "OK" }],
                          "success",
                        );
                      } catch (err) {
                        alert(
                          "Error",
                          err instanceof Error ? err.message : String(err),
                          [{ text: "OK" }],
                          "error",
                        );
                      }
                    },
                  },
                ],
                "warning",
              );
            }}
          >
            <Text style={styles.dangerButtonText}>🗑 Delete This Period</Text>
          </TouchableOpacity>
        )}
      </ModalSheet>

      {/* UNIFIED DAY MODAL */}
      <ModalSheet
        visible={!!dayModal}
        onClose={() => {
          setDayModal(null);
          setSelectedLogDate(null);
        }}
        showCancelButton={false}
        showConfirmButton={false}
        scrollable={true}
      >
        <View style={styles.dayModalHeader}>
          <View style={styles.dayModalIconCircle}>
            <Text style={styles.dayModalIcon}>
              {dayModal?.tab === "weight"
                ? "⚖️"
                : dayModal?.tab === "macros"
                  ? "🥗"
                  : dayModal?.tab === "photos"
                    ? "📸"
                    : dayModal?.tab === "bodyfat"
                      ? "📐"
                      : dayModal?.tab === "measurements"
                        ? "📏"
                        : dayModal?.tab === "hydration"
                          ? "💧"
                          : dayModal?.tab === "soreness"
                            ? "💪"
                            : dayModal?.tab === "menstrual"
                              ? "🌸"
                              : "📐"}
            </Text>
          </View>
          <View style={styles.dayModalHeaderText}>
            <Text style={styles.dayModalTitle}>
              {dayModal?.tab === "weight"
                ? "Weight"
                : dayModal?.tab === "macros"
                  ? "Macros"
                  : dayModal?.tab === "photos"
                    ? "Photos"
                    : dayModal?.tab === "bodyfat"
                      ? "Body Fat"
                      : dayModal?.tab === "measurements"
                        ? "Measurements"
                        : dayModal?.tab === "hydration"
                          ? "Hydration"
                          : dayModal?.tab === "soreness"
                            ? "Soreness"
                            : dayModal?.tab === "menstrual"
                              ? "Cycle"
                              : "Entry"}
            </Text>
            <Text style={styles.dayModalSubtitle}>
              {dayModal?.isToday
                ? "Today"
                : dayModal?.date?.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
            </Text>
          </View>
        </View>
        <View style={styles.dayModalDivider} />

        {renderDayModalExistingEntries()}

        {(!dayModal?.existingEntries ||
          dayModal.existingEntries.length === 0) && (
          <View style={styles.dayModalEmptyState}>
            <Text style={styles.dayModalEmptyIcon}>
              {dayModal?.tab === "weight"
                ? "⚖️"
                : dayModal?.tab === "macros"
                  ? "🥗"
                  : dayModal?.tab === "photos"
                    ? "📸"
                    : dayModal?.tab === "bodyfat"
                      ? "📐"
                      : dayModal?.tab === "measurements"
                        ? "📏"
                        : dayModal?.tab === "hydration"
                          ? "💧"
                          : dayModal?.tab === "soreness"
                            ? "💪"
                            : dayModal?.tab === "menstrual"
                              ? "🌸"
                              : "📐"}
            </Text>
            <Text style={styles.dayModalEmptyText}>
              No entries for this day
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.logEntryBtn}
          onPress={() => openLogModalForTab(dayModal?.tab ?? activeTab)}
        >
          <Text style={styles.logEntryBtnText}>
            {dayModal?.tab === "weight"
              ? "⚖️ Log Weight"
              : dayModal?.tab === "macros"
                ? "🥗 Log Macros"
                : dayModal?.tab === "photos"
                  ? "📸 Add Photo"
                  : dayModal?.tab === "bodyfat"
                    ? "📐 Calculate Body Fat"
                    : dayModal?.tab === "measurements"
                      ? "📏 Log Measurements"
                      : dayModal?.tab === "hydration"
                        ? "💧 Log Water"
                        : dayModal?.tab === "soreness"
                          ? "💪 Log Soreness"
                          : dayModal?.tab === "menstrual"
                            ? "🌸 Log Cycle"
                            : "Add Entry"}
          </Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* Fullscreen Photo Viewer */}
      <ModalSheet
        visible={!!expandedPhoto}
        onClose={() => setExpandedPhoto(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setExpandedPhoto(null)}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {expandedPhoto && (
            <Image
              source={{ uri: expandedPhoto.uri }}
              style={styles.photoViewerImage}
              resizeMode='contain'
            />
          )}
          {expandedPhoto?.photo &&
            (() => {
              const p = expandedPhoto.photo as unknown as {
                takenAt?: string;
                taken_at?: string;
                note?: string;
              };
              const takenAt = p.takenAt ?? p.taken_at;
              return (
                <View style={styles.photoViewerInfo}>
                  <Text style={styles.photoViewerTime}>
                    {takenAt
                      ? new Date(takenAt).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : ""}
                    {"  ·  "}
                    {takenAt
                      ? new Date(takenAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </Text>
                  {(p.note ??
                    (expandedPhoto.photo as { note?: string }).note) && (
                    <Text style={styles.photoViewerNote}>
                      {p.note ??
                        (expandedPhoto.photo as { note?: string }).note}
                    </Text>
                  )}
                </View>
              );
            })()}
        </View>
      </ModalSheet>

      {/* Custom Alert */}
      {AlertComponent}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 60, paddingBottom: 120 },
    header: { marginBottom: 25, alignItems: "center" },
    addWidgetButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    addWidgetButtonText: {
      color: colors.surface,
      fontSize: 13,
      fontWeight: "700",
    },
    widgetsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    widgetsSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    widgetsEditToggle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
    },
    pullHint: {
      position: "absolute",
      top: 8,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 10,
    },
    pullHintText: {
      backgroundColor: colors.accent,
      color: colors.surface,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      overflow: "hidden",
    },
    widgetLineMuted: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },

    weightHistoryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 15,
    },
    weightHistoryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    weightEntryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    weightEntryRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    weightEntryDate: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.textPrimary,
    },
    weightEntryTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    weightEntryRight: { alignItems: "flex-end" },
    weightEntryValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    weightEntryValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    weightEntryValueLatest: { color: colors.accent, fontSize: 18 },
    weightEntryLatestBadge: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: "600",
      marginTop: 2,
    },
    deleteEntryBtn: { padding: 4, opacity: 0.55 },
    deleteEntryBtnText: { fontSize: 15 },
    loadMoreButton: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.accentLight,
      alignItems: "center",
    },
    loadMoreText: { fontSize: 14, color: colors.accent, fontWeight: "600" },

    trendContainer: { marginTop: 12, alignItems: "center" },
    trendBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    trendUp: { backgroundColor: colors.errorLight },
    trendDown: { backgroundColor: colors.successLight },
    trendStable: { backgroundColor: colors.separator },
    trendIcon: { fontSize: 16, fontWeight: "bold" },
    trendText: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    trendPercent: { fontSize: 12, color: colors.textSecondary },
    trendSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    trendSelector: {
      flexDirection: "row",
      marginTop: 12,
      gap: 8,
      backgroundColor: colors.inputBackground,
      padding: 4,
      borderRadius: 10,
    },
    trendOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    trendOptionActive: { backgroundColor: colors.accent },
    trendOptionText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    trendOptionTextActive: { color: colors.surface, fontWeight: "700" },

    section: { marginBottom: 25 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },

    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 15,
      alignItems: "center",
    },
    statsTitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
    statsValue: { fontSize: 36, fontWeight: "bold", color: colors.accent },
    statsDate: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    statsSubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

    buttonRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.accent,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryButtonDisabled: { backgroundColor: colors.surfaceBorder },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 15,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.accent,
    },
    secondaryButtonText: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 15,
    },
    goalButton: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    goalButtonText: { color: colors.accent, fontWeight: "600", fontSize: 14 },

    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    statLabel: { fontSize: 15, color: colors.textSecondary },
    statValue: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },

    macrosStatsCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 15,
    },
    macrosStatsTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 16,
    },
    macroRow: { marginBottom: 16 },
    macroLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    macroLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    macroValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    macroRange: { fontSize: 12, color: colors.textMuted, fontWeight: "normal" },
    macroProgressBar: {
      height: 10,
      backgroundColor: colors.separator,
      borderRadius: 5,
      overflow: "hidden",
    },
    macroProgressFill: { height: "100%", borderRadius: 5 },
    macroProgressText: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
    macrosEntriesCount: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 4,
    },

    bodyFatCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      marginBottom: 15,
    },
    bodyFatLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    bodyFatValue: {
      fontSize: 48,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    bodyFatDate: { fontSize: 13, color: colors.textMuted },
    bodyFatMethod: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
      fontStyle: "italic",
    },
    bodyFatDeleteBtn: {
      marginTop: 16,
      backgroundColor: colors.errorLight,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    bodyFatDeleteBtnText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },

    emptyState: {
      alignItems: "center",
      padding: 40,
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 15,
    },
    emptyText: { fontSize: 16, color: colors.textMuted },

    inputLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 8,
    },
    inputLabelOptional: { fontSize: 12, color: "#aaa", fontWeight: "normal" },
    input: {
      color: colors.textSecondary,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    modalHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 15,
      textAlign: "center",
    },
    optionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.separator,
    },
    optionButtonActive: { backgroundColor: colors.accent },
    optionButtonText: { color: colors.textSecondary, fontWeight: "600" },
    optionButtonTextActive: { color: colors.surface, fontWeight: "700" },

    genderToggle: { flexDirection: "row", gap: 10, marginBottom: 15 },
    genderButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.separator,
      alignItems: "center",
    },
    genderButtonActive: { backgroundColor: colors.accent },
    genderButtonText: { color: colors.textSecondary, fontWeight: "600" },
    genderButtonTextActive: { color: colors.surface },

    unitToggleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    unitToggle: {
      flexDirection: "row",
      marginLeft: "auto",
      backgroundColor: colors.separator,
      borderRadius: 8,
      padding: 2,
    },
    unitButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    unitButtonActive: { backgroundColor: colors.accent },
    unitButtonText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 12,
    },
    unitButtonTextActive: { color: colors.surface },

    optionalDivider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 12,
      gap: 8,
    },
    optionalDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.inputBorder,
    },
    optionalDividerText: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      flexShrink: 1,
    },

    photoGroupContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    photoGroupDate: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    photoGroupRow: { flexDirection: "row" },
    photoThumbWrap: { marginRight: 10, position: "relative" },
    photoThumb: { width: 110, height: 140, borderRadius: 10 },
    photoThumbLoading: {
      backgroundColor: colors.infoLight,
      alignItems: "center",
      justifyContent: "center",
    },
    photoThumbError: {
      backgroundColor: colors.errorLight,
      alignItems: "center",
      justifyContent: "center",
    },
    photoThumbDelete: {
      position: "absolute",
      top: 5,
      right: 5,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    photoThumbDeleteText: {
      color: colors.surface,
      fontSize: 10,
      fontWeight: "700",
    },

    existingEntriesSection: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
      marginBottom: 4,
    },
    existingEntriesTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    existingEntryRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      gap: 10,
    },
    existingEntryTime: { fontSize: 12, color: colors.textMuted, minWidth: 44 },
    existingEntryValue: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    existingEntryName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    existingEntryMacros: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    existingEntryNote: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: "italic",
      flex: 1,
    },
    existingEntryDelete: { fontSize: 17, opacity: 0.55 },
    cycleHistoryRow: {
      marginBottom: 12,
    },
    cycleToggleText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
      alignSelf: "center",
    },
    cycleDetailsBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    cycleDetailsLine: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    cycleDetailsNote: {
      fontSize: 13,
      color: colors.textPrimary,
      fontStyle: "italic",
    },

    logEntryBtn: {
      marginTop: 20,
      backgroundColor: colors.accent,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    logEntryBtnText: { color: colors.surface, fontWeight: "700", fontSize: 16 },

    dayModalEmptyState: { alignItems: "center", paddingVertical: 32 },
    dayModalEmptyIcon: { fontSize: 40, marginBottom: 10, opacity: 0.3 },
    dayModalEmptyText: { fontSize: 15, color: colors.textMuted },

    dayModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    dayModalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 16,
    },
    dayModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      paddingBottom: 16,
      gap: 12,
    },
    dayModalIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentLight,
      alignItems: "center",
      justifyContent: "center",
    },
    dayModalIcon: { fontSize: 22 },
    dayModalHeaderText: { flex: 1 },
    dayModalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.background,
    },
    dayModalSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    dayModalDivider: {
      height: 1,
      backgroundColor: colors.separator,
      marginHorizontal: 20,
    },

    heightCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 15,
      borderWidth: 2,
      borderColor: colors.infoLight,
    },
    heightDisplay: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heightInfo: { flex: 1 },
    heightLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    heightValue: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    heightNote: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
    heightEditButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    heightEditButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 14,
    },
    heightSetButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.warningLight,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.warning,
      borderStyle: "dashed",
    },
    heightSetIcon: { fontSize: 32, marginRight: 12 },
    heightSetTextContainer: { flex: 1 },
    heightSetTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#92400e",
      marginBottom: 4,
    },
    heightSetSubtitle: { fontSize: 13, color: "#92400e" },

    photoViewerOverlay: {
      flex: 1,
      backgroundColor: colors.shadow,
      justifyContent: "center",
      alignItems: "center",
    },
    photoViewerClose: {
      position: "absolute",
      top: 54,
      right: 20,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    photoViewerCloseText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "700",
    },
    photoViewerImage: { width, height: SCREEN_HEIGHT * 0.8 },
    photoViewerInfo: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingVertical: 20,
      paddingHorizontal: 24,
      paddingBottom: 36,
    },
    photoViewerTime: {
      color: colors.surface,
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
    photoViewerNote: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 13,
      textAlign: "center",
      marginTop: 4,
      fontStyle: "italic",
    },

    // ─────────────────────────────────────────────────────
    // Tracker cards — dedicated look for the Hydration, Soreness and
    // Soreness tab widgets (kept separate from the shared statsCard /
    // weightEntryRow styles so other tabs are unaffected).
    // ─────────────────────────────────────────────────────
    trackerHeroCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 18,
    },
    trackerHeroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    trackerHeroBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    trackerHeroBadgeIcon: { fontSize: 18 },
    trackerHeroLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    trackerHeroValue: {
      fontSize: 28,
      fontWeight: "700",
      marginTop: 10,
    },
    trackerHeroSubtext: {
      fontSize: 13,
      fontWeight: "500",
      marginTop: 4,
    },
    trackerHeroDate: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    trackerHeroButton: {
      marginTop: 14,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
    },
    trackerHeroButtonText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    trackerEmptyCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderStyle: "dashed",
      padding: 24,
      alignItems: "center",
    },
    trackerEmptyIcon: { fontSize: 24, marginBottom: 8 },
    trackerEmptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 12,
    },
    trackerHistoryList: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: "hidden",
    },
    trackerHistoryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    trackerHistoryRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    trackerHistoryLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    trackerHistoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 10,
    },
    trackerHistoryDate: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    trackerHistoryTime: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    trackerHistoryRight: { flexDirection: "row", alignItems: "center" },
    trackerHistoryValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
      marginRight: 10,
    },
    trackerDeleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    trackerDeleteBtnText: { fontSize: 13 },
    dangerButton: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#fca5a5",
      backgroundColor: "#fee2e2",
      alignItems: "center",
      justifyContent: "center",
    },
    dangerButtonText: {
      color: "#7f1d1d",
      fontSize: 14,
      fontWeight: "600",
    },
  });
