import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkout } from "@shared/context/WorkoutContext";
import { useTheme } from "@shared/context/ThemeContext";
import type { ThemeColors } from "@shared/context/ThemeContext";
import { useAlert } from "@shared/components/CustomAlert";
import { matchProgram, applyResolution, sameExercise } from "./utils/matchProgram";
import { onRenderProfiler, perfLog, startTimer, useRenderTimer } from "@utils/perf";
import type { UnresolvedExercise } from "./utils/matchProgram";
import MatchReviewModal from "./components/MatchReviewModal";
import { workoutApi } from "@features/workout/services/index";
import { programApi } from "@features/plan/services/index";
import { useWidgets } from "@shared/context/hooks/useWidgets";
import { useTwoFingerPull } from "@shared/context/hooks/useTwoFingerPull";
import WidgetGallery from "@shared/components/widgets/WidgetGallery";
import WidgetsPanel from "@shared/components/widgets/WidgetsPanel";
import {
  PLAN_WIDGET_REGISTRY,
  DEFAULT_PLAN_WIDGETS,
  PLAN_WIDGETS_STORAGE_KEY,
  type PlanWidgetType,
} from "./widgets";
import type {
  WorkoutData,
  WorkoutDay,
  WidgetInstance,
} from "@shared/types";
import {
  DEFAULT_SPLITS,
  createCustomSplitTemplate,
  buildProgramFromTemplate,
  insertTemplateIntoProgram,
  type SplitTemplate,
  type SplitDayTemplate,
} from "@features/plan/utils/splitTemplates";
import { exportProgramData } from "@features/plan/utils/exportProgram";
import {
  extractSplitColumnCandidates,
  parseWorkoutFileClient,
  type SplitColumnCandidate,
} from "@utils/clientWorkoutParser";
import SplitColumnPicker from "./utils/splitColumnPicker";
import ModalSheet from "@shared/components/ModalSheet";
import type { WdDay, SplitDayDraft } from "./types";
import { SplitDayRow } from "./components/SplitDayRow";
import type { CanonicalExercise } from "@utils/exerciseDb";
import { ProgramDayCard } from "./components/ProgramDayCard";
import { visibleDaysForSplit } from "@utils/programDays";
import { applySplitDraft, draftsFromProgram } from "./utils/splitDraft";
import { allDayIndices } from "./components/programDayHelpers";

export type Styles = ReturnType<typeof makeStyles>;

// Rendering every day card at once is what makes Plan feel slow to load for
// large imported programs — each card is a full nested tree (exercises,
// sets-by-split badges). Showing a bounded slice up front keeps first paint
// fast; "Show more" reveals the rest on demand.
const INITIAL_DAYS_SHOWN = 10;

const DEFAULT_TEMPLATE_SETS = 3;

