import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useWorkout } from "@shared/context/WorkoutContext";
import { useJointSessionContext } from "@shared/context/JointSessionContext";
import { useAuth } from "@shared/context/AuthContext";
import { useTabBar } from "@shared/context/TabBarContext";
import { useTheme } from "@shared/context/ThemeContext";
import type { ThemeColors } from "@shared/context/ThemeContext";
import ModalSheet from "@shared/components/ModalSheet";
import { useAlert } from "@shared/components/CustomAlert";
import {
  getAllExerciseNames,
  getAllMuscleGroups,
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
  normalizeExerciseName,
  getExercisesByMuscleGroup,
} from "@utils/exerciseMatching";
import { formatTime as formatDuration } from "@utils/timeEstimation";
import {
  loadFromStorage,
  saveToStorage,
  STORAGE_KEYS,
} from "@shared/services/storage";
import { formatDate as formatDateUtil } from "@utils/format";
import { useWidgets } from "@shared/context/hooks/useWidgets";
import { useTwoFingerPull } from "@shared/context/hooks/useTwoFingerPull";
import WidgetGallery from "@shared/components/widgets/WidgetGallery";
import WidgetsPanel from "@shared/components/widgets/WidgetsPanel";
import {
  WORKOUT_WIDGET_REGISTRY,
  DEFAULT_WORKOUT_WIDGETS,
  WORKOUT_WIDGETS_STORAGE_KEY,
  type WorkoutWidgetType,
} from "./widgets";
import type { WidgetInstance, Exercise } from "@shared/types";
import type { SetDetail, SimilarityMatch } from "./types";
import { toSuggestions } from "@utils/exerciseDb";
import type { ExerciseSuggestion } from "@utils/exerciseDb";

interface CurrentDayWorkout {
  dayNumber: number;
  dayTitle?: string;
  muscleGroups?: string[];
  exercises: Exercise[];
  totalSets: number;
}
import {
  WIDGET_GROUP_RADIUS,
  LBS_TO_KG,
  KG_TO_LBS,
  kgToDisplay,
  displayToKg,
  getEmptyStateInfo,
  getDayOverviewTint,
  computeProgressPercentage,
  getPullHintText,
  getAddingSetsSubtitle,
  checkIsSelectedSetAssisted,
  getLocalHistoryEntries,
  getServerHistoryEntries,
  pickBestPerformanceSummary,
} from "./utils";
import { PartnerBanner } from "./components/PartnerBanner";
import { ExerciseCard } from "./components/ExerciseCard";
import { SessionStatsWidget } from "./components/SessionStatsTicker";
import {
  buildTrainingSetEntries,
  getUndertrainedMuscleGroups,
} from "../analytics/utils/trainingSummary";

