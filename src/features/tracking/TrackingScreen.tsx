import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { setStorageItem } from "@shared/services/sqliteStorage"
import logger from "@shared/services/logger"
import { useAuth } from "@shared/context/AuthContext";
import { useTheme } from "@shared/context/ThemeContext";
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
import { useTrackingModals as useTrackingModalsCtx } from "./context/TrackingModalsContext";
import {
  LogCycleModal,
  LogSorenessModal,
  LogHydrationModal,
} from "./tabs";
import {
  renderWeightWidget,
  renderBodyFatWidget,
  renderHydrationWidget,
  renderMeasurementWidget,
  renderMacrosWidget,
  renderSorenessWidget,
  renderMenstrualWidget,
  renderPhotosWidget,
} from "./widgets";
import { useWidgets } from "@shared/context/hooks/useWidgets";
import type { WidgetInstance } from "@shared/types";
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
import type { ProgressPhoto } from "@shared/types";
import { useWeightTab } from "./hooks/useWeightTab";
import { useMacrosTab } from "./hooks/useMacrosTab";
import { useBodyFatTab } from "./hooks/useBodyFatTab";
import { usePhotosTab } from "./hooks/usePhotosTab";
import { useMeasurementsTab } from "./hooks/useMeasurementsTab";
import { useHydrationTab } from "./hooks/useHydrationTab";
import { useSorenessTab } from "./hooks/useSorenessTab";
import { useMenstrualTab } from "./hooks/useMenstrualTab";
import { buildLocalISOForDate, isoToLocalDateStr, getCycleStartIso, getCycleDuration } from "./utils";
import { toDateString } from "@utils/format";
import { getUserKey } from "@shared/services/storage";
import makeStyles from "./styles";

const { width } = Dimensions.get("window");

const registryMap: Record<
  string,
  {
    registry: Record<string, any>;
    defaultWidgets: any[];
    storageKey: string;
  }
> = {
  weight: {
    registry: WEIGHT_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_WEIGHT_WIDGETS,
    storageKey: WEIGHT_WIDGETS_STORAGE_KEY,
  },
  photos: {
    registry: PHOTOS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_PHOTOS_WIDGETS,
    storageKey: PHOTOS_WIDGETS_STORAGE_KEY,
  },
  macros: {
    registry: MACROS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MACROS_WIDGETS,
    storageKey: MACROS_WIDGETS_STORAGE_KEY,
  },
  bodyfat: {
    registry: BODYFAT_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_BODYFAT_WIDGETS,
    storageKey: BODYFAT_WIDGETS_STORAGE_KEY,
  },
  measurements: {
    registry: MEASUREMENTS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MEASUREMENTS_WIDGETS,
    storageKey: MEASUREMENTS_WIDGETS_STORAGE_KEY,
  },
  hydration: {
    registry: HYDRATION_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_HYDRATION_WIDGETS,
    storageKey: HYDRATION_WIDGETS_STORAGE_KEY,
  },
  soreness: {
    registry: SORENESS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_SORENESS_WIDGETS,
    storageKey: SORENESS_WIDGETS_STORAGE_KEY,
  },
  menstrual: {
    registry: MENSTRUAL_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MENSTRUAL_WIDGETS,
    storageKey: MENSTRUAL_WIDGETS_STORAGE_KEY,
  },
};