const EMPTY_SPLIT_DAY = (): SplitDayDraft => ({
  dayTitle: "",
  exercises: [],
});

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PlanScreen(): React.JSX.Element {
  const markBodyDone = useRenderTimer("PlanScreen");

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    workoutData,
    selectedSplit,
    saveWorkoutData,
    saveSelectedSplit,
    userId,
  } = useWorkout();
  const { alert, AlertComponent } = useAlert();
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [unresolvedMatches, setUnresolvedMatches] = useState<
    UnresolvedExercise[]
  >([]);
  const [showMatchReview, setShowMatchReview] = useState(false);
  const hasCheckedMatches = useRef(false);
  const workoutDataRef = useRef(workoutData);
  workoutDataRef.current = workoutData;
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
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
  } = useWidgets<PlanWidgetType>(userId ?? null, {
    registry: PLAN_WIDGET_REGISTRY,
    defaults: DEFAULT_PLAN_WIDGETS,
    storageKey: PLAN_WIDGETS_STORAGE_KEY,
  });

  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setContentReady(true);
    });
    return () => task.cancel();
  }, []);

  // Two-finger pull brings up the "deploy" panel for adding widgets — same
  // gesture as HomeScreen. Opening it and tapping "Edit Widgets" switches
  // this screen into edit mode, where placed widgets can be resized,
  // removed, or dragged to reorder.
  const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
    setShowWidgetGallery(true);
  });

  const handleEditWidgets = () => {
    setShowWidgetGallery(false);
    setWidgetEditMode(true);
  };

  const handleAddWidget = async (type: Parameters<typeof addWidget>[0]) => {
    const result = await addWidget(type);
    if (!result.success && result.error) {
      alert("Can't Add Widget", result.error, [{ text: "OK" }]);
      return;
    }
    setShowWidgetGallery(false);
  };

  const [visibleDayCount, setVisibleDayCount] = useState(INITIAL_DAYS_SHOWN);
  const [hiddenDays, setHiddenDays] = useState<Set<number>>(() =>
    allDayIndices(workoutData),
  );
  const [isCreatingSplit, setIsCreatingSplit] = useState(false);
  const [editingSplitName, setEditingSplitName] = useState<string | null>(null);
  const [expandedSplitDayIdx, setExpandedSplitDayIdx] = useState<number | null>(
    0,
  );
  const [newSplitName, setNewSplitName] = useState("");
  const [draftSplitDays, setDraftSplitDays] = useState<SplitDayDraft[]>([
    EMPTY_SPLIT_DAY(),
  ]);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null);
  const [pendingImportName, setPendingImportName] = useState<string | null>(
    null,
  );
  const [columnCandidates, setColumnCandidates] = useState<
    SplitColumnCandidate[]
  >([]);
  const [selectedColumnIndices, setSelectedColumnIndices] = useState<
    Set<number>
  >(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isImportingColumns, setIsImportingColumns] = useState(false);

  // Any save (logging a set, resolving a match) hands back a fresh
  // workoutData object. Resetting on identity collapsed the day list the user
  // had just expanded and re-rendered the screen for nothing, so only the
  // program's shape counts as a change.
  const programShape = useMemo(
    () =>
      (workoutData?.days ?? [])
        .map((day) => (day as { dayTitle?: string })?.dayTitle ?? "")
        .join("|"),
    [workoutData],
  );

  useEffect(() => {
    setSelectedProgram(null);
    setHiddenDays(allDayIndices(workoutDataRef.current));
    setIsCreatingSplit(false);
    setVisibleDayCount(INITIAL_DAYS_SHOWN);
  }, [programShape]);

  useEffect(() => {
    if (hasCheckedMatches.current || !workoutData?.days?.length) return;
    hasCheckedMatches.current = true;
    const effectTimer = startTimer();
    const { program: matched, unresolved } = matchProgram(workoutData);
    setUnresolvedMatches(unresolved);
    const compareTimer = startTimer();
    const changed = JSON.stringify(matched) !== JSON.stringify(workoutData);
    perfLog("PlanScreen.matchEffect.compare", compareTimer(), `changed=${changed}`);
    if (changed) {
      const saveTimer = startTimer();
      void saveWorkoutData(matched).then(() =>
        perfLog("PlanScreen.matchEffect.save", saveTimer()),
      );
    }
    perfLog("PlanScreen.matchEffect", effectTimer());
  }, [workoutData]);

  const handleRecheckMatches = (): void => {
    if (!workoutData) return;
    const { program: matched, unresolved } = matchProgram(workoutData, true);
    setUnresolvedMatches(unresolved);
    setShowMatchReview(unresolved.length > 0);
    if (JSON.stringify(matched) !== JSON.stringify(workoutData))
      void saveWorkoutData(matched);
  };

  const handleUploadFile = async (): Promise<void> => {
    try {
      setIsUploading(true);
      const fileUri = await workoutApi.pickWorkoutFile();
      if (!fileUri) {
        setIsUploading(false);
        return;
      }

      const candidates = await extractSplitColumnCandidates(fileUri);
      if (candidates.length === 0) {
        alert(
          "No columns found",
          'We couldn\'t find any column headers to choose from in this file. Double-check it has a "Day" row followed by a header row.',
          [{ text: "OK" }],
        );
        setIsUploading(false);
        return;
      }

      const fileName = fileUri.split("/").pop() ?? null;
      setPendingImportUri(fileUri);
      setPendingImportName(fileName);
      setColumnCandidates(candidates);
      setSelectedColumnIndices(
        new Set(candidates.filter((c) => c.autoSelected).map((c) => c.index)),
      );
      setShowColumnPicker(true);
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to read workout file",
        [{ text: "OK" }],
      );
    } finally {
      setIsUploading(false);
    }
  };

  const toggleColumnSelection = (index: number) => {
    setSelectedColumnIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumnIndices(new Set(columnCandidates.map((c) => c.index)));
  };

  const selectNoneColumns = () => {
    setSelectedColumnIndices(new Set());
  };

  const resetColumnPicker = () => {
    setShowColumnPicker(false);
    setPendingImportUri(null);
    setPendingImportName(null);
    setColumnCandidates([]);
    setSelectedColumnIndices(new Set());
  };

  const handleConfirmColumnImport = async (): Promise<void> => {
    if (!pendingImportUri || selectedColumnIndices.size === 0) return;
    setIsImportingColumns(true);
    try {
      const data = await parseWorkoutFileClient(
        pendingImportUri,
        Array.from(selectedColumnIndices),
      );
      const { program: matched, unresolved } = matchProgram(data);
      await saveWorkoutData(matched);
      setUnresolvedMatches(unresolved);
      setShowMatchReview(unresolved.length > 0);
      try {
        await programApi.saveProgram(matched);
      } catch (err) {
        console.warn(
          "Could not sync imported program to server (will retry on next sync):",
          (err as Error).message,
        );
      }
      alert(
        "Success!",
        `Loaded ${data?.totalDays ?? data?.days?.length ?? 0} workout days for ${data.split?.join(", ") ?? ""}`,
        [{ text: "OK" }],
        "success",
      );
      resetColumnPicker();
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to import workout file",
        [{ text: "OK" }],
      );
    } finally {
      setIsImportingColumns(false);
    }
  };

  const handleResolveMatch = async (
    target: UnresolvedExercise,
    exerciseId: string | null,
  ) => {
    const twins = unresolvedMatches.filter((u) => sameExercise(u, target));
    setUnresolvedMatches((prev) => prev.filter((u) => !sameExercise(u, target)));
    if (exerciseId === null || !workoutData) return;
    await saveWorkoutData(applyResolution(workoutData, twins, exerciseId));
  };

  const openCreateSplit = () => {
    setExpandedSplitDayIdx(0);
    setIsCreatingSplit(true);
  };

  const toggleSplitDayExpanded = (idx: number) =>
    setExpandedSplitDayIdx((prev) => (prev === idx ? null : idx));

  const addDraftSplitDay = () => {
    setDraftSplitDays((prev) => {
      setExpandedSplitDayIdx(prev.length);
      return [...prev, EMPTY_SPLIT_DAY()];
    });
  };

  const removeDraftSplitDay = (idx: number) => {
    setDraftSplitDays((prev) => prev.filter((_, i) => i !== idx));
    setExpandedSplitDayIdx(null);
  };

  const patchDraftSplitDay = (
    idx: number,
    patch: (day: SplitDayDraft) => SplitDayDraft,
  ) => {
    setDraftSplitDays((prev) =>
      prev.map((day, i) => (i === idx ? patch(day) : day)),
    );
  };

  const updateDraftSplitDayTitle = (idx: number, value: string) =>
    patchDraftSplitDay(idx, (day) => ({ ...day, dayTitle: value }));

  const addDraftSplitExercise = (idx: number, exercise: CanonicalExercise) =>
    patchDraftSplitDay(idx, (day) => ({
      ...day,
      exercises: [
        ...day.exercises,
        {
          name: exercise.name,
          exerciseId: exercise.id,
          muscleGroup: exercise.primaryMuscles[0] ?? "",
          sets: String(DEFAULT_TEMPLATE_SETS),
        },
      ],
    }));

  const updateDraftSplitExerciseSets = (
    idx: number,
    exIdx: number,
    value: string,
  ) =>
    patchDraftSplitDay(idx, (day) => ({
      ...day,
      exercises: day.exercises.map((e, i) =>
        i === exIdx ? { ...e, sets: value.replace(/[^0-9]/g, "") } : e,
      ),
    }));

  const removeDraftSplitExercise = (idx: number, exIdx: number) =>
    patchDraftSplitDay(idx, (day) => ({
      ...day,
      exercises: day.exercises.filter((_, i) => i !== exIdx),
    }));

  const resetCreateSplitForm = () => {
    setIsCreatingSplit(false);
    setEditingSplitName(null);
    setNewSplitName("");
    setDraftSplitDays([EMPTY_SPLIT_DAY()]);
  };

  const openEditSplit = (split: string) => {
    const drafts = draftsFromProgram(workoutData?.days ?? [], split);
    setDraftSplitDays(drafts.length > 0 ? drafts : [EMPTY_SPLIT_DAY()]);
    setNewSplitName(split);
    setEditingSplitName(split);
    setExpandedSplitDayIdx(null);
    setIsCreatingSplit(true);
  };

  const handleSaveSplitEdits = async () => {
    if (!editingSplitName || !workoutData) return;
    setIsApplyingTemplate(true);
    try {
      const updated = applySplitDraft(
        workoutData,
        editingSplitName,
        draftSplitDays.filter((d) => d.dayTitle.trim()),
      );
      await saveWorkoutData(updated);
      try {
        await programApi.saveProgram(updated);
      } catch (err) {
        console.warn(
          "Could not sync split edits to server (will retry on next sync):",
          (err as Error).message,
        );
      }
      resetCreateSplitForm();
      alert("Saved!", `"${editingSplitName}" updated.`, [{ text: "OK" }], "success");
    } catch (error) {
      alert("Error", "Failed to save changes.", [{ text: "OK" }]);
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleCreateSplit = async (mode: "new" | "insert") => {
    if (!newSplitName.trim()) {
      alert("Missing name", "Give your split a name first.", [{ text: "OK" }]);
      return;
    }
    const days: SplitDayTemplate[] = draftSplitDays
      .filter((d) => d.dayTitle.trim())
      .map((d) => ({
        dayTitle: d.dayTitle,
        muscleGroups: Array.from(
          new Set(d.exercises.map((e) => e.muscleGroup).filter(Boolean)),
        ),
        exercises: d.exercises.map((e) => ({
          ...e,
          sets: Number(e.sets) || DEFAULT_TEMPLATE_SETS,
        })),
      }));
    if (days.length === 0) {
      alert("Add at least one day", "Give your split at least one named day.", [
        { text: "OK" },
      ]);
      return;
    }
    const template = createCustomSplitTemplate(newSplitName, days);
    await applyTemplate(template, mode, newSplitName.trim());
    resetCreateSplitForm();
  };

  const applyTemplate = async (
    template: SplitTemplate,
    mode: "new" | "insert",
    splitName?: string,
  ) => {
    setIsApplyingTemplate(true);
    try {
      if (mode === "insert" && workoutData) {
        let workoutToInsert = workoutData;
        const existingSplits = workoutData.split ?? [];
        const isNewSplit = Boolean(splitName) && !existingSplits.includes(splitName!);

        if (isNewSplit) {
          const days = (workoutData.days ?? []).map((d) => ({
            ...d,
            split: {
              ...(d.split ?? {}),
              [splitName!]: { exercises: [], totalSets: 0 },
            },
          }));
          workoutToInsert = {
            ...workoutData,
            split: [...existingSplits, splitName!],
            days,
            totalDays: days.length,
          };
        }

        const targetSplits = isNewSplit
          ? [splitName!]
          : (selectedSplit && existingSplits.includes(selectedSplit)
              ? [selectedSplit]
              : existingSplits);

        const updated = insertTemplateIntoProgram(
          workoutToInsert,
          template,
          targetSplits,
        );
        await saveWorkoutData(updated);
        if (isNewSplit) saveSelectedSplit(splitName!);
        try {
          await programApi.saveProgram(updated);
        } catch (err) {
          console.warn(
            "Could not sync inserted days to server (will retry on next sync):",
            (err as Error).message,
          );
        }
        alert(
          "Inserted!",
          `Added ${template.days.length} day(s) from "${template.name}" to your current program.`,
          [{ text: "OK" }],
          "success",
        );
      } else {
        const splitNames = splitName ? [splitName] : [selectedSplit ?? "Me"];
        const fresh = buildProgramFromTemplate(template, splitNames);
        await saveWorkoutData(fresh);
        try {
          await programApi.saveProgram(fresh);
        } catch (err) {
          console.warn(
            "Could not sync new program to server (will retry on next sync):",
            (err as Error).message,
          );
        }
        alert(
          "Split created!",
          `"${template.name}" is now your active program. Add exercises via the day editor.`,
          [{ text: "OK" }],
          "success",
        );
      }
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to apply split template",
        [{ text: "OK" }],
      );
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handlePickDefaultSplit = (template: SplitTemplate) => {
    if (!workoutData) {
      applyTemplate(template, "new");
      return;
    }
    alert(
      `Use "${template.name}"`,
      "Start a brand new program with this split, or insert its days into your current program?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Insert into current",
          onPress: () => applyTemplate(template, "insert"),
        },
        {
          text: "Start new program",
          onPress: () => applyTemplate(template, "new"),
        },
      ],
    );
  };

  const handleExportProgram = async () => {
    if (!workoutData) return;
    setIsExporting(true);
    try {
      const uri = await exportProgramData(
        workoutData as unknown as WorkoutData,
        selectedSplit,
        "downloads",
      );
      if (!uri) {
        alert("Nothing to export", "Load a program first.", [{ text: "OK" }]);
      } else {
        alert(
          "Exported",
          `Saved program JSON to: ${uri}`,
          [{ text: "OK" }],
          "success",
        );
      }
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to export program",
        [{ text: "OK" }],
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectSplit = (split: string): void => {
    saveSelectedSplit(split);
    alert(
      "Success",
      `Selected the ${split} split`,
      [{ text: "OK" }],
      "success",
    );
  };

  const getSplitWorkoutSummary = (split: string) => {
    if (!workoutData?.days) return null;
    let totalSets = 0;
    let totalDays = 0;
    workoutData.days.forEach((day: WorkoutDay) => {
      if (day.split[split]?.exercises.length > 0) {
        totalDays++;
        totalSets += day.split[split].totalSets || 0;
      }
    });
    return { totalSets, totalDays };
  };

  const toggleDayHidden = (dayIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHiddenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIdx)) next.delete(dayIdx);
      else next.add(dayIdx);
      return next;
    });
  };

  const wd = workoutData as unknown as {
    split?: string[];
    totalDays?: number;
    days?: WdDay[];
  } | null;

  const programSplits: string[] = wd?.split ?? [];
  const allOptions = ["All", ...programSplits];

  const dayTitleSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_SPLITS.flatMap((t) => t.days.map((d) => d.dayTitle)),
          ...(wd?.days ?? []).map((d) => d.dayTitle ?? ""),
        ]),
      ).filter(Boolean),
    [wd],
  );

  const renderCreateSplitWidget = (): React.ReactNode => {
    const handleInsert = () => handleCreateSplit("insert");
    const handleCreateNew = () => handleCreateSplit("new");

    return (
      <View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={openCreateSplit}
        >
          <Text style={styles.secondaryButtonText}>＋ Create New Split</Text>
        </TouchableOpacity>

        <ModalSheet
          visible={isCreatingSplit}
          onClose={resetCreateSplitForm}
          title={editingSplitName ? `Edit ${editingSplitName}` : "Create a split"}
          showCancelButton={false}
          showConfirmButton={false}
          scrollable
          fullHeight
        >
          {!editingSplitName && (
            <>
              <Text style={styles.editFieldLabel}>Split name</Text>
              <TextInput
                style={styles.editInput}
                value={newSplitName}
                onChangeText={setNewSplitName}
                placeholder='e.g. My Custom Split'
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}

          {draftSplitDays.map((day, idx) => (
            <SplitDayRow
              key={`split-day-${idx}`}
              index={idx}
              day={day}
              canRemove={draftSplitDays.length > 1}
              isExpanded={expandedSplitDayIdx === idx}
              titleSuggestions={dayTitleSuggestions}
              colors={colors}
              styles={styles}
              onToggleExpand={toggleSplitDayExpanded}
              onChangeTitle={updateDraftSplitDayTitle}
              onAddExercise={addDraftSplitExercise}
              onChangeExerciseSets={updateDraftSplitExerciseSets}
              onRemoveExercise={removeDraftSplitExercise}
              onRemove={removeDraftSplitDay}
            />
          ))}

          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={addDraftSplitDay}
          >
            <Text style={styles.addExerciseBtnText}>+ Add day</Text>
          </TouchableOpacity>

          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              disabled={isApplyingTemplate}
              onPress={resetCreateSplitForm}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            {!editingSplitName && workoutData && (
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={isApplyingTemplate}
                onPress={handleInsert}
              >
                <Text style={styles.cancelBtnText}>Insert into current</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.submitBtn, isApplyingTemplate && { opacity: 0.6 }]}
              disabled={isApplyingTemplate}
              onPress={editingSplitName ? handleSaveSplitEdits : handleCreateNew}
            >
              {isApplyingTemplate ? (
                <ActivityIndicator color={colors.textOnAccent} size='small' />
              ) : (
                <Text style={styles.submitBtnText}>
                  {editingSplitName
                    ? "Save changes"
                    : workoutData
                      ? "Start as new program"
                      : "Create split"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ModalSheet>
      </View>
    );
  };

  const renderImportWorkoutWidget = (): React.ReactNode => (
    <TouchableOpacity
      style={styles.secondaryButton}
      onPress={handleUploadFile}
      disabled={isUploading}
    >
      {isUploading ? (
        <ActivityIndicator color={colors.accent} size='small' />
      ) : (
        <Text style={styles.secondaryButtonText}>📁 Import New Workout</Text>
      )}
    </TouchableOpacity>
  );

  const renderDefaultSplitsWidget = (): React.ReactNode => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
    >
      {DEFAULT_SPLITS.map((template) => {
        const handlePress = () => handlePickDefaultSplit(template);
        return (
          <TouchableOpacity
            key={template.id}
            style={styles.templateCard}
            onPress={handlePress}
            disabled={isApplyingTemplate}
          >
            <Text style={styles.templateCardTitle}>{template.name}</Text>
            <Text style={styles.templateCardMeta}>
              {template.days.length} day
              {template.days.length === 1 ? "" : "s"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderWorkoutPlanLoadedWidget = (): React.ReactNode => {
    if (!workoutData) {
      return (
        <Text style={styles.widgetLineMuted}>
          Create a split or import a workout to see your plan summary here.
        </Text>
      );
    }
    return (
      <View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Days:</Text>
          <Text style={styles.summaryValue}>
            {workoutData?.totalDays ?? workoutData?.days?.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Splits:</Text>
          <Text style={styles.summaryValue}>
            {workoutData.split?.join(", ")}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportProgram}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color={colors.accent} size='small' />
          ) : (
            <Text style={styles.exportButtonText}>
              ⬆️ Export program &amp; split data
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderSelectSplitWidget = (): React.ReactNode => {
    if (!workoutData || !workoutData.split) {
      return (
        <Text style={styles.widgetLineMuted}>
          Create a split or import a workout to choose which one to train.
        </Text>
      );
    }
    return (
      <View>
        {workoutData.split.map((split: string) => {
          const summary = getSplitWorkoutSummary(split);
          const isSelected = selectedSplit === split;
          const handleSelect = () => handleSelectSplit(split);
          return (
            <TouchableOpacity
              key={split}
              style={[
                styles.splitCard,
                isSelected && styles.splitCardSelected,
              ]}
              onPress={handleSelect}
            >
              <View style={styles.splitCardHeader}>
                <Text
                  style={[
                    styles.splitName,
                    isSelected && styles.splitNameSelected,
                  ]}
                >
                  {split}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              {summary && (
                <View style={styles.splitStats}>
                  <Text style={styles.splitStat}>
                    {summary?.totalDays} workout days
                  </Text>
                  <Text style={styles.splitStat}> </Text>
                  <Text style={styles.splitStat}>
                    {summary.totalSets} total sets
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderViewProgramWidget = (): React.ReactNode => {
    if (!workoutData || !wd?.days || wd.days.length === 0) {
      return (
        <Text style={styles.widgetLineMuted}>
          Create a split or import a workout to see your program here.
        </Text>
      );
    }
    const visibleDays = visibleDaysForSplit(wd.days, selectedProgram);

    return (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleSelectorScroll}
          style={styles.peopleSelectorContainer}
        >
          {allOptions.map((option) => {
            const isActive =
              selectedProgram === option ||
              (option === "All" && !selectedProgram);
            const handleSelectOption = () =>
              setSelectedProgram(option === "All" ? null : option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.peoplePill, isActive && styles.peoplePillActive]}
                onPress={handleSelectOption}
              >
                <Text
                  style={[
                    styles.peoplePillText,
                    isActive && styles.peoplePillTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedProgram && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openEditSplit(selectedProgram)}
          >
            <Text style={styles.secondaryButtonText}>
              {`✎ Edit ${selectedProgram}`}
            </Text>
          </TouchableOpacity>
        )}

        {visibleDays.slice(0, visibleDayCount).map(({ day, dayIdx, displayNumber }) => (
          <ProgramDayCard
            key={day.dayNumber ?? `day-${dayIdx}`}
            day={day}
            dayIdx={dayIdx}
            displayNumber={displayNumber}
            selectedProgram={selectedProgram}
            isHidden={hiddenDays.has(dayIdx)}
            styles={styles}
            onToggleHidden={toggleDayHidden}
          />
        ))}

        {visibleDays.length > visibleDayCount && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              setVisibleDayCount((prev) => prev + INITIAL_DAYS_SHOWN)
            }
          >
            <Text style={styles.secondaryButtonText}>
              Show more days ({visibleDays.length - visibleDayCount} left)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const WIDGET_RENDERERS: Record<PlanWidgetType, () => React.ReactNode> = {
    create_split: renderCreateSplitWidget,
    import_workout: renderImportWorkoutWidget,
    default_splits: renderDefaultSplitsWidget,
    workout_plan_loaded: renderWorkoutPlanLoadedWidget,
    select_split: renderSelectSplitWidget,
    view_program: renderViewProgramWidget,
  };

  const renderWidgetContent = (
    instance: WidgetInstance<PlanWidgetType>,
  ): React.ReactNode => {
    const renderer = WIDGET_RENDERERS[instance.type];
    if (renderer) {
      const widgetTimer = startTimer();
      const content = renderer();
      perfLog("PlanScreen.widget", widgetTimer(), instance.type);
      return content;
    }
    return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  };

  perfLog(
    "PlanScreen.state",
    0,
    `contentReady=${contentReady} widgetsLoaded=${widgetsLoaded} widgets=${widgets.length} unresolved=${unresolvedMatches.length} hiddenDays=${hiddenDays.size} visibleDayCount=${visibleDayCount} showReview=${showMatchReview} isPulling=${isPulling}`,
  );

  markBodyDone();

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
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📋 Workout Plan</Text>
            <Text style={styles.subtitle}>
              Upload your workout plan and choose your split
            </Text>
          </View>

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

          {workoutData && unresolvedMatches.length === 0 && (
            <TouchableOpacity onPress={handleRecheckMatches} hitSlop={8}>
              <Text style={styles.matchBannerDismiss}>
                Re-check exercise matches
              </Text>
            </TouchableOpacity>
          )}

          {unresolvedMatches.length > 0 && !showMatchReview && (
            <View style={styles.matchBanner}>
              <TouchableOpacity onPress={() => setShowMatchReview(true)}>
                <Text style={styles.matchBannerText}>
                  Review {unresolvedMatches.length} unmatched exercise
                  {unresolvedMatches.length === 1 ? "" : "s"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setUnresolvedMatches([])}
                hitSlop={8}
              >
                <Text style={styles.matchBannerDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {contentReady ? (
            <React.Profiler id='Plan/WidgetsPanel' onRender={onRenderProfiler}>
            <WidgetsPanel
              widgets={widgets}
              isLoaded={widgetsLoaded}
              editMode={widgetEditMode}
              onCycleSize={cycleWidgetSize}
              onRemove={removeWidget}
              onReorder={reorderWidgets}
              renderContent={renderWidgetContent}
              registry={PLAN_WIDGET_REGISTRY}
            />
            </React.Profiler>
          ) : (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginTop: 20 }}
            />
          )}

          {!workoutData && (
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>
                📝 How to get started:
              </Text>
              <Text style={styles.instructionStep}>
                1. Tap "＋ Create New Split" or "📁 Import New Workout" above
              </Text>
              <Text style={styles.instructionStep}>
                2. If importing, select your .ods, .xlsx, or .xls workout file
              </Text>
              <Text style={styles.instructionStep}>3. Choose your split</Text>
              <Text style={styles.instructionStep}>
                4. Head to the Home tab to pick your day and start!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      <React.Profiler id='Plan/Alert' onRender={onRenderProfiler}>{AlertComponent}</React.Profiler>
      <React.Profiler id='Plan/SplitColumnPicker' onRender={onRenderProfiler}>
      <SplitColumnPicker
        visible={showColumnPicker}
        fileName={pendingImportName}
        candidates={columnCandidates}
        selectedIndices={selectedColumnIndices}
        onToggle={toggleColumnSelection}
        onSelectAll={selectAllColumns}
        onSelectNone={selectNoneColumns}
        onCancel={resetColumnPicker}
        onConfirm={handleConfirmColumnImport}
        isImporting={isImportingColumns}
        colors={colors}
      />
      </React.Profiler>

      <React.Profiler id='Plan/MatchReviewModal' onRender={onRenderProfiler}>
      <MatchReviewModal
        visible={showMatchReview}
        unresolved={unresolvedMatches}
        onResolve={handleResolveMatch}
        onClose={() => setShowMatchReview(false)}
      />
      </React.Profiler>

      <React.Profiler id='Plan/WidgetGallery' onRender={onRenderProfiler}>
      <WidgetGallery
        visible={showWidgetGallery}
        onClose={() => setShowWidgetGallery(false)}
        availableWidgets={availableToAdd}
        onAddWidget={handleAddWidget}
        hasPlacedWidgets={widgets.length > 0}
        onEditWidgets={handleEditWidgets}
      />
      </React.Profiler>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 10, paddingTop: 60, paddingBottom: 120 },
    header: { marginBottom: 30, alignItems: "center" },
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
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    summaryLabel: { fontSize: 16, color: colors.textSecondary },
    summaryValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    section: { marginBottom: 20 },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 4,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.accent,
    },
    templateCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 14,
      minWidth: 150,
    },
    templateCardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    templateCardMeta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    exportButton: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
    },
    exportButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    splitCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 18,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
    },
    splitCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
    },
    splitCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    splitName: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
    splitNameSelected: { color: colors.accent },
    checkmark: { fontSize: 24, color: colors.accent },
    splitStats: { flexDirection: "row", justifyContent: "flex-start" },
    splitStat: { fontSize: 14, color: colors.textSecondary },
    matchBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
    },
    matchBannerText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    matchBannerDismiss: { fontSize: 16, color: colors.textMuted },
    instructionsCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    instructionsTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    instructionStep: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 10,
      lineHeight: 24,
    },
    peopleSelectorContainer: { marginBottom: 16 },
    peopleSelectorScroll: { gap: 8, paddingVertical: 4 },
    peoplePill: {
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.separator,
      borderWidth: 2,
      borderColor: "transparent",
    },
    peoplePillActive: {
      backgroundColor: colors.infoLight,
      borderColor: colors.accent,
    },
    peoplePillText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    peoplePillTextActive: { color: colors.accent },
    programDayCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    programDayHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      gap: 8,
    },
    programDayNumber: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      backgroundColor: colors.infoLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    programDayTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
      flex: 1,
    },
    iconBtn: {
      padding: 4,
    },
    iconBtnText: {
      fontSize: 18,
    },
    chevron: {
      fontSize: 24,

      color: colors.textMuted,
      lineHeight: 24,
    },
    programExerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    programExerciseLeft: { flex: 1, marginRight: 12 },
    programExerciseName: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    programExerciseSets: { fontSize: 13, color: colors.textMuted },
    emptyDayText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: "italic",
      paddingVertical: 8,
    },
    programSetsBadge: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoLight,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 44,
    },
    programSetsBadgeText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.accent,
      lineHeight: 18,
    },
    programSetsBadgeLabel: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    programSetsRow: { flexDirection: "row", gap: 6 },

    removeExerciseBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    splitDayBlock: {
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingBottom: 10,
      marginTop: 12,
      backgroundColor: colors.background,
    },
    splitDayHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    splitDayHeaderTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    splitDayHeaderMeta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    editFieldLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
      marginTop: 8,
    },
    editInput: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 15,
      color: colors.textPrimary,
    },
    editSetInput: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 18,
      fontWeight: "700",
      color: colors.accent,
      textAlign: "center",
      width: 64,
    },
    addExerciseBtn: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderStyle: "dashed",
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
      marginBottom: 4,
    },
    addExerciseBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    editActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
      justifyContent: "flex-end",
    },
    cancelBtn: {
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 11,
      backgroundColor: colors.separator,
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    submitBtn: {
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 11,
      backgroundColor: colors.accent,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    submitBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.surface,
    },
  });