export default function WorkoutScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { isTabBarCollapsed } = useTabBar();
  const {
    workoutData,
    selectedSplit,
    currentDay,
    completedDays,
    saveSetDetails: saveSetDetailsCtx,
    deleteSetDetails,
    isSetComplete,
    getSetDetails,
    getExerciseCompletedSets,
    isDayComplete,
    isDayLocked,
    getEstimatedTimeRemaining,
    getEstimatedEndTime,
    workoutStartTime,
    currentSessionId: _currentSessionId,
    endWorkout,
    updateExerciseName,
    addExtraSetsToExercise,
    addNewExercise,
    lastActivityTime,
    weightUnit,
    saveWeightUnit,
    fetchSessionHistory,
    hasActiveSession,
  } = useWorkout();

  const {
    isInJointSession,
    jointSession,
    partnerProgress,
    partnerExerciseList: _partnerExerciseList,
    isPartnerReady,
    syncPulse,
    pushJointProgress,
    leaveJointSession,
    partnerCompletedSets,
  } = useJointSessionContext();

  const { alert, AlertComponent } = useAlert();

  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const partnerUsername =
    jointSession?.participants?.find((p) => p.userId !== user?.id)?.username ??
    "Partner";

  const bottomAnim = useRef(new Animated.Value(74)).current;
  const leftAnim = useRef(new Animated.Value(0)).current;
  const borderRadiusAnim = useRef(new Animated.Value(0)).current;
  const paddingBottomAnim = useRef(new Animated.Value(15)).current;

  const [showSetModal, setShowSetModal] = useState<boolean>(false);
  const [selectedSet, setSelectedSet] = useState<{
    exerciseIndex: number;
    setIndex: number;
  } | null>(null);
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [performanceHistory, setPerformanceHistory] = useState<
    ReturnType<typeof pickBestPerformanceSummary>
  >(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [setNote, setSetNote] = useState<string>("");
  const [isWarmupSet, setIsWarmupSet] = useState<boolean>(false);
  const [showEditNameModal, setShowEditNameModal] = useState<boolean>(false);
  const [editingExercise, setEditingExercise] = useState<{
    index: number;
    exercise: { name: string; muscleGroup?: string; sets: number };
  } | null>(null);
  const [newExerciseName, setNewExerciseName] = useState<string>("");
  const [newMuscleGroup, setNewMuscleGroup] = useState<string>("");
  const [nameSuggestions, setNameSuggestions] = useState<SimilarityMatch[]>([]);
  const [muscleGroupSuggestions, setMuscleGroupSuggestions] = useState<
    SimilarityMatch[]
  >([]);
  const [showAddSetsModal, setShowAddSetsModal] = useState<boolean>(false);
  const [addingSetsExercise, setAddingSetsExercise] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [additionalSets, setAdditionalSets] = useState<string>("");
  const [showAddExerciseModal, setShowAddExerciseModal] =
    useState<boolean>(false);
  const [newExercise, setNewExercise] = useState<{
    name: string;
    exerciseId?: string;
    muscleGroup: string;
    sets: string;
  }>({
    name: "",
    muscleGroup: "",
    sets: "",
  });
  const [newExerciseSuggestions, setNewExerciseSuggestions] = useState<
    ExerciseSuggestion[]
  >([]);
  const [
    newExerciseMuscleGroupSuggestions,
    setNewExerciseMuscleGroupSuggestions,
  ] = useState<SimilarityMatch[]>([]);
  const [restReminderEnabled, setRestReminderEnabled] =
    useState<boolean>(false);
  const [restReminderSeconds, setRestReminderSeconds] = useState<number>(0);
  const [showRestReminderModal, setShowRestReminderModal] =
    useState<boolean>(false);
  const [tempRestReminderSeconds, setTempRestReminderSeconds] =
    useState<string>("");
  const [undertrainedDisplayMode, setUndertrainedDisplayMode] = useState<
    "banner" | "per_exercise" | "both" | "off"
  >("per_exercise");
  const [undertrainedCalculationMode, setUndertrainedCalculationMode] =
    useState<"days_done" | "full_split">("days_done");
  const [dismissedUndertrainedBanner, setDismissedUndertrainedBanner] =
    useState<boolean>(false);

  const [showWidgetGallery, setShowWidgetGallery] = useState<boolean>(false);
  const [widgetEditMode, setWidgetEditMode] = useState<boolean>(false);

  const {
    widgets,
    isLoaded: widgetsLoaded,
    availableToAdd,
    addWidget,
    removeWidget,
    cycleWidgetSize,
    reorderWidgets,
  } = useWidgets<WorkoutWidgetType>(user?.id ?? null, {
    registry: WORKOUT_WIDGET_REGISTRY,
    defaults: DEFAULT_WORKOUT_WIDGETS,
    storageKey: WORKOUT_WIDGETS_STORAGE_KEY,
  });

  // Two-finger pull brings up the "deploy" panel for adding widgets. To
  // rearrange, resize, or remove widgets already on the screen, open that
  // same panel and tap "Edit Widgets" — it closes the panel and switches
  // this screen into edit mode.
  const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
    setShowWidgetGallery(true);
  });

  const handleEditWidgets = () => {
    setShowWidgetGallery(false);
    setWidgetEditMode(true);
  };

  const handleAddWidget = async (type: WorkoutWidgetType) => {
    const result = await addWidget(type);
    if (!result.success && result.error) {
      alert("Can't Add Widget", result.error, [{ text: "OK" }], "error");
      return;
    }
    setShowWidgetGallery(false);
  };

  const allExerciseNames = getAllExerciseNames(workoutData, selectedSplit);
  const allMuscleGroups = getAllMuscleGroups(workoutData, selectedSplit);
  const swapSuggestions = useMemo(
    () =>
      editingExercise
        ? getExercisesByMuscleGroup(
            workoutData,
            selectedSplit,
            newMuscleGroup,
            editingExercise.exercise.name,
          )
        : [],
    [workoutData, selectedSplit, newMuscleGroup, editingExercise],
  );

  useEffect(() => {
    (async () => {
      const displayMode = await loadFromStorage<string>(
        STORAGE_KEYS.UNDERTRAINED_DISPLAY_MODE,
        user?.id ?? null,
        false,
      );
      if (displayMode) {
        setUndertrainedDisplayMode(
          displayMode as "banner" | "per_exercise" | "both" | "off",
        );
      }
      const calcMode = await loadFromStorage<string>(
        STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE,
        user?.id ?? null,
        false,
      );
      if (calcMode) {
        setUndertrainedCalculationMode(calcMode as "days_done" | "full_split");
      }
    })();
  }, [user?.id]);

  const undertrainedEntries = useMemo(
    () => buildTrainingSetEntries([], workoutData, selectedSplit, completedDays),
    [workoutData, selectedSplit, completedDays],
  );

  const topUndertrainedGroup = useMemo(() => {
    if (undertrainedDisplayMode === "off" || !hasActiveSession()) return null;
    const groups = getUndertrainedMuscleGroups(
      undertrainedEntries,
      workoutData,
      selectedSplit,
      new Date(),
      undertrainedCalculationMode,
    );
    return groups[0] ?? null;
  }, [
    undertrainedDisplayMode,
    hasActiveSession,
    undertrainedEntries,
    workoutData,
    selectedSplit,
    undertrainedCalculationMode,
  ]);

  const undertrainedCandidates = useMemo(
    () =>
      topUndertrainedGroup
        ? getExercisesByMuscleGroup(
            workoutData,
            selectedSplit,
            topUndertrainedGroup.muscleGroup,
          )
        : [],
    [topUndertrainedGroup, workoutData, selectedSplit],
  );

  const showUndertrainedBanner =
    (undertrainedDisplayMode === "banner" || undertrainedDisplayMode === "both") &&
    !dismissedUndertrainedBanner &&
    !!topUndertrainedGroup &&
    undertrainedCandidates.length > 0;

  const showUndertrainedPerExercise =
    undertrainedDisplayMode === "per_exercise" || undertrainedDisplayMode === "both";

  const isCurrentDayLocked = isDayLocked(currentDay);
  const areAllSetsComplete = isDayComplete(currentDay);

  const getCurrentDayWorkout = (): CurrentDayWorkout | null => {
    if (!workoutData?.days || !selectedSplit) return null;
    const day = workoutData.days.find((d) => d.dayNumber === currentDay);
    if (!day || !day.split[selectedSplit]) return null;
    return {
      dayNumber: day.dayNumber,
      dayTitle: day.dayTitle,
      muscleGroups: day.muscleGroups,
      exercises: day.split[selectedSplit].exercises || [],
      totalSets: day.split[selectedSplit].totalSets || 0,
    };
  };
  const dayWorkout = getCurrentDayWorkout();

  const todayExerciseNames = new Set(
    (dayWorkout?.exercises ?? []).map((exercise) =>
      normalizeExerciseName(exercise.name),
    ),
  );
  const undertrainedSuggestionCandidates = undertrainedCandidates.filter(
    (name) => !todayExerciseNames.has(normalizeExerciseName(name)),
  );

  // Load stored rest reminder for this user once when a session starts.
  // The per-second ticking itself lives in SessionStatsWidget so it doesn't
  // re-render this whole screen every second.
  useEffect(() => {
    if (!workoutStartTime || isCurrentDayLocked) return;
    (async () => {
      try {
        const stored = await loadFromStorage<number | null>(
          STORAGE_KEYS.REST_REMINDER_SECONDS,
          user?.id ?? null,
        );
        const secs = Number(stored ?? 0) || 0;
        setRestReminderSeconds(secs);
        setRestReminderEnabled(secs > 0);
      } catch (err) {
        console.warn("Failed to load rest reminder setting:", err);
      }
    })();
  }, [workoutStartTime, isCurrentDayLocked, user?.id]);

  useEffect(() => {
    if (showSetModal && selectedSet) loadPerformanceHistory();
  }, [showSetModal, selectedSet]);

  useEffect(() => {
    if (showEditNameModal && newExerciseName.trim()) {
      const t = checkForTypo(newExerciseName, allExerciseNames);
      setNameSuggestions(t.suggestions.length > 0 ? t.suggestions : []);
    } else setNameSuggestions([]);
  }, [newExerciseName, showEditNameModal]);

  useEffect(() => {
    if (showEditNameModal && newMuscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(newMuscleGroup, allMuscleGroups);
      setMuscleGroupSuggestions(t.suggestions.length > 0 ? t.suggestions : []);
    } else setMuscleGroupSuggestions([]);
  }, [newMuscleGroup, showEditNameModal]);

  useEffect(() => {
    if (showAddExerciseModal && newExercise.name.trim().length > 1) {
      setNewExerciseSuggestions(toSuggestions(newExercise.name, 5));
    } else setNewExerciseSuggestions([]);
  }, [newExercise.name, showAddExerciseModal]);

  useEffect(() => {
    if (showAddExerciseModal && newExercise.muscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(
        newExercise.muscleGroup,
        allMuscleGroups,
      );
      setNewExerciseMuscleGroupSuggestions(
        t.suggestions.length > 0 ? t.suggestions : [],
      );
    } else setNewExerciseMuscleGroupSuggestions([]);
  }, [newExercise.muscleGroup, showAddExerciseModal]);

  useEffect(() => {
    if (isDayLocked(currentDay) && workoutStartTime && lastActivityTime) {
      const since = Date.now() - new Date(lastActivityTime).getTime();
      if (since >= 30 * 60 * 1000)
        alert(
          "Session Auto-Completed",
          "Your workout session was automatically completed due to 30 minutes of inactivity.",
          [{ text: "OK" }],
          "info",
        );
    }
  }, []);

  useEffect(() => {
    Animated.spring(bottomAnim, {
      toValue: isTabBarCollapsed ? -10 : 74,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
    Animated.spring(leftAnim, {
      toValue: isTabBarCollapsed ? 66 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
    Animated.spring(borderRadiusAnim, {
      toValue: isTabBarCollapsed ? 16 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
    Animated.spring(paddingBottomAnim, {
      toValue: isTabBarCollapsed ? 25 : 15,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, [isTabBarCollapsed]);

  const loadPerformanceHistory = useCallback(async () => {
    if (!selectedSet || !dayWorkout) return;
    setLoadingHistory(true);
    try {
      const exercises = dayWorkout.exercises;
      const exercise = exercises[selectedSet.exerciseIndex];
      const canonicalName = getCanonicalName(exercise.name, allExerciseNames);

      // First look through local completedDays (fast / already available)
      let history = getLocalHistoryEntries(
        completedDays,
        workoutData,
        selectedSplit,
        canonicalName,
        allExerciseNames,
      );

      // If no local history, fall back to server session history (set_timings)
      if (history.length === 0 && typeof fetchSessionHistory === "function") {
        history = await getServerHistoryEntries(
          fetchSessionHistory,
          exercise.name,
          canonicalName,
          allExerciseNames,
        );
      }

      if (!history.length) {
        if (isMountedRef.current) setPerformanceHistory(null);
        return;
      }

      const summary = pickBestPerformanceSummary(history);
      if (isMountedRef.current) setPerformanceHistory(summary);
    } catch (e) {
      console.error("Error loading performance history:", e);
      if (isMountedRef.current) setPerformanceHistory(null);
    } finally {
      if (isMountedRef.current) setLoadingHistory(false);
    }
  }, [
    selectedSet,
    dayWorkout,
    completedDays,
    workoutData,
    selectedSplit,
    allExerciseNames,
    fetchSessionHistory,
  ]);

  const openSetModalForNewEntry = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      setSelectedSet({ exerciseIndex, setIndex });
      setWeight("");
      setReps("");
      setSetNote("");
      setIsWarmupSet(false);
      setShowSetModal(true);
    },
    [],
  );

  const showCompletedSetAlert = useCallback((
    exerciseIndex: number,
    setIndex: number,
    existing: SetDetail,
  ) => {
    const displayWeight = existing.weight
      ? kgToDisplay(existing.weight, weightUnit)
      : "0";
    let msg = `Weight: ${displayWeight} ${weightUnit}\nReps: ${existing.reps || 0}`;
    if (existing.isWarmup) msg = `🔥 WARM-UP SET\n${msg}`;
    if (existing.note) msg += `\n\nNote: ${existing.note}`;
    alert(
      "Set Completed",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => {
            setSelectedSet({ exerciseIndex, setIndex });
            setWeight(
              existing.weight ? kgToDisplay(existing.weight, weightUnit) : "",
            );
            setReps(existing.reps?.toString() || "");
            setSetNote(existing.note || "");
            setIsWarmupSet(existing.isWarmup || false);
            setShowSetModal(true);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSetDetails(currentDay, exerciseIndex, setIndex),
        },
      ],
      "info",
    );
  }, [weightUnit, alert, currentDay, deleteSetDetails]);

  const handleSetPress = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "This day has been completed and locked.",
          [{ text: "OK" }],
          "lock",
        );
        return;
      }
      const existing = getSetDetails(
        currentDay,
        exerciseIndex,
        setIndex,
      ) as SetDetail | null;
      if (existing) {
        showCompletedSetAlert(exerciseIndex, setIndex, existing);
      } else {
        openSetModalForNewEntry(exerciseIndex, setIndex);
      }
    },
    [
      isCurrentDayLocked,
      alert,
      getSetDetails,
      currentDay,
      showCompletedSetAlert,
      openSetModalForNewEntry,
    ],
  );

  const isSavingSetRef = useRef(false);
  const saveSetDetailsImpl = useCallback(async () => {
    if (!selectedSet) return;

    const weightInKg = displayToKg(weight, weightUnit);
    const r = Number.parseInt(reps, 10) || 0;

    if (weightInKg === 0 || r === 0) {
      alert(
        "Invalid Set",
        "Please enter a weight and reps greater than 0.",
        [{ text: "OK" }],
        "error",
      );
      return;
    }

    // Always save in kg — server only receives kg
    await saveSetDetailsCtx(
      currentDay,
      selectedSet.exerciseIndex,
      selectedSet.setIndex,
      weightInKg,
      r,
      setNote.trim(),
      isWarmupSet,
    );

    if (isInJointSession) {
      const exercises = dayWorkout?.exercises ?? [];
      const exercise = exercises[selectedSet.exerciseIndex];
      await pushJointProgress({
        exerciseIndex: selectedSet.exerciseIndex,
        setIndex: selectedSet.setIndex,
        exerciseName: exercise.name,
        readyForNext: false,
      });
    }

    if (isMountedRef.current) {
      setShowSetModal(false);
      setSelectedSet(null);
      setWeight("");
      setReps("");
      setSetNote("");
      setIsWarmupSet(false);
      setPerformanceHistory(null);
    }
  }, [
    selectedSet,
    weight,
    reps,
    setNote,
    isWarmupSet,
    currentDay,
    saveSetDetailsCtx,
    isInJointSession,
    dayWorkout,
    pushJointProgress,
    alert,
    weightUnit,
  ]);

  const handleSaveSetDetails = useCallback(async () => {
    if (isSavingSetRef.current) return;
    isSavingSetRef.current = true;
    try {
      await saveSetDetailsImpl();
    } finally {
      isSavingSetRef.current = false;
    }
  }, [saveSetDetailsImpl]);

  const handleOpenRestReminderModal = () => {
    setTempRestReminderSeconds(String(restReminderSeconds || 60));
    setShowRestReminderModal(true);
  };

  const handleSaveRestReminder = async (overrideSeconds?: number) => {
    const raw =
      overrideSeconds !== undefined
        ? overrideSeconds
        : Number.parseInt(tempRestReminderSeconds || "0", 10) || 0;
    const secs = Math.max(0, Number(raw));
    setRestReminderSeconds(secs);
    setRestReminderEnabled(secs > 0);
    try {
      await saveToStorage(
        STORAGE_KEYS.REST_REMINDER_SECONDS,
        secs,
        user?.id ?? null,
      );
    } catch (err) {
      console.warn("Failed to save rest reminder setting:", err);
    }
    setShowRestReminderModal(false);
    alert(
      "Saved",
      secs > 0
        ? `Rest reminder set to ${formatTime(secs)}`
        : "Rest reminder turned off",
      [{ text: "OK" }],
      "success",
    );
  };

  const handleEditExerciseName = useCallback(
    (exerciseIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "Cannot edit exercises on a locked day.",
          [{ text: "OK" }],
          "lock",
        );
        return;
      }
      const exercises = dayWorkout?.exercises ?? [];
      const exercise = exercises[exerciseIndex];
      setEditingExercise({ index: exerciseIndex, exercise });
      setNewExerciseName(exercise.name);
      setNewMuscleGroup(exercise.muscleGroup || "");
      setShowEditNameModal(true);
    },
    [isCurrentDayLocked, dayWorkout, alert],
  );

  const closeEditModal = () => {
    setShowEditNameModal(false);
    setEditingExercise(null);
    setNewExerciseName("");
    setNewMuscleGroup("");
    setNameSuggestions([]);
    setMuscleGroupSuggestions([]);
  };

  const applyExerciseNameEdit = (finalName: string, trimmedMG: string) => {
    updateExerciseName(
      currentDay,
      selectedSplit!,
      editingExercise!.index,
      finalName,
      trimmedMG,
    );
    closeEditModal();
  };

  const handleSaveExerciseName = () => {
    if (!editingExercise || !newExerciseName.trim()) {
      alert(
        "Error",
        "Exercise name cannot be empty",
        [{ text: "OK" }],
        "error",
      );
      return;
    }
    const trimmed = newExerciseName.trim();
    const trimmedMG = newMuscleGroup.trim();
    const tc = checkForTypo(trimmed, allExerciseNames);

    if (tc.exactMatch) {
      applyExerciseNameEdit(tc.exactMatch, trimmedMG);
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      );
      return;
    }

    if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0];
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}". Use that instead?`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => applyExerciseNameEdit(trimmed, trimmedMG),
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => applyExerciseNameEdit(top.name, trimmedMG),
          },
        ],
        "warning",
      );
      return;
    }

    applyExerciseNameEdit(trimmed, trimmedMG);
  };

  const handleQuickAddSet = useCallback(
    (exerciseIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "Cannot add sets to a locked day.",
          [{ text: "OK" }],
          "lock",
        );
        return;
      }
      addExtraSetsToExercise(currentDay, selectedSplit!, exerciseIndex, 1);
    },
    [isCurrentDayLocked, alert, addExtraSetsToExercise, currentDay, selectedSplit],
  );

  const handleAddMultipleSets = useCallback(
    (exerciseIndex: number) => {
      if (isCurrentDayLocked) {
        alert(
          "Day Locked",
          "Cannot add sets to a locked day.",
          [{ text: "OK" }],
          "lock",
        );
        return;
      }
      const exercises = dayWorkout?.exercises ?? [];
      setAddingSetsExercise({
        index: exerciseIndex,
        exercise: exercises[exerciseIndex],
      });
      setAdditionalSets("");
      setShowAddSetsModal(true);
    },
    [isCurrentDayLocked, dayWorkout, alert],
  );

  const handleSaveAdditionalSets = () => {
    if (!addingSetsExercise) return;
    const sets = Number.parseInt(additionalSets, 10);
    if (Number.isNaN(sets) || sets < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      );
      return;
    }
    addExtraSetsToExercise(
      currentDay,
      selectedSplit!,
      addingSetsExercise.index as number,
      sets,
    );
    setShowAddSetsModal(false);
    setAddingSetsExercise(null);
    setAdditionalSets("");
  };

  const handleAddNewExercise = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add exercises to a locked day.",
        [{ text: "OK" }],
        "lock",
      );
      return;
    }
    setNewExercise({ name: "", muscleGroup: "", sets: "" });
    setShowAddExerciseModal(true);
  };

  const handlePickUndertrainedSuggestion = (name: string) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add exercises to a locked day.",
        [{ text: "OK" }],
        "lock",
      );
      return;
    }
    if (!topUndertrainedGroup) return;
    setNewExercise({
      name,
      muscleGroup: topUndertrainedGroup.muscleGroup,
      sets: "",
    });
    setShowAddExerciseModal(true);
  };

  const closeAddExerciseModal = () => {
    setShowAddExerciseModal(false);
    setNewExercise({ name: "", muscleGroup: "", sets: "" });
    setNewExerciseSuggestions([]);
    setNewExerciseMuscleGroupSuggestions([]);
  };

  const applyNewExercise = (
    finalName: string,
    trimmedMG: string,
    setsNum: number,
  ) => {
    addNewExercise(currentDay, selectedSplit!, {
      name: finalName,
      // The typo check can substitute a plan-local name for the one the user
      // picked, which would leave the id pointing at a different exercise.
      exerciseId:
        finalName === newExercise.name.trim()
          ? newExercise.exerciseId
          : undefined,
      muscleGroup: trimmedMG,
      sets: setsNum,
    });
    closeAddExerciseModal();
  };

  const handleSaveNewExercise = () => {
    const { name, muscleGroup, sets } = newExercise;
    if (!name.trim()) {
      alert("Error", "Exercise name is required", [{ text: "OK" }], "error");
      return;
    }
    const setsNum = Number.parseInt(sets, 10);
    if (Number.isNaN(setsNum) || setsNum < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      );
      return;
    }
    const trimmed = name.trim();
    const trimmedMG = muscleGroup.trim();
    const tc = checkForTypo(trimmed, allExerciseNames);

    if (tc.exactMatch) {
      applyNewExercise(tc.exactMatch, trimmedMG, setsNum);
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      );
      return;
    }

    if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0];
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}".`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => applyNewExercise(trimmed, trimmedMG, setsNum),
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => applyNewExercise(top.name, trimmedMG, setsNum),
          },
        ],
        "warning",
      );
      return;
    }

    applyNewExercise(trimmed, trimmedMG, setsNum);
  };

  const handleSuggestionPress = (
    suggestion: SimilarityMatch,
    field = "name",
  ) => {
    if (showEditNameModal) {
      if (field === "muscleGroup") {
        setNewMuscleGroup(suggestion.name);
        setMuscleGroupSuggestions([]);
      } else {
        setNewExerciseName(suggestion.name);
        setNameSuggestions([]);
      }
    } else if (showAddExerciseModal) {
      if (field === "muscleGroup") {
        setNewExercise({ ...newExercise, muscleGroup: suggestion.name });
        setNewExerciseMuscleGroupSuggestions([]);
      } else {
        setNewExercise({ ...newExercise, name: suggestion.name });
      }
    }
  };

  const handleDbSuggestionPress = (suggestion: ExerciseSuggestion) => {
    setNewExercise({
      ...newExercise,
      name: suggestion.label,
      exerciseId: suggestion.id,
    });
    setNewExerciseSuggestions([]);
  };

  const getCompleteWorkoutMessage = (done: number, total: number): string =>
    done === total
      ? "Are you sure you want to finish? You've completed all sets!"
      : `You've completed ${done}/${total} sets. End this session? The day will be locked.`;

  const confirmCompleteWorkout = async () => {
    if (isInJointSession) await leaveJointSession();
    const auto = await endWorkout();
    if (!auto)
      alert(
        "Workout Completed! 💪",
        `Day ${currentDay} is now locked.`,
        [{ text: "OK" }],
        "success",
      );
  };

  const handleCompleteWorkout = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Already Locked",
        "This day has already been completed.",
        [{ text: "OK" }],
        "lock",
      );
      return;
    }
    const done = getCompletedSetsCount();
    const total = dayWorkout?.totalSets || 0;
    alert(
      "Complete Workout?",
      getCompleteWorkoutMessage(done, total),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete & Lock",
          onPress: confirmCompleteWorkout,
        },
      ],
      "session",
    );
  };

  const getCompletedSetsCount = useCallback((): number => {
    if (!dayWorkout) return 0;
    return dayWorkout.exercises.reduce(
      (n: number, _: Exercise, i: number) =>
        n + (getExerciseCompletedSets(currentDay, i) as number),
      0,
    );
  }, [dayWorkout, getExerciseCompletedSets, currentDay]);

  const formatTime = useCallback(
    (seconds: number): string => formatDuration(seconds),
    [],
  );

  const formatEndTime = useCallback(
    (d: Date | null): string =>
      d
        ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        : "",
    [],
  );

  const formatDate = useCallback((d: Date): string => formatDateUtil(d), []);

  const isAssistedExercise = useCallback(
    (name: string): boolean => name.toLowerCase().includes("assisted"),
    [],
  );

  const partnerNameSet = useMemo(() => {
    if (!isInJointSession) return new Set<string>();
    const partnerExerciseNames = jointSession?.participants?.find(
      (p) => p.userId !== user?.id,
    )?.exerciseNames;
    if (!partnerExerciseNames?.length) return new Set<string>();
    const partnerSet = new Set<string>(
      partnerExerciseNames.map((e) =>
        normalizeExerciseName(typeof e === "string" ? e : e.name),
      ),
    );
    const myExerciseNames = (dayWorkout?.exercises ?? [])
      .map((ex) => (ex.name ? normalizeExerciseName(ex.name) : undefined))
      .filter(Boolean) as string[];
    return new Set<string>(myExerciseNames.filter((n) => partnerSet.has(n)));
  }, [isInJointSession, jointSession?.participants, dayWorkout]);

  // Single source of truth for every header widget's tint (accent while
  // active, success once complete, muted once locked), shared by both the
  // card background (via WidgetsPanel's getCardBackgroundColor), the
  // fused group's container background (via containerBackgroundColor —
  // see the WidgetsPanel usage below), and the content rendered inside
  // each widget, so the whole set of day-status widgets reads as one
  // cohesive area even though each is its own card.
  //
  // NOTE: this (and the three useCallback hooks below) must be computed
  // here, before the early "empty state" returns, not after them. Hooks
  // can never be conditionally skipped — defining them after an early
  // return meant they simply weren't called on renders that hit one of
  // those returns, which is what caused the "Rendered more hooks than
  // during the previous render" crash.
  const allSetsCompleteForTint = areAllSetsComplete && !isCurrentDayLocked;
  const dayOverviewTint = getDayOverviewTint(
    colors,
    isCurrentDayLocked,
    allSetsCompleteForTint,
  );

  const getWidgetCardBackgroundColor = useCallback(
    (): string | undefined => dayOverviewTint,
    [dayOverviewTint],
  );

  const getWidgetHeaderTextColor = useCallback(
    (): string | undefined => colors.surface,
    [colors.surface],
  );

  // Zeroes out margin/border/shadow between the four day-status widgets and
  // rounds only the group's outer corners, so they read as one continuous
  // card instead of four separate cards with gaps. Only applied outside
  // edit mode — editing needs the drag/resize affordances (dashed border,
  // spacing) visible on each widget.
  //
  // NOTE: each margin edge is set individually (marginTop/Right/Bottom/Left)
  // rather than via the `margin` shorthand. In React Native's layout engine,
  // a specific edge from a later style always wins over an earlier style's
  // shorthand, regardless of object key order — so `{ margin: 0 }` here
  // would NOT beat `styles.widget`'s `marginBottom: 12`, and the widgets
  // would keep a visible 12px gap between them. Setting `marginBottom: 0`
  // explicitly is what actually removes it.
  const getWidgetCardStyleOverride = useCallback(
    (instance: WidgetInstance<WorkoutWidgetType>): object | undefined => {
      if (widgetEditMode) return undefined;
      const base = {
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
        borderRadius: 0,
      };
      switch (instance.type) {
        case "day_number":
          return {
            ...base,
            width: "50%",
            borderTopLeftRadius: WIDGET_GROUP_RADIUS,
          };
        case "total_sets":
          return {
            ...base,
            width: "50%",
            borderTopRightRadius: WIDGET_GROUP_RADIUS,
          };
        case "progress":
          return base;
        case "session_stats":
          return {
            ...base,
            marginBottom: 12, // intentional — separates the fused group from the exercise list below
            borderBottomLeftRadius: WIDGET_GROUP_RADIUS,
            borderBottomRightRadius: WIDGET_GROUP_RADIUS,
          };
        default:
          return undefined;
      }
    },
    [widgetEditMode],
  );

  const emptyState = getEmptyStateInfo(
    workoutData,
    selectedSplit,
    dayWorkout,
    currentDay,
  );
  if (emptyState)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{emptyState.icon}</Text>
        <Text style={styles.emptyTitle}>{emptyState.title}</Text>
        <Text style={styles.emptyText}>{emptyState.text}</Text>
      </View>
    );

  const completedSetsCount = getCompletedSetsCount();
  const totalSetsCount = dayWorkout?.totalSets ?? 0;
  const progressPercentage = computeProgressPercentage(
    completedSetsCount,
    totalSetsCount,
  );
  const allSetsComplete = areAllSetsComplete && !isCurrentDayLocked;
  const estimatedRemaining = getEstimatedTimeRemaining(currentDay) as
    | number
    | null;
  const estimatedEnd = getEstimatedEndTime(currentDay);

  const partnerParticipant = isInJointSession
    ? jointSession?.participants?.find((p) => p.userId !== user?.id)
    : null;

  const renderWidgetContent = (
    instance: WidgetInstance<WorkoutWidgetType>,
  ): React.ReactNode => {
    switch (instance.type) {
      case "day_number":
        return (
          <View style={styles.dayNumberWidgetInner}>
            <Text style={styles.dayNumberValue}>
              {dayWorkout?.dayNumber}
            </Text>
            {isCurrentDayLocked && (
              <View style={styles.dayNumberLockedTag}>
                <Text style={styles.dayNumberLockedText}>🔒 Locked</Text>
              </View>
            )}
          </View>
        );

      case "total_sets":
        return (
          <View style={styles.totalSetsWidgetInner}>
            <Text style={styles.setsValue}>
              {dayWorkout?.totalSets}
            </Text>
          </View>
        );

      case "progress":
        return (
          <View style={styles.headerCardInner}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressText}>
                  {completedSetsCount} / {totalSetsCount} sets completed
                </Text>
                {workoutStartTime &&
                  estimatedRemaining != null &&
                  estimatedRemaining > 0 &&
                  !isCurrentDayLocked && (
                    <Text style={styles.progressText}>
                      ~{formatTime(estimatedRemaining)} left
                    </Text>
                  )}
              </View>
              {workoutStartTime &&
                estimatedEnd &&
                estimatedRemaining != null &&
                estimatedRemaining > 0 &&
                !isCurrentDayLocked && (
                  <Text style={styles.endTimeText}>
                    Estimated finish: {formatEndTime(estimatedEnd)}
                  </Text>
                )}
            </View>
            {(allSetsComplete || isCurrentDayLocked) && (
              <View style={styles.completeMessage}>
                <Text style={styles.completeMessageText}>
                  {isCurrentDayLocked
                    ? `🔒 Locked (${completedSetsCount}/${totalSetsCount} sets) - View Only`
                    : "🎉 All sets complete! Great job!"}
                </Text>
              </View>
            )}
          </View>
        );

      case "session_stats":
        return (
          <SessionStatsWidget
            workoutStartTime={workoutStartTime}
            isCurrentDayLocked={isCurrentDayLocked}
            currentDay={currentDay}
            restReminderEnabled={restReminderEnabled}
            restReminderSeconds={restReminderSeconds}
            onOpenReminderModal={handleOpenRestReminderModal}
            styles={styles}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]} {...panHandlers}>
      <View style={styles.container}>
        {isPulling && (
          <View pointerEvents='none' style={styles.pullHint}>
            <Text style={styles.pullHintText}>
              {getPullHintText(pullDistance)}
            </Text>
          </View>
        )}

        {isInJointSession && (
          <PartnerBanner
            partnerProgress={partnerProgress}
            isPartnerReady={isPartnerReady}
            syncPulse={syncPulse}
            partnerUsername={partnerUsername}
            onLeave={leaveJointSession}
          />
        )}

        {isCurrentDayLocked && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedBannerIcon}>🔒</Text>
            <View style={styles.lockedBannerTextContainer}>
              <Text style={styles.lockedBannerTitle}>
                Day Completed & Locked
              </Text>
              <Text style={styles.lockedBannerText}>
                This workout is view-only. Select another day to continue.
              </Text>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.exerciseList}
          contentContainerStyle={styles.exerciseListContent}
          scrollEnabled={!isPulling}
        >
          {widgetsLoaded && widgets.length > 0 && widgetEditMode && (
            <View style={styles.widgetsSectionHeader}>
              <Text style={styles.widgetsSectionTitle}>Editing Widgets</Text>
              <TouchableOpacity
                onPress={() => setWidgetEditMode(false)}
                hitSlop={8}
              >
                <Text style={styles.widgetsEditToggle}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
          <WidgetsPanel
            widgets={widgets}
            editMode={widgetEditMode}
            onCycleSize={cycleWidgetSize}
            onRemove={removeWidget}
            onReorder={reorderWidgets}
            renderContent={renderWidgetContent}
            registry={WORKOUT_WIDGET_REGISTRY}
            getCardBackgroundColor={getWidgetCardBackgroundColor}
            getHeaderTextColor={getWidgetHeaderTextColor}
            getCardStyleOverride={getWidgetCardStyleOverride}
            containerBackgroundColor={
              !widgetEditMode ? dayOverviewTint : undefined
            }
            containerBorderRadius={
              !widgetEditMode ? WIDGET_GROUP_RADIUS : undefined
            }
          />

          {showUndertrainedBanner &&
            topUndertrainedGroup &&
            undertrainedSuggestionCandidates.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text style={[styles.suggestionsTitle, { marginBottom: 0, flex: 1 }]}>
                  💪 {topUndertrainedGroup.muscleGroup} is behind this week — try:
                </Text>
                <TouchableOpacity
                  onPress={() => setDismissedUndertrainedBanner(true)}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
              {undertrainedSuggestionCandidates.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.suggestionButton}
                  onPress={() => handlePickUndertrainedSuggestion(name)}
                >
                  <Text style={styles.suggestionText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(() => {
            const exercises = dayWorkout?.exercises ?? [];
            const indexed = exercises.map((exercise, originalIndex) => ({
              exercise,
              originalIndex,
            }));
            const isPriority = (exercise: Exercise): boolean =>
              showUndertrainedPerExercise &&
              !!topUndertrainedGroup &&
              !!exercise.muscleGroup &&
              normalizeExerciseName(exercise.muscleGroup) ===
                normalizeExerciseName(topUndertrainedGroup.muscleGroup);
            const ordered = showUndertrainedPerExercise
              ? [...indexed].sort((a, b) => {
                  const aPriority = isPriority(a.exercise) ? 0 : 1;
                  const bPriority = isPriority(b.exercise) ? 0 : 1;
                  return aPriority - bPriority;
                })
              : indexed;
            return ordered.map(({ exercise, originalIndex }) => (
              <ExerciseCard
                key={exercise.name || originalIndex}
                exercise={exercise}
                exerciseIndex={originalIndex}
                isPriorityMuscleGroup={isPriority(exercise)}
                currentDay={currentDay}
                isCurrentDayLocked={isCurrentDayLocked}
                colors={colors}
                styles={styles}
                weightUnit={weightUnit}
                isInJointSession={isInJointSession}
                partnerNameSet={partnerNameSet}
                partnerProgress={partnerProgress}
                partnerParticipant={partnerParticipant}
                partnerCompletedSets={partnerCompletedSets}
                partnerUsername={partnerUsername}
                getExerciseCompletedSets={getExerciseCompletedSets}
                isSetComplete={isSetComplete}
                getSetDetails={getSetDetails}
                isAssistedExercise={isAssistedExercise}
                onEditExerciseName={handleEditExerciseName}
                onSetPress={handleSetPress}
                onQuickAddSet={handleQuickAddSet}
                onAddMultipleSets={handleAddMultipleSets}
              />
            ));
          })()}

          {!isCurrentDayLocked && (
            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={handleAddNewExercise}
            >
              <Text style={styles.addExerciseButtonIcon}>➕</Text>
              <Text style={styles.addExerciseButtonText}>Add New Exercise</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {workoutStartTime && !isCurrentDayLocked && (
          <Animated.View
            style={[
              styles.bottomActions,
              {
                bottom: bottomAnim,
                left: leftAnim,
                borderTopLeftRadius: borderRadiusAnim,
                paddingBottom: paddingBottomAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.completeWorkoutButton}
              onPress={handleCompleteWorkout}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.completeWorkoutGradient}
              >
                <Text style={styles.completeWorkoutIcon}>💪</Text>
                <Text style={styles.completeWorkoutButtonText}>
                  Complete Session
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        <ModalSheet
          visible={showSetModal}
          onClose={() => {
            setShowSetModal(false);
            setSelectedSet(null);
            setWeight("");
            setReps("");
            setSetNote("");
            setIsWarmupSet(false);
            setPerformanceHistory(null);
          }}
          title='Set Details'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <TouchableOpacity
            style={[
              styles.warmupToggle,
              isWarmupSet && styles.warmupToggleActive,
            ]}
            onPress={() => setIsWarmupSet(!isWarmupSet)}
          >
            <Text
              style={[
                styles.warmupToggleText,
                isWarmupSet && styles.warmupToggleTextActive,
              ]}
            >
              {isWarmupSet ? "🔥 Warm-up Set" : "Tap to mark as warm-up"}
            </Text>
          </TouchableOpacity>

          <View style={styles.unitSelectorContainer}>
            <Text style={styles.unitSelectorLabel}>Weight unit</Text>
            <View style={styles.unitSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === "kg" && styles.unitButtonActive,
                ]}
                onPress={() => {
                  if (weightUnit !== "kg") {
                    const currentLbs = Number.parseFloat(weight);
                    if (Number.isFinite(currentLbs) && currentLbs > 0) {
                      setWeight((currentLbs * LBS_TO_KG).toFixed(1));
                    }
                    saveWeightUnit("kg");
                  }
                }}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    weightUnit === "kg" && styles.unitButtonTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === "lbs" && styles.unitButtonActive,
                ]}
                onPress={() => {
                  if (weightUnit !== "lbs") {
                    const currentKg = Number.parseFloat(weight);
                    if (Number.isFinite(currentKg) && currentKg > 0) {
                      setWeight((currentKg * KG_TO_LBS).toFixed(1));
                    }
                    saveWeightUnit("lbs");
                  }
                }}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    weightUnit === "lbs" && styles.unitButtonTextActive,
                  ]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {loadingHistory ? (
            <View style={styles.historyLoading}>
              <Text style={styles.historyLoadingText}>Loading history...</Text>
            </View>
          ) : performanceHistory ? (
            <View style={styles.performanceSection}>
              <Text style={styles.performanceSectionTitle}>
                📊 Performance History
              </Text>
              <View style={styles.performanceCard}>
                <View style={styles.performanceCardHeader}>
                  <Text style={styles.performanceCardTitle}>🕐 Last Time</Text>
                  <Text style={styles.performanceCardDate}>
                    {formatDate(performanceHistory.last.date)}
                  </Text>
                </View>
                <View style={styles.performanceStats}>
                  <View style={styles.performanceStat}>
                    {/* History is stored in kg — display in chosen unit */}
                    <Text style={styles.performanceStatValue}>
                      {kgToDisplay(performanceHistory.last.weight, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Weight</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text style={styles.performanceStatValue}>
                      {performanceHistory.last.reps}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Reps</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text style={styles.performanceStatValue}>
                      {kgToDisplay(performanceHistory.last.volume, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Volume</Text>
                  </View>
                </View>
              </View>
              <View
                style={[styles.performanceCard, styles.bestPerformanceCard]}
              >
                <View style={styles.performanceCardHeader}>
                  <Text style={styles.performanceCardTitle}>
                    🏆 Best Performance
                  </Text>
                  <Text style={styles.performanceCardDate}>
                    {formatDate(performanceHistory.best.date)}
                  </Text>
                </View>
                <View style={styles.performanceStats}>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {kgToDisplay(performanceHistory.best.weight, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Weight</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {performanceHistory.best.reps}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Reps</Text>
                  </View>
                  <View style={styles.performanceStat}>
                    <Text
                      style={[
                        styles.performanceStatValue,
                        styles.bestStatValue,
                      ]}
                    >
                      {kgToDisplay(performanceHistory.best.volume, weightUnit)}
                      {weightUnit}
                    </Text>
                    <Text style={styles.performanceStatLabel}>Volume</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.performanceTotalAttempts}>
                Total attempts: {performanceHistory.totalAttempts}
              </Text>
            </View>
          ) : (
            <View style={styles.noHistoryContainer}>
              <Text style={styles.noHistoryText}>
                No previous data for this exercise
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight ({weightUnit})</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType='decimal-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reps</Text>
            <TextInput
              style={styles.input}
              value={reps}
              onChangeText={setReps}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          {checkIsSelectedSetAssisted(
            selectedSet,
            dayWorkout,
          ) && (
            <View style={styles.assistedInfoBox}>
              <Text style={styles.assistedInfoText}>
                🤝 Assisted Exercise - Weight represents assistance from the
                machine. Lower = harder.
              </Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={setNote}
              onChangeText={setSetNote}
              placeholder='e.g., felt strong'
              placeholderTextColor='#999'
              multiline
              numberOfLines={3}
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSetDetails}
          >
            <Text style={styles.saveButtonText}>Save Set</Text>
          </TouchableOpacity>
        </ModalSheet>

        <ModalSheet
          visible={showEditNameModal}
          onClose={closeEditModal}
          title='Edit Exercise'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Exercise Name</Text>
            <TextInput
              style={styles.input}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder='Enter exercise name'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          {nameSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {nameSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={s.name ?? i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "name")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Muscle Group</Text>
            <TextInput
              style={styles.input}
              value={newMuscleGroup}
              onChangeText={setNewMuscleGroup}
              placeholder='e.g., Chest'
              placeholderTextColor='#999'
            />
          </View>
          {muscleGroupSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {muscleGroupSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={s.name ?? i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "muscleGroup")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {swapSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>
                🔄 Swap for similar exercise:
              </Text>
              {swapSuggestions.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.suggestionButton}
                  onPress={() => setNewExerciseName(name)}
                >
                  <Text style={styles.suggestionText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveExerciseName}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </ModalSheet>

        <ModalSheet
          visible={showAddSetsModal}
          onClose={() => {
            setShowAddSetsModal(false);
            setAddingSetsExercise(null);
            setAdditionalSets("");
          }}
          title='Add Multiple Sets'
          subtitle={getAddingSetsSubtitle(addingSetsExercise)}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Sets to Add</Text>
            <TextInput
              style={styles.input}
              value={additionalSets}
              onChangeText={setAdditionalSets}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAdditionalSets}
          >
            <Text style={styles.saveButtonText}>Add Sets</Text>
          </TouchableOpacity>
        </ModalSheet>

        <ModalSheet
          visible={showAddExerciseModal}
          onClose={closeAddExerciseModal}
          title='Add New Exercise'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Exercise Name *</Text>
            <TextInput
              style={styles.input}
              value={newExercise.name}
              onChangeText={(t) =>
                setNewExercise({ ...newExercise, name: t, exerciseId: undefined })
              }
              placeholder='e.g., Bench Press'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          {newExerciseSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.suggestionButton}
                  onPress={() => handleDbSuggestionPress(s)}
                >
                  <Text style={styles.suggestionText}>{s.label}</Text>
                  <Text style={styles.suggestionMatch}>{s.meta}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Muscle Group</Text>
            <TextInput
              style={styles.input}
              value={newExercise.muscleGroup}
              onChangeText={(t) =>
                setNewExercise({ ...newExercise, muscleGroup: t })
              }
              placeholder='e.g., Chest'
              placeholderTextColor='#999'
            />
          </View>
          {newExerciseMuscleGroupSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseMuscleGroupSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={s.name ?? i}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(s, "muscleGroup")}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(s.similarity * 100)}% match
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Sets *</Text>
            <TextInput
              style={styles.input}
              value={newExercise.sets}
              onChangeText={(t) => setNewExercise({ ...newExercise, sets: t })}
              keyboardType='number-pad'
              placeholder='0'
              placeholderTextColor='#999'
            />
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveNewExercise}
          >
            <Text style={styles.saveButtonText}>Add Exercise</Text>
          </TouchableOpacity>
        </ModalSheet>

        <ModalSheet
          visible={showRestReminderModal}
          onClose={() => setShowRestReminderModal(false)}
          title='Rest Reminder'
          scrollable={true}
          showCancelButton={false}
          showConfirmButton={false}
        >
          <Text style={styles.inputLabel}>
            Get notified once your rest time reaches this duration.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Seconds</Text>
            <TextInput
              style={styles.input}
              value={tempRestReminderSeconds}
              onChangeText={setTempRestReminderSeconds}
              keyboardType='number-pad'
              placeholder='e.g., 90'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          <View style={styles.restReminderPresetRow}>
            {[60, 90, 120, 180].map((preset) => (
              <TouchableOpacity
                key={preset}
                style={styles.restReminderPresetChip}
                onPress={() => setTempRestReminderSeconds(String(preset))}
              >
                <Text style={styles.restReminderPresetChipText}>
                  {formatTime(preset)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSaveRestReminder()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSaveRestReminder(0)}
          >
            <Text style={styles.saveButtonText}>Turn Off</Text>
          </TouchableOpacity>
        </ModalSheet>

        {AlertComponent}
      </View>

      <WidgetGallery
        visible={showWidgetGallery}
        onClose={() => setShowWidgetGallery(false)}
        availableWidgets={availableToAdd}
        onAddWidget={handleAddWidget}
        hasPlacedWidgets={widgets.length > 0}
        onEditWidgets={handleEditWidgets}
      />
    </SafeAreaView>
  );
}

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
      backgroundColor: colors.background,
    },
    emptyIcon: { fontSize: 64, marginBottom: 20 },
    emptyTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    pullHint: {
      position: "absolute",
      top: 8,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 40,
    },
    pullHintText: {
      backgroundColor: colors.accentDark,
      color: colors.surface,
      fontSize: 12,
      fontWeight: "700",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      overflow: "hidden",
    },
    widgetsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    widgetsSectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    widgetsEditToggle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
    },
    widgetLineMuted: {
      fontSize: 13,
      color: colors.surface,
      opacity: 0.8,
      fontStyle: "italic",
    },
    lockedBanner: {
      backgroundColor: "#ff9800",
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      paddingHorizontal: 20,
    },
    lockedBannerIcon: { fontSize: 24, marginRight: 12 },
    lockedBannerTextContainer: { flex: 1 },
    lockedBannerTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.surface,
      marginBottom: 2,
    },
    lockedBannerText: { fontSize: 13, color: colors.surface, opacity: 0.95 },
    // ── Widget-hosted content. Each widget's own card background color
    // (accent / success / locked) is painted by WidgetsPanel itself via
    // getCardBackgroundColor, so these wrappers stay fully transparent and
    // just provide layout — no seam between a widget's icon/title row and
    // its content. ──────────────────────────────────────────────────────
    headerCardInner: {
      backgroundColor: "transparent",
    },
    // ── Day number / Total sets: the widget's own header row (icon +
    // title, rendered by WidgetsPanel) already labels these ("📅 Day",
    // "🔢 Total Sets"), so the content body deliberately shows ONLY the
    // big value — repeating the label here just doubled up the text and
    // is what made these two tiles look cluttered. Both are centered
    // (rather than one left-aligned/one centered, as before) so the fused
    // pair reads as a single, symmetrical stat row. ─────────────────────
    dayNumberWidgetInner: {
      backgroundColor: "transparent",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    dayNumberValue: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.surface,
      letterSpacing: -0.5,
    },
    dayNumberLockedTag: {
      marginTop: 4,
    },
    dayNumberLockedText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.surface,
      opacity: 0.8,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    totalSetsWidgetInner: {
      backgroundColor: "transparent",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    setsValue: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.surface,
      letterSpacing: -0.5,
    },
    progressContainer: { marginTop: 0 },
    progressBar: {
      height: 8,
      backgroundColor: "rgba(255,255,255,0.3)",
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 8,
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.surface,
      borderRadius: 4,
    },
    progressTextRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressText: { fontSize: 14, color: colors.surface, opacity: 0.9 },
    endTimeText: {
      fontSize: 12,
      color: colors.surface,
      opacity: 0.8,
      marginTop: 4,
    },
    sessionStatsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    sessionStat: { alignItems: "center" },
    sessionStatLabel: {
      fontSize: 12,
      color: colors.surface,
      opacity: 0.85,
      marginBottom: 4,
    },
    sessionStatValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.surface,
    },
    currentRestContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.25)",
    },
    currentRestLabel: {
      fontSize: 14,
      color: colors.surface,
      opacity: 0.85,
      marginRight: 8,
    },
    currentRestValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.surface,
    },
    currentRestOvertime: { color: "#fde68a" }, // amber, readable on accent bg
    overtimeText: { fontSize: 14, color: "#fde68a" },
    completeMessage: {
      marginTop: 15,
      padding: 12,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 8,
    },
    completeMessageText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    exerciseList: { flex: 1 },
    exerciseListContent: { padding: 15, paddingBottom: 140 },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    exerciseCardComplete: {
      backgroundColor: "#f0fff4",
      borderColor: colors.success,
    },
    exerciseCardLocked: {
      backgroundColor: colors.inputBackground,
      borderColor: colors.surfaceBorder,
    },
    exerciseCardShared: {
      borderColor: colors.warning,
      backgroundColor: "#fffbeb",
    },
    exerciseCardPartner: {
      borderColor: colors.accentDark,
      backgroundColor: "#faf5ff",
    },
    exerciseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    exerciseInfo: { flex: 1 },
    exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    exerciseName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
      flex: 1,
    },
    exerciseNameComplete: { color: colors.success },
    editButton: { padding: 4 },
    editButtonText: { fontSize: 16 },
    muscleGroup: { fontSize: 14, color: colors.textSecondary },
    exerciseProgress: {
      backgroundColor: colors.separator,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    exerciseProgressText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    setsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    setButton: {
      width: 70,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.separator,
      borderWidth: 2,
      borderColor: "#ddd",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      padding: 4,
    },
    setButtonComplete: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    setButtonLocked: { backgroundColor: "#ff9800", borderColor: "#d97706" },
    setButtonWarmup: { backgroundColor: "#fb923c", borderColor: "#ea580c" },
    setButtonPartner: {
      borderColor: colors.accentDark,
      borderWidth: 3,
      backgroundColor: colors.infoLight,
    },
    setButtonPartnerDone: { borderColor: colors.info, borderWidth: 2 },
    partnerSetDot: {
      position: "absolute",
      top: -4,
      left: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accentDark,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    setButtonNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textSecondary,
      marginBottom: 2,
    },
    setButtonNumberComplete: { color: colors.surface },
    warmupText: { fontSize: 14 },
    setDetailsPreview: { alignItems: "center" },
    setDetailsText: { fontSize: 10, color: colors.surface, fontWeight: "500" },
    setNoteIndicator: { fontSize: 10, marginTop: 2 },
    setCheckmark: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    setCheckmarkText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "bold",
    },
    addSetButton: {
      width: 70,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.accentLight,
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    addSetButtonIcon: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.accent,
    },
    exerciseHint: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      alignItems: "center",
    },
    exerciseHintText: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    addExerciseButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: "dashed",
    },
    addExerciseButtonIcon: { fontSize: 32, marginBottom: 8 },
    addExerciseButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.accent,
    },
    bottomActions: {
      position: "absolute",
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: "transparent",
    },
    completeWorkoutButton: {
      borderRadius: 28,
      overflow: "hidden",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 12,
    },
    completeWorkoutGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 17,
      paddingHorizontal: 32,
      borderRadius: 28,
      gap: 10,
    },
    completeWorkoutIcon: { fontSize: 20 },
    completeWorkoutButtonText: {
      color: colors.surface,
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    warmupToggle: {
      backgroundColor: colors.separator,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    warmupToggleActive: { backgroundColor: "#fff7ed", borderColor: "#fb923c" },
    warmupToggleText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      fontWeight: "500",
    },
    warmupToggleTextActive: { color: "#ea580c", fontWeight: "600" },

    unitSelectorContainer: { marginBottom: 16 },
    unitSelectorLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    unitSelectorRow: { flexDirection: "row", gap: 10 },
    unitButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBackground,
      alignItems: "center",
    },
    unitButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
    },
    unitButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    unitButtonTextActive: { color: colors.accent },

    performanceSection: { marginBottom: 20 },
    performanceSectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    performanceCard: {
      backgroundColor: colors.accentLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    bestPerformanceCard: {
      backgroundColor: "#fff7ed",
      borderColor: colors.warning,
    },
    performanceCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    performanceCardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    performanceCardDate: { fontSize: 12, color: colors.textSecondary },
    performanceStats: { flexDirection: "row", justifyContent: "space-around" },
    performanceStat: { alignItems: "center" },
    performanceStatValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 4,
    },
    bestStatValue: { color: colors.warning },
    performanceStatLabel: { fontSize: 12, color: colors.textSecondary },
    performanceTotalAttempts: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 4,
    },
    historyLoading: { padding: 20, alignItems: "center" },
    historyLoadingText: { fontSize: 14, color: colors.textMuted },
    noHistoryContainer: {
      padding: 20,
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      marginBottom: 20,
    },
    noHistoryText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    inputGroup: { marginBottom: 20 },
    inputLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
    },
    notesInput: { minHeight: 80, textAlignVertical: "top" },
    assistedInfoBox: {
      backgroundColor: "#dbeafe",
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#3b82f6",
    },
    assistedInfoText: { fontSize: 14, color: colors.info, textAlign: "center" },
    saveButton: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
    },
    saveButtonText: { color: colors.surface, fontSize: 18, fontWeight: "bold" },
    suggestionsContainer: {
      backgroundColor: "#fffbeb",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    suggestionsTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: "#92400e",
      marginBottom: 12,
    },
    suggestionButton: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.warning,
    },
    suggestionText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
      flex: 1,
    },
    suggestionMatch: { fontSize: 12, color: "#92400e", fontWeight: "600" },
    restReminderPresetRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    restReminderPresetChip: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    restReminderPresetChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  });