export default function TrackingScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
    setShowWidgetGallery(true);
  });
  const modalState = useTrackingModalsCtx();
  const { alert } = useAlert();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ─────────────────────────────────────────────────────────────
  // SCREEN-LOCAL STATE
  // ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("weight");
  const [widgetEditMode, setWidgetEditMode] = useState(false);
  const [showWidgetGallery, setShowWidgetGallery] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowModalDate, setFlowModalDate] = useState<string | null>(null);
  const [flowModalIntensity, setFlowModalIntensity] = useState<"light" | "moderate" | "heavy">("light");
  const [flowModalCycleEntry, setFlowModalCycleEntry] = useState<any>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ uri: string; photo: ProgressPhoto } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dayModal, setDayModal] = useState<{ date: Date; tab: string; existingEntries: any[]; isToday: boolean } | null>(null);
  const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);
  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(new Set());
  const toggleExpandedCycle = useCallback((id: string) => {
    setExpandedCycleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // TAB HOOKS — extracted state, handlers (data loading is screen-level)
  // ─────────────────────────────────────────────────────────────
  const loadDataRef = useRef<() => Promise<void> | void>(() => {});

  const _weight = useWeightTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, user });
  const _macros = useMacrosTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate });
  const _bodyFat = useBodyFatTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, height: _weight.height, getUserKey });
  const _photos = usePhotosTab({ alert, loadData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, authToken: null, activeTab });
  const _measurements = useMeasurementsTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab });
  const _hydration = useHydrationTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab });
  const _soreness = useSorenessTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, activeTab });
  const _menstrual = useMenstrualTab({ alert, loadFromServer: loadDataRef.current as any, user });

  // Adapters — normalize hook returns to names the JSX expects
  const weight = {
    history: _weight.weightHistory, setHistory: _weight.setWeightHistory,
    weightUnit: _weight.weightUnit, setWeightUnit: _weight.setWeightUnit,
    showWeightModal: _weight.showWeightModal, openWeightModal: _weight.openWeightModal, closeWeightModal: () => _weight.setShowWeightModal(false),
    newWeight: _weight.newWeight, setNewWeight: _weight.setNewWeight,
    entriesShown: _weight.weightEntriesShown, setEntriesShown: _weight.setWeightEntriesShown,
    trendAverageDays: _weight.trendAverageDays, setTrendAverageDays: _weight.setTrendAverageDays,
    trend: _weight.getWeightTrend(),
    chartData: _weight.getWeightChartData(),
    loadMoreEntries: _weight.loadMoreWeightEntries,
    deleteWeightEntry: _weight.deleteWeightEntry,
    addWeight: _weight.addWeight,
    hasDataOnDate: _weight.hasWeightData,
    height: _weight.height, setHeight: _weight.setHeight,
    heightUnit: _weight.heightUnit, setHeightUnit: _weight.setHeightUnit,
    showHeightModal: _weight.showHeightModal, openHeightModal: () => _weight.setShowHeightModal(true), closeHeightModal: () => _weight.setShowHeightModal(false),
    newHeightCm: _weight.newHeightCm, setNewHeightCm: _weight.setNewHeightCm,
    newHeightFt: _weight.newHeightFt, setNewHeightFt: _weight.setNewHeightFt,
    newHeightIn: _weight.newHeightIn, setNewHeightIn: _weight.setNewHeightIn,
  };

  const macros = {
    entries: _macros.macrosEntries, setEntries: _macros.setMacrosEntries,
    goals: _macros.dailyMacrosGoals, setGoals: _macros.setDailyMacrosGoals,
    showMacrosModal: _macros.showMacrosModal, openMacrosModal: _macros.openMacrosModal, closeMacrosModal: () => _macros.setShowMacrosModal(false),
    showMacrosGoalModal: _macros.showMacrosGoalModal, openGoalModal: () => _macros.setShowMacrosGoalModal(true), closeGoalModal: () => _macros.setShowMacrosGoalModal(false),
    newName: _macros.newMacrosName, setNewName: _macros.setNewMacrosName,
    newCalories: _macros.newMacrosCalories, setNewCalories: _macros.setNewMacrosCalories,
    newProtein: _macros.newMacrosProtein, setNewProtein: _macros.setNewMacrosProtein,
    newCarbs: _macros.newMacrosCarbs, setNewCarbs: _macros.setNewMacrosCarbs,
    newFat: _macros.newMacrosFat, setNewFat: _macros.setNewMacrosFat,
    newTime: _macros.newMacrosTime, setNewTime: _macros.setNewMacrosTime,
    newError: _macros.newMacrosError, setNewError: _macros.setNewMacrosError,
    goalsInput: _macros.macrosGoalInput, setGoalsInput: _macros.setMacrosGoalInput,
    deleteMacroEntry: _macros.deleteMacroEntry,
    addMacrosEntry: _macros.addMacrosEntry,
    updateMacrosGoals: _macros.updateMacrosGoals,
    dailyStats: _macros.getDailyMacrosStats(new Date()),
    hasDataOnDate: _macros.hasMacrosData,
    savedFoods: _macros.savedFoods,
    rememberEntry: _macros.rememberMacrosEntry, setRememberEntry: _macros.setRememberMacrosEntry,
    quickLogSavedFood: _macros.quickLogSavedFood,
    removeSavedFood: _macros.removeSavedFood,
  };

  const bodyFat = {
    history: _bodyFat.bodyFatHistory, setHistory: _bodyFat.setBodyFatHistory,
    height: _weight.height,
    heightUnit: _weight.heightUnit, setHeightUnit: _weight.setHeightUnit,
    showHeightModal: _weight.showHeightModal, openHeightModal: () => _weight.setShowHeightModal(true), closeHeightModal: () => _weight.setShowHeightModal(false),
    newHeightCm: _weight.newHeightCm, setNewHeightCm: _weight.setNewHeightCm,
    newHeightFt: _weight.newHeightFt, setNewHeightFt: _weight.setNewHeightFt,
    newHeightIn: _weight.newHeightIn, setNewHeightIn: _weight.setNewHeightIn,
    showBodyFatModal: _bodyFat.showBodyFatModal, openBodyFatModal: _bodyFat.openBodyFatModal, closeBodyFatModal: () => _bodyFat.setShowBodyFatModal(false),
    gender: _bodyFat.gender, setGender: _bodyFat.setGender,
    waist: _bodyFat.waist, setWaist: _bodyFat.setWaist,
    neck: _bodyFat.neck, setNeck: _bodyFat.setNeck,
    hip: _bodyFat.hip, setHip: _bodyFat.setHip,
    measurementUnit: _bodyFat.measurementUnit, setMeasurementUnit: _bodyFat.setMeasurementUnit,
    deleteBodyFatEntry: _bodyFat.deleteBodyFatEntry,
    calculateBodyFat: _bodyFat.calculateBodyFat,
    saveHeight: _weight.saveHeight,
    hasDataOnDate: _bodyFat.hasBodyFatData,
  };

  const photos = {
    entries: _photos.progressPhotos, setEntries: _photos.setProgressPhotos,
    photoUriCache: _photos.photoUriCache,
    deletePhoto: _photos.deletePhoto,
    hasDataOnDate: ((date: Date) => false),
  };

  const measurements = {
    history: _measurements.measurementHistory, setHistory: _measurements.setMeasurementHistory,
    customEntries: _measurements.customMeasurementEntries, setCustomEntries: _measurements.setCustomMeasurementEntries,
    showMeasurementModal: _measurements.showMeasurementModal, openMeasurementModal: () => _measurements.setShowMeasurementModal(true), closeMeasurementModal: () => _measurements.setShowMeasurementModal(false),
    newWaist: _measurements.newWaist, setNewWaist: _measurements.setNewWaist,
    newArmLeft: _measurements.newArmLeft, setNewArmLeft: _measurements.setNewArmLeft,
    newArmRight: _measurements.newArmRight, setNewArmRight: _measurements.setNewArmRight,
    newChest: _measurements.newChest, setNewChest: _measurements.setNewChest,
    newCustomBodyPart: _measurements.newCustomBodyPart, setNewCustomBodyPart: _measurements.setNewCustomBodyPart,
    newCustomBodyPartValue: _measurements.newCustomBodyPartValue, setNewCustomBodyPartValue: _measurements.setNewCustomBodyPartValue,
    deleteMeasurementEntry: _measurements.deleteMeasurementEntry,
    handleLogMeasurement: _measurements.handleLogMeasurement,
    hasDataOnDate: _measurements.hasMeasurementsData,
  };

  const hydration = {
    entries: _hydration.hydrationEntries, setEntries: _hydration.setHydrationEntries,
    goal: _hydration.hydrationGoal, setGoal: _hydration.setHydrationGoal,
    showHydrationModal: modalState.state.hydrationModalOpen, openHydrationModal: modalState.openHydrationModal, closeHydrationModal: modalState.closeHydrationModal,
    newAmount: _hydration.newHydrationAmount, setNewAmount: _hydration.setNewHydrationAmount,
    deleteHydrationEntry: _hydration.deleteHydrationEntry,
    handleLogHydration: _hydration.handleLogHydration,
    hasDataOnDate: _hydration.hasHydrationData,
  };

  const soreness = {
    entries: _soreness.sorenessEntries, setEntries: _soreness.setSorenessEntries,
    openSorenessModal: modalState.openSorenessModal,
    deleteSorenessEntry: _soreness.deleteSorenessEntry,
    hasDataOnDate: _soreness.hasSorenessData,
  };

  const menstrual = {
    entries: _menstrual.cycleEntries, setEntries: _menstrual.setCycleEntries,
    prefs: _menstrual.menstrualPrefs, setPrefs: _menstrual.setMenstrualPrefs,
    actualDays: _menstrual.cycleActualDays,
    predictedDays: _menstrual.cyclePredictedDays, setPredictedDays: _menstrual.setCyclePredictedDays,
    openCycleModal: modalState.openCycleModal,
    hasDataOnDate: _menstrual.hasCycleData,
    isOnPeriod: _menstrual.isOnPeriod,
    markPeriodOver: _menstrual.markPeriodOver,
  };

  // ─────────────────────────────────────────────────────────────
  // WIDGET BOARDS
  // ─────────────────────────────────────────────────────────────

  const weightBoard = useWidgets<WeightWidgetType>(user?.id ?? null, { registry: WEIGHT_WIDGET_REGISTRY, defaults: DEFAULT_WEIGHT_WIDGETS, storageKey: WEIGHT_WIDGETS_STORAGE_KEY, enabled: activeTab === "weight" });
  const photosBoard = useWidgets<PhotosWidgetType>(user?.id ?? null, { registry: PHOTOS_WIDGET_REGISTRY, defaults: DEFAULT_PHOTOS_WIDGETS, storageKey: PHOTOS_WIDGETS_STORAGE_KEY, enabled: activeTab === "photos" });
  const macrosBoard = useWidgets<MacrosWidgetType>(user?.id ?? null, { registry: MACROS_WIDGET_REGISTRY, defaults: DEFAULT_MACROS_WIDGETS, storageKey: MACROS_WIDGETS_STORAGE_KEY, enabled: activeTab === "macros" });
  const bodyFatBoard = useWidgets<BodyFatWidgetType>(user?.id ?? null, { registry: BODYFAT_WIDGET_REGISTRY, defaults: DEFAULT_BODYFAT_WIDGETS, storageKey: BODYFAT_WIDGETS_STORAGE_KEY, enabled: activeTab === "bodyfat" });
  const measurementsBoard = useWidgets<MeasurementsWidgetType>(user?.id ?? null, { registry: MEASUREMENTS_WIDGET_REGISTRY, defaults: DEFAULT_MEASUREMENTS_WIDGETS, storageKey: MEASUREMENTS_WIDGETS_STORAGE_KEY, enabled: activeTab === "measurements" });
  const hydrationBoard = useWidgets<HydrationWidgetType>(user?.id ?? null, { registry: HYDRATION_WIDGET_REGISTRY, defaults: DEFAULT_HYDRATION_WIDGETS, storageKey: HYDRATION_WIDGETS_STORAGE_KEY, enabled: activeTab === "hydration" });
  const sorenessBoard = useWidgets<SorenessWidgetType>(user?.id ?? null, { registry: SORENESS_WIDGET_REGISTRY, defaults: DEFAULT_SORENESS_WIDGETS, storageKey: SORENESS_WIDGETS_STORAGE_KEY, enabled: activeTab === "soreness" });
  const menstrualBoard = useWidgets<MenstrualWidgetType>(user?.id ?? null, { registry: MENSTRUAL_WIDGET_REGISTRY, defaults: DEFAULT_MENSTRUAL_WIDGETS, storageKey: MENSTRUAL_WIDGETS_STORAGE_KEY, enabled: activeTab === "menstrual" });
  const boardMap: Record<string, any> = { weight: weightBoard, photos: photosBoard, macros: macrosBoard, bodyfat: bodyFatBoard, measurements: measurementsBoard, hydration: hydrationBoard, soreness: sorenessBoard, menstrual: menstrualBoard };
  const activeBoard = boardMap[activeTab] ?? weightBoard;
  const activeRegistry = registryMap[activeTab]?.registry ?? WEIGHT_WIDGET_REGISTRY;

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────

  // Each tab's history is fetched only once its tab is actually visited,
  // not all eight at once on mount — avoids hammering SQLite for tabs the
  // user may never open this session.
  const tabLoaders: Record<string, () => Promise<void>> = {
    weight: async () => { const w = await bodyTrackingApi.getWeightHistory(200); _weight.setWeightHistory(w?.entries ?? []); },
    macros: async () => { const m = await macrosTrackingApi.getMacrosHistory(90); _macros.setMacrosEntries(m?.entries ?? []); },
    bodyfat: async () => { const b = await bodyFatApi.getBodyFatHistory(200); _bodyFat.setBodyFatHistory(b?.entries ?? []); },
    measurements: async () => { const me = await bodyMeasurementsApi.getMeasurementHistory(200); _measurements.setMeasurementHistory(me?.data ?? []); },
    hydration: async () => { const h = await hydrationApi.getHydrationHistory(200); _hydration.setHydrationEntries(h?.data ?? []); },
    soreness: async () => { const s = await sorenessApi.getSorenessHistory(200); _soreness.setSorenessEntries(s?.data ?? []); },
    menstrual: async () => { await _menstrual.loadMenstrualData(); },
    photos: async () => { const p = await bodyTrackingApi.getProgressPhotos(200); _photos.setProgressPhotos(p?.photos ?? []); },
  };
  const tabLoadersRef = useRef(tabLoaders);
  tabLoadersRef.current = tabLoaders;
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const [tabLoadError, setTabLoadError] = useState<string | null>(null);

  const loadTab = useCallback(async (tab: string, force = false) => {
    if (!force && loadedTabsRef.current.has(tab)) return;
    try {
      await tabLoadersRef.current[tab]?.();
      loadedTabsRef.current.add(tab);
      setTabLoadError(null);
    } catch (error) {
      logger.error(`Failed to load ${tab} tab data:`, error);
      setTabLoadError(tab);
    }
  }, []);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Stable identity (empty deps) — tab hooks depend on this in their own
  // effects, so a new function every render would re-trigger them forever.
  const loadActiveTab = useCallback((force = false) => loadTab(activeTabRef.current, force), [loadTab]);
  const forceReloadActiveTab = useCallback(() => loadActiveTab(true), [loadActiveTab]);

  loadDataRef.current = forceReloadActiveTab;
  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  // Used by modals/handlers that used to refresh every tab's data — they
  // only need the tab they just changed, which is always the active one.
  const loadAllData = useCallback(() => loadActiveTab(true), [loadActiveTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActiveTab(true);
    setRefreshing(false);
  }, [loadActiveTab]);

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleCalendarDatePress = useCallback(
    (date: Date, type: string) => {
      const dateStr = toDateString(date);
      const onDate = (iso: string | null | undefined) => isoToLocalDateStr(iso) === dateStr;
      let existingEntries: any[] = [];
      switch (type) {
        case "weight":
          existingEntries = weight.history.filter((e: any) => onDate(e?.recorded_at));
          break;
        case "macros":
          existingEntries = macros.entries.filter((e: any) => onDate(e?.date ?? e?.logged_at));
          break;
        case "bodyfat":
          existingEntries = bodyFat.history.filter((e: any) => onDate(e?.date));
          break;
        case "measurements":
          existingEntries = measurements.history.filter((e: any) => onDate(e?.measuredAt ?? e?.recorded_at));
          break;
        case "hydration":
          existingEntries = hydration.entries.filter((e: any) => onDate(e?.loggedAt ?? e?.recorded_at));
          break;
        case "soreness":
          existingEntries = soreness.entries.filter((e: any) => onDate(e?.loggedAt ?? e?.recorded_at ?? e?.date));
          break;
        case "menstrual":
          existingEntries = menstrual.entries.filter((e: any) => {
            const start = new Date(getCycleStartIso(e) ?? "");
            if (isNaN(start.getTime())) return false;
            const days = getCycleDuration(e, menstrual.prefs.periodLengthDays);
            for (let d = 0; d < days; d++) {
              const day = new Date(start);
              day.setDate(day.getDate() + d);
              if (onDate(day.toISOString())) return true;
            }
            return false;
          });
          break;
        default:
          existingEntries = [];
      }
      setSelectedLogDate(date);
      setDayModal({
        date,
        tab: type,
        existingEntries,
        isToday: dateStr === toDateString(new Date()),
      });
    },
    [weight.history, macros.entries, bodyFat.history, measurements.history, hydration.entries, soreness.entries, menstrual.entries, menstrual.prefs],
  );

  const openLogModalForTab = useCallback(
    (tab: string) => {
      switch (tab) {
        case "weight": weight.openWeightModal(); break;
        case "macros": macros.openMacrosModal(); break;
        case "bodyfat": bodyFat.openBodyFatModal(); break;
        case "measurements": measurements.openMeasurementModal(); break;
        case "hydration": hydration.openHydrationModal(); break;
        case "soreness": modalState.openSorenessModal(); break;
        case "menstrual": modalState.openCycleModal(); break;
        case "photos": break;
        default: weight.openWeightModal();
      }
    },
    [weight, macros, bodyFat, hydration, photos, modalState],
  );

  const handleAddWidget = useCallback(
    (widgetType: string) => {
      if (activeBoard.widgets.length < 6) {
        activeBoard.addWidget(widgetType);
      } else {
        setWidgetEditMode(true);
        setShowWidgetGallery(false);
      }
    },
    [activeBoard],
  );

  const handleDeleteEntry = async (
    id: any,
    deleteFn: (id: any) => Promise<any>,
    setter: React.Dispatch<React.SetStateAction<any[]>>,
  ) => {
    try {
      await deleteFn(id);
      setter((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : String(err),
        [{ text: "OK" }],
        "error",
      );
    }
  };

  const renderDayModalExistingEntries = () => {
    const existingEntries = dayModal?.existingEntries as any[] | null | undefined;
    if (!existingEntries || existingEntries.length === 0) return null;
    const { tab } = dayModal!;

    if (tab === "weight") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry, i: number) => {
            const wkg = Number(entry.weight_kg);
            const val = weight.weightUnit === "kg" ? `${wkg.toFixed(1)} kg` : `${(wkg * 2.20462).toFixed(1)} lbs`;
            const time = new Date(entry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <Text style={styles.existingEntryTime}>{time}</Text>
                <Text style={styles.existingEntryValue}>{val}</Text>
                <TouchableOpacity onPress={() => weight.deleteWeightEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                {entry.name ? <Text style={styles.existingEntryName}>{entry.name}</Text> : null}
                <Text style={styles.existingEntryTime}>{entry.time}</Text>
                <Text style={styles.existingEntryMacros}>
                  {[entry.calories != null ? `${parseFloat(entry.calories).toFixed(0)} kcal` : null, entry.protein != null ? `P:${parseFloat(entry.protein).toFixed(0)}g` : null, entry.carbs != null ? `C:${parseFloat(entry.carbs).toFixed(0)}g` : null, entry.fat != null ? `F:${parseFloat(entry.fat).toFixed(0)}g` : null].filter(Boolean).join("  ·  ")}
                </Text>
              </View>
              <TouchableOpacity onPress={() => macros.deleteMacroEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {existingEntries.map((photo: ProgressPhoto) => {
              const uri = photos.photoUriCache[photo.id];
              const isError = uri === "error";
              const isReady = uri && !isError;
              return (
                <TouchableOpacity key={photo.id} style={styles.photoThumbWrap} activeOpacity={isReady ? 0.8 : 1} onPress={() => isReady && setExpandedPhoto({ uri, photo })}>
                  {isReady ? (
                    <Image source={{ uri }} style={styles.photoThumb} contentFit='cover' />
                  ) : isError ? (
                    <View style={[styles.photoThumb, styles.photoThumbError]}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      <ActivityIndicator size='small' color='#667eea' />
                    </View>
                  )}
                  <TouchableOpacity style={styles.photoThumbDelete} onPress={() => photos.deletePhoto(photo)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
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
                <Text style={styles.existingEntryValue}>{Number(entry.percentage).toFixed(1)}%</Text>
                <Text style={styles.existingEntryTime}>
                  Waist {entry.measurements?.waist != null ? Number(entry.measurements.waist).toFixed(1) : "—"}cm · Neck {entry.measurements?.neck != null ? Number(entry.measurements.neck).toFixed(1) : "—"}cm
                  {entry.measurements?.hip != null && entry.measurements.hip !== 0 ? ` · Hip ${Number(entry.measurements.hip).toFixed(1)}cm` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => bodyFat.deleteBodyFatEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            const time = new Date(entry.measuredAt ?? entry.recorded_at ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.existingEntryTime}>{time}</Text>
                  <Text style={styles.existingEntryValue}>{entry.typeLabel ?? entry.type_label ?? "Measurement"}: {entry.value}{entry.unit ? ` ${entry.unit}` : ""}</Text>
                </View>
                <TouchableOpacity onPress={() => measurements.deleteMeasurementEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                <Text style={styles.existingEntryTime}>{entry.time ?? new Date(entry.createdAt).toLocaleTimeString()}</Text>
                <Text style={styles.existingEntryValue}>{(entry.amount ?? 0).toFixed(0)} ml</Text>
                <TouchableOpacity onPress={() => hydration.deleteHydrationEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                <Text style={styles.existingEntryValue}>{entry.muscleGroup ?? entry.muscle ?? entry.muscle_group ?? "—"}</Text>
                <Text style={styles.existingEntryTime}>Intensity: {entry.intensity ?? entry.value ?? 0}/10</Text>
              </View>
              <TouchableOpacity onPress={() => soreness.deleteSorenessEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    if (tab === "menstrual") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Period logged</Text>
          {existingEntries.map((entry: any, i: number) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                {entry.symptoms?.length ? (
                  <Text style={styles.existingEntryTime}>{entry.symptoms.join(", ")}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  const renderWidgetContent = (instance: WidgetInstance<string>): React.ReactNode => {
    const tab = instance.type.split("_")[0];

    if (tab === "weight") {
      return renderWeightWidget(instance.type, {
        history: weight.history,
        weightUnit: weight.weightUnit,
        entriesShown: weight.entriesShown,
        trendAverageDays: weight.trendAverageDays,
        setTrendAverageDays: weight.setTrendAverageDays,
        trend: weight.trend,
        chartData: weight.chartData,
        loadMoreEntries: weight.loadMoreEntries,
        deleteWeightEntry: weight.deleteWeightEntry,
        openWeightModal: () => weight.openWeightModal(),
        setSelectedLogDate,
        hasDataOnDate: weight.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "bodyfat" || instance.type === "bodyfat_height" || instance.type === "bodyfat_calendar" || instance.type === "bodyfat_latest") {
      return renderBodyFatWidget(instance.type, {
        history: bodyFat.history,
        height: bodyFat.height,
        heightUnit: bodyFat.heightUnit,
        setHeightUnit: bodyFat.setHeightUnit,
        openHeightModal: () => bodyFat.openHeightModal(),
        closeHeightModal: () => bodyFat.closeHeightModal(),
        setNewHeightCm: bodyFat.setNewHeightCm,
        setNewHeightFt: bodyFat.setNewHeightFt,
        setNewHeightIn: bodyFat.setNewHeightIn,
        openBodyFatModal: () => bodyFat.openBodyFatModal(),
        setSelectedLogDate,
        deleteBodyFatEntry: bodyFat.deleteBodyFatEntry,
        hasDataOnDate: bodyFat.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "hydration") {
      return renderHydrationWidget(instance.type, {
        entries: hydration.entries,
        goal: hydration.goal,
        setGoal: hydration.setGoal,
        openHydrationModal: () => hydration.openHydrationModal(),
        setSelectedLogDate,
        deleteHydrationEntry: hydration.deleteHydrationEntry,
        hasDataOnDate: hydration.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "measurement") {
      return renderMeasurementWidget(instance.type, {
        history: measurements.history,
        customEntries: measurements.customEntries,
        openMeasurementModal: () => measurements.openMeasurementModal(),
        setSelectedLogDate,
        deleteMeasurementEntry: measurements.deleteMeasurementEntry,
        hasDataOnDate: measurements.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "macros") {
      return renderMacrosWidget(instance.type, {
        entries: macros.entries,
        goals: macros.goals,
        openMacrosModal: () => macros.openMacrosModal(),
        openGoalModal: macros.openGoalModal,
        setSelectedLogDate,
        dailyStats: macros.dailyStats,
        hasDataOnDate: macros.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "soreness" || instance.type === "doms_followup" || instance.type === "doms_heatmap" || instance.type === "injury_tracker") {
      return renderSorenessWidget(instance.type, {
        entries: soreness.entries,
        openSorenessModal: () => soreness.openSorenessModal(),
        setSelectedLogDate,
        deleteSorenessEntry: soreness.deleteSorenessEntry,
        hasDataOnDate: soreness.hasDataOnDate,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "menstrual") {
      return renderMenstrualWidget(instance.type, {
        entries: menstrual.entries,
        prefs: menstrual.prefs,
        setPrefs: menstrual.setPrefs,
        actualDays: menstrual.actualDays,
        predictedDays: menstrual.predictedDays,
        setPredictedDays: menstrual.setPredictedDays,
        openCycleModal: () => menstrual.openCycleModal(),
        setSelectedLogDate,
        hasDataOnDate: menstrual.hasDataOnDate,
        isOnPeriod: menstrual.isOnPeriod,
        markPeriodOver: menstrual.markPeriodOver,
        colors,
        styles,
        handleCalendarDatePress,
      });
    }

    if (tab === "photos") {
      return renderPhotosWidget(instance.type, { styles });
    }

    return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]} {...panHandlers}>
      {isPulling && (
        <View pointerEvents="none" style={styles.pullHint}>
          <Text style={styles.pullHintText}>{pullDistance > 90 ? "Release to add a widget ✨" : "Pull to add a widget ↓"}</Text>
        </View>
      )}
      <ScrollView style={styles.container} scrollEnabled={!isPulling} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} tintColor="#667eea" />}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📊 Advanced Tracking</Text>
            <Text style={styles.subtitle}>Comprehensive body composition and nutrition tracking</Text>
          </View>

          <ScrollTabBar tabs={TRACKING_TABS} activeTab={activeTab} onTabChange={setActiveTab} storageKey="trackingScreen_tabConfig" />

          {tabLoadError === activeTab && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Couldn't load this tab's data</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => loadTab(activeTab, true)}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.widgetsSectionHeader}>
            <Text style={styles.widgetsSectionTitle}>{widgetEditMode ? "Editing Widgets" : " "}</Text>
            {widgetEditMode ? (
              <TouchableOpacity onPress={() => setWidgetEditMode(false)} hitSlop={8}>
                <Text style={styles.widgetsEditToggle}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addWidgetButton} onPress={() => setShowWidgetGallery(true)}>
                <Text style={styles.addWidgetButtonText}>+ Widget</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeBoard.isLoaded && activeBoard.widgets.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No widgets on this tab yet</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setShowWidgetGallery(true)}>
                <Text style={styles.primaryButtonText}>+ Add a Widget</Text>
              </TouchableOpacity>
            </View>
          )}

          <WidgetsPanel key={activeTab} widgets={activeBoard.widgets} isLoaded={activeBoard.isLoaded} editMode={widgetEditMode} onCycleSize={activeBoard.cycleWidgetSize} onRemove={activeBoard.removeWidget} onReorder={activeBoard.reorderWidgets} renderContent={renderWidgetContent} registry={activeRegistry as any} />
        </View>
      </ScrollView>

      <WidgetGallery visible={showWidgetGallery} onClose={() => setShowWidgetGallery(false)} availableWidgets={activeBoard.availableToAdd as any} onAddWidget={handleAddWidget} hasPlacedWidgets={activeBoard.widgets.length > 0} onEditWidgets={() => setWidgetEditMode(true)} />

      {/* Weight Modal */}
      <ModalSheet visible={weight.showWeightModal} onClose={() => { weight.closeWeightModal(); setSelectedLogDate(null); }} title="Log Weight" onConfirm={weight.addWeight}>
        <TextInput style={styles.input} placeholder={`Enter weight (${weight.weightUnit})`} keyboardType="decimal-pad" value={weight.newWeight} onChangeText={weight.setNewWeight} />
      </ModalSheet>

      {/* Height Modal */}
      <ModalSheet visible={bodyFat.showHeightModal} onClose={() => { bodyFat.closeHeightModal(); bodyFat.setNewHeightCm(""); bodyFat.setNewHeightFt(""); bodyFat.setNewHeightIn(""); }} title="Set Height" onConfirm={bodyFat.saveHeight} confirmText="Save" scrollable={false}>
        <Text style={styles.inputLabel}>Unit:</Text>
        <View style={styles.unitToggle}>
          {["cm", "ft"].map((u: string) => (
            <TouchableOpacity key={u} style={[styles.unitButton, bodyFat.heightUnit === u && styles.unitButtonActive]} onPress={() => { bodyFat.setHeightUnit(u); bodyFat.setNewHeightCm(""); bodyFat.setNewHeightFt(""); bodyFat.setNewHeightIn(""); }}>
              <Text style={[styles.unitButtonText, bodyFat.heightUnit === u && styles.unitButtonTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {bodyFat.heightUnit === "cm" ? (
          <>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput style={styles.input} placeholder="e.g. 175" keyboardType="decimal-pad" value={bodyFat.newHeightCm} onChangeText={bodyFat.setNewHeightCm} />
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Feet</Text>
            <TextInput style={styles.input} placeholder="e.g. 5" keyboardType="decimal-pad" value={bodyFat.newHeightFt} onChangeText={bodyFat.setNewHeightFt} />
            <Text style={styles.inputLabel}>Inches</Text>
            <TextInput style={styles.input} placeholder="e.g. 10" keyboardType="decimal-pad" value={bodyFat.newHeightIn} onChangeText={bodyFat.setNewHeightIn} />
          </>
        )}
      </ModalSheet>

      <LogCycleModal visible={modalState.state.cycleModalOpen} onClose={modalState.closeCycleModal} prefillDate={selectedLogDate ?? undefined} onSuccess={() => loadAllData()} />

      <LogHydrationModal visible={modalState.state.hydrationModalOpen} onClose={() => { modalState.closeHydrationModal(); setSelectedLogDate(null); }} onSuccess={() => loadAllData()} />

      <LogSorenessModal visible={modalState.state.sorenessModalOpen} onClose={() => { modalState.closeSorenessModal(); setSelectedLogDate(null); }} onSuccess={() => loadAllData()} />

      {/* Macros Modal */}
      <ModalSheet visible={macros.showMacrosModal} onClose={() => { macros.closeMacrosModal(); setSelectedLogDate(null); }} title="Log Macros" onConfirm={macros.addMacrosEntry} scrollable={true}>
        {macros.savedFoods.length > 0 && (
          <>
            <Text style={styles.inputLabel}>Quick Log</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {macros.savedFoods.map((food: any) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.optionButton}
                  onPress={() => macros.quickLogSavedFood(food)}
                  onLongPress={() => alert(
                    "Remove Saved Food",
                    `Remove "${food.name}" from quick log?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => macros.removeSavedFood(food.id) },
                    ],
                    "warning",
                  )}
                >
                  <Text style={styles.optionButtonText}>{food.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalHint}>Tap to log instantly · long-press to remove</Text>
          </>
        )}
        <Text style={styles.inputLabel}>Name <Text style={styles.inputLabelOptional}>(e.g. "Chicken & rice")</Text></Text>
        <TextInput style={styles.input} placeholder="What did you eat? (optional)" value={macros.newName} onChangeText={macros.setNewName} autoCapitalize="words" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={styles.inputLabel}>Remember this food for quick logging</Text>
          <Switch value={macros.rememberEntry} onValueChange={macros.setRememberEntry} />
        </View>
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>Fill in what you know — all fields below are optional</Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Calories (kcal)</Text>
        <TextInput style={styles.input} placeholder="e.g. 420" keyboardType="decimal-pad" value={macros.newCalories} onChangeText={macros.setNewCalories} />
        <Text style={styles.inputLabel}>Protein (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 32" keyboardType="decimal-pad" value={macros.newProtein} onChangeText={macros.setNewProtein} />
        {parseFloat(macros.newCalories) > 0 && parseFloat(macros.newProtein) > 0 && (
          <Text style={styles.modalHint}>{((parseFloat(macros.newProtein) / parseFloat(macros.newCalories)) * 100).toFixed(1)}g protein / 100 kcal</Text>
        )}
        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 45" keyboardType="decimal-pad" value={macros.newCarbs} onChangeText={macros.setNewCarbs} />
        <Text style={styles.inputLabel}>Fat (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 12" keyboardType="decimal-pad" value={macros.newFat} onChangeText={macros.setNewFat} />
        <Text style={styles.inputLabel}>Time</Text>
        <TextInput style={styles.input} placeholder="HH:MM" value={macros.newTime} onChangeText={macros.setNewTime} />
        <Text style={styles.inputLabel}>Measurement Error (±%)</Text>
        <TextInput style={styles.input} placeholder="e.g. 5  →  ±5%" keyboardType="decimal-pad" value={macros.newError} onChangeText={macros.setNewError} />
        <Text style={styles.modalHint}>Error margin is used to calculate a min/max range for your totals</Text>
      </ModalSheet>

      {/* Macros Goals Modal */}
      <ModalSheet visible={macros.showMacrosGoalModal} onClose={() => macros.closeGoalModal()} title="Set Daily Macros Goals" onConfirm={macros.updateMacrosGoals} scrollable={true}>
        <Text style={styles.inputLabel}>Protein goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 150" keyboardType="decimal-pad" value={macros.goalsInput.protein} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, protein: v }))} />
        <Text style={styles.inputLabel}>Carbohydrates goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 250" keyboardType="decimal-pad" value={macros.goalsInput.carbs} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, carbs: v }))} />
        <Text style={styles.inputLabel}>Fat goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 65" keyboardType="decimal-pad" value={macros.goalsInput.fat} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, fat: v }))} />
        <Text style={styles.inputLabel}>Calories goal (kcal)</Text>
        <TextInput style={styles.input} placeholder="e.g., 2000" keyboardType="decimal-pad" value={macros.goalsInput.calories} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, calories: v }))} />
      </ModalSheet>

      {/* Body Fat Modal */}
      <ModalSheet visible={bodyFat.showBodyFatModal} onClose={() => { bodyFat.closeBodyFatModal(); setSelectedLogDate(null); }} title="Calculate Body Fat %" subtitle="US Navy Method" onConfirm={bodyFat.calculateBodyFat} confirmText="Calculate" scrollable={true}>
        <View style={styles.genderToggle}>
          {["male", "female"].map((g: string) => (
            <TouchableOpacity key={g} style={[styles.genderButton, bodyFat.gender === g && styles.genderButtonActive]} onPress={() => { bodyFat.setGender(g); setStorageItem(getUserKey("gender"), g); }}>
              <Text style={[styles.genderButtonText, bodyFat.gender === g && styles.genderButtonTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.unitToggleContainer}>
          <Text style={styles.inputLabel}>Unit:</Text>
          <View style={styles.unitToggle}>
            {["cm", "in"].map((u: string) => (
              <TouchableOpacity key={u} style={[styles.unitButton, bodyFat.measurementUnit === u && styles.unitButtonActive]} onPress={() => bodyFat.setMeasurementUnit(u)}>
                <Text style={styles.unitButtonText}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={styles.inputLabel}>Waist ({bodyFat.measurementUnit})</Text>
        <TextInput style={styles.input} placeholder="Measure at navel" keyboardType="decimal-pad" value={bodyFat.waist} onChangeText={bodyFat.setWaist} />
        <Text style={styles.inputLabel}>Neck ({bodyFat.measurementUnit})</Text>
        <TextInput style={styles.input} placeholder="Measure below larynx" keyboardType="decimal-pad" value={bodyFat.neck} onChangeText={bodyFat.setNeck} />
        {bodyFat.gender === "female" && (
          <>
            <Text style={styles.inputLabel}>Hip ({bodyFat.measurementUnit})</Text>
            <TextInput style={styles.input} placeholder="Measure at widest point" keyboardType="decimal-pad" value={bodyFat.hip} onChangeText={bodyFat.setHip} />
          </>
        )}
      </ModalSheet>

      {/* Measurement Modal */}
      <ModalSheet visible={measurements.showMeasurementModal} onClose={() => { measurements.closeMeasurementModal(); setSelectedLogDate(null); }} title="Log Measurements" onConfirm={measurements.handleLogMeasurement}>
        <Text style={styles.inputLabel}>Waist (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 80" keyboardType="decimal-pad" value={measurements.newWaist} onChangeText={measurements.setNewWaist} />
        <Text style={styles.inputLabel}>Left Arm (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 30" keyboardType="decimal-pad" value={measurements.newArmLeft} onChangeText={measurements.setNewArmLeft} />
        <Text style={styles.inputLabel}>Right Arm (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 30" keyboardType="decimal-pad" value={measurements.newArmRight} onChangeText={measurements.setNewArmRight} />
        <Text style={styles.inputLabel}>Chest (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 100" keyboardType="decimal-pad" value={measurements.newChest} onChangeText={measurements.setNewChest} />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>Custom Body Part</Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Body Part Name</Text>
        <TextInput style={styles.input} placeholder="e.g., Calves" value={measurements.newCustomBodyPart} onChangeText={measurements.setNewCustomBodyPart} autoCapitalize="words" />
        <Text style={styles.inputLabel}>Value (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 38" keyboardType="decimal-pad" value={measurements.newCustomBodyPartValue} onChangeText={measurements.setNewCustomBodyPartValue} />
      </ModalSheet>

      {/* Per-day Flow Modal (menstrual) */}
      <ModalSheet visible={showFlowModal} onClose={() => { setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null); }} title="Set Flow Intensity" onConfirm={async () => {
        if (!flowModalDate) return;
        try {
          await menstrualApi.setDayFlow(flowModalDate, flowModalIntensity);
          setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null);
          await loadAllData();
          alert("Saved", "Flow intensity saved", [{ text: "OK" }], "success");
        } catch (err) { alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error"); }
      }}>
        <Text style={styles.inputLabel}>Date</Text>
        <Text style={{ marginBottom: 12 }}>{flowModalDate}</Text>
        <Text style={styles.inputLabel}>Intensity</Text>
        <View style={{ flexDirection: "row", marginTop: 8 }}>
          {(["light", "moderate", "heavy"] as const).map((opt) => (
            <TouchableOpacity key={opt} style={[styles.optionButton, flowModalIntensity === opt && styles.optionButtonActive, { marginRight: 8 }]} onPress={() => setFlowModalIntensity(opt)}>
              <Text style={flowModalIntensity === opt ? styles.optionButtonTextActive : styles.optionButtonText}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {flowModalCycleEntry && (
          <TouchableOpacity style={styles.dangerButton} onPress={() => {
            alert("Delete Period?", "This removes the entire logged period that started on this date, not just this day.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => {
                try {
                  await menstrualApi.deleteMenstrualEntry(flowModalCycleEntry.id);
                  setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null);
                  await loadAllData();
                  alert("Deleted", "Period deleted", [{ text: "OK" }], "success");
                } catch (err) { alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error"); }
              }},
            ], "warning");
          }}>
            <Text style={styles.dangerButtonText}>🗑 Delete This Period</Text>
          </TouchableOpacity>
        )}
      </ModalSheet>

      {/* UNIFIED DAY MODAL */}
      <ModalSheet visible={!!dayModal} onClose={() => { setDayModal(null); setSelectedLogDate(null); }} showCancelButton={false} showConfirmButton={false} scrollable={true}>
        <View style={styles.dayModalHeader}>
          <View style={styles.dayModalIconCircle}>
            <Text style={styles.dayModalIcon}>
              {dayModal?.tab === "weight" ? "⚖️" : dayModal?.tab === "macros" ? "🥗" : dayModal?.tab === "photos" ? "📸" : dayModal?.tab === "bodyfat" ? "📐" : dayModal?.tab === "measurements" ? "📏" : dayModal?.tab === "hydration" ? "💧" : dayModal?.tab === "soreness" ? "💪" : dayModal?.tab === "menstrual" ? "🌸" : "📐"}
            </Text>
          </View>
          <View style={styles.dayModalHeaderText}>
            <Text style={styles.dayModalTitle}>
              {dayModal?.tab === "weight" ? "Weight" : dayModal?.tab === "macros" ? "Macros" : dayModal?.tab === "photos" ? "Photos" : dayModal?.tab === "bodyfat" ? "Body Fat" : dayModal?.tab === "measurements" ? "Measurements" : dayModal?.tab === "hydration" ? "Hydration" : dayModal?.tab === "soreness" ? "Soreness" : dayModal?.tab === "menstrual" ? "Cycle" : "Entry"}
            </Text>
            <Text style={styles.dayModalSubtitle}>{dayModal?.isToday ? "Today" : dayModal?.date?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
          </View>
        </View>
        <View style={styles.dayModalDivider} />
        {renderDayModalExistingEntries()}
        {(!dayModal?.existingEntries || dayModal.existingEntries.length === 0) && (
          <View style={styles.dayModalEmptyState}>
            <Text style={styles.dayModalEmptyIcon}>
              {dayModal?.tab === "weight" ? "⚖️" : dayModal?.tab === "macros" ? "🥗" : dayModal?.tab === "photos" ? "📸" : dayModal?.tab === "bodyfat" ? "📐" : dayModal?.tab === "measurements" ? "📏" : dayModal?.tab === "hydration" ? "💧" : dayModal?.tab === "soreness" ? "💪" : dayModal?.tab === "menstrual" ? "🌸" : "📐"}
            </Text>
            <Text style={styles.dayModalEmptyText}>No entries for this day</Text>
          </View>
        )}
        <TouchableOpacity style={styles.logEntryBtn} onPress={() => openLogModalForTab(dayModal?.tab ?? activeTab)}>
          <Text style={styles.logEntryBtnText}>
            {dayModal?.tab === "weight" ? "⚖️ Log Weight" : dayModal?.tab === "macros" ? "🥗 Log Macros" : dayModal?.tab === "photos" ? "📸 Add Photo" : dayModal?.tab === "bodyfat" ? "📐 Calculate Body Fat" : dayModal?.tab === "measurements" ? "📏 Log Measurements" : dayModal?.tab === "hydration" ? "💧 Log Water" : dayModal?.tab === "soreness" ? "💪 Log Soreness" : dayModal?.tab === "menstrual" ? "🌸 Log Cycle" : "Add Entry"}
          </Text>
        </TouchableOpacity>
      </ModalSheet>
    </SafeAreaView>
  );
}
