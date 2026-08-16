import React, { useState, useEffect, useMemo } from "react";
import * as Device from "expo-device";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import {
  findSimilarNames,
  findExactMatch,
  getAllMuscleGroups,
} from "@utils/exerciseMatching";
import { toSuggestions } from "@utils/exerciseDb";
import type { ExerciseSuggestion } from "@utils/exerciseDb";
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
  RootStackParamList,
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
import { sinceBoot } from "@shared/services/debugClock";
import logger from "@shared/services/logger";
import type { ExerciseDraft, DayDraft, WdDay } from "./types";
import { SplitDayRow } from "./components/SplitDayRow";
import { ProgramDayCard } from "./components/ProgramDayCard";
import {
  allDayIndices,
  getDayExerciseList,
} from "./components/programDayHelpers";

export type Styles = ReturnType<typeof makeStyles>;

// Rendering every day card at once is what makes Plan feel slow to load for
// large imported programs — each card is a full nested tree (exercises,
// sets-by-person badges). Showing a bounded slice up front keeps first paint
// fast; "Show more" reveals the rest on demand.
const INITIAL_DAYS_SHOWN = 10;

const EMPTY_EXERCISE = (splits: string[]): ExerciseDraft => ({
  name: "",
  muscleGroup: "",
  setsByPerson: Object.fromEntries(splits.map((split) => [split, "0"])),
});

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PlanScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Plan">;
};
export default function PlanScreen({
  navigation,
}: PlanScreenProps): React.JSX.Element {
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
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showWidgetGallery, setShowWidgetGallery] = useState<boolean>(false);
  const [widgetEditMode, setWidgetEditMode] = useState<boolean>(false);
  const isEmulator = !Device.isDevice;

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
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null);
  const [dayDraft, setDayDraft] = useState<DayDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [nameSuggestions, setNameSuggestions] = useState<
    Record<number, ExerciseSuggestion[]>
  >({});
  const [mgSuggestions, setMgSuggestions] = useState<Record<number, string[]>>(
    {},
  );
  const [focusedNameIdx, setFocusedNameIdx] = useState<number | null>(null);
  const [focusedMgIdx, setFocusedMgIdx] = useState<number | null>(null);

  const [isCreatingSplit, setIsCreatingSplit] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [draftSplitDays, setDraftSplitDays] = useState<
    { dayTitle: string; muscleGroups: string }[]
  >([{ dayTitle: "", muscleGroups: "" }]);
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

  useEffect(() => {
    const days = (workoutData as unknown as { days?: unknown[] })?.days;
    setSelectedProgram(null);
    setHiddenDays(allDayIndices(workoutData));
    setEditingDayIdx(null);
    setDayDraft(null);
    setIsCreatingSplit(false);
    setVisibleDayCount(INITIAL_DAYS_SHOWN);
  }, [workoutData]);

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
      await saveWorkoutData(data);
      try {
        await programApi.saveProgram(data);
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

  const addDraftSplitDay = () => {
    setDraftSplitDays((prev) => [...prev, { dayTitle: "", muscleGroups: "" }]);
  };

  const removeDraftSplitDay = (idx: number) => {
    setDraftSplitDays((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDraftSplitDay = (
    idx: number,
    field: "dayTitle" | "muscleGroups",
    value: string,
  ) => {
    setDraftSplitDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const resetCreateSplitForm = () => {
    setIsCreatingSplit(false);
    setNewSplitName("");
    setDraftSplitDays([{ dayTitle: "", muscleGroups: "" }]);
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
        muscleGroups: d.muscleGroups
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
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
    personName?: string,
  ) => {
    setIsApplyingTemplate(true);
    try {
      if (mode === "insert" && workoutData) {
        let workoutToInsert = workoutData;
        if (personName && !workoutToInsert.split?.includes(personName)) {
          const splitWithNew = [...(workoutToInsert.split ?? []), personName];
          const existingDays = workoutToInsert.days ?? [];
          const updatedExistingDays = existingDays.map((d) => ({
            ...d,
            split: {
              ...(d.split ?? {}),
              [personName]: { exercises: [], totalSets: 0 },
            },
          }));
          workoutToInsert = {
            ...workoutToInsert,
            split: splitWithNew,
            days: updatedExistingDays,
            totalDays: updatedExistingDays.length,
          };
        }

        const updated = insertTemplateIntoProgram(workoutToInsert, template);
        await saveWorkoutData(updated);
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
        const splitNames = personName ? [personName] : [selectedSplit ?? "Me"];
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

  const startEditing = (dayIdx: number) => {
    const day = wd?.days?.[dayIdx];
    if (!day) return;
    const exercises: ExerciseDraft[] = (day.exercises ?? []).map((ex) => ({
      name: ex.name ?? "",
      muscleGroup: ex.muscleGroup ?? "",
      setsByPerson: Object.fromEntries(
        Object.entries(ex.setsByPerson ?? {}).map(([p, v]) => [p, String(v)]),
      ),
    }));
    setDayDraft({ exercises });
    setEditingDayIdx(dayIdx);
    setNameSuggestions({});
    setMgSuggestions({});
    setFocusedNameIdx(null);
    setFocusedMgIdx(null);
  };

  const cancelEditing = () => {
    setEditingDayIdx(null);
    setDayDraft(null);
    setNameSuggestions({});
    setMgSuggestions({});
  };

  const updateDraftExercise = (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
  ) => {
    if (!dayDraft) return;
    const updated = [...dayDraft.exercises];
    updated[exIdx] = { ...updated[exIdx], [field]: value };
    if (field === "name") updated[exIdx].exerciseId = undefined;
    setDayDraft({ exercises: updated });

    if (field === "name") {
      const matches = value.trim().length < 2 ? [] : toSuggestions(value, 5);
      setNameSuggestions((prev) => ({ ...prev, [exIdx]: matches }));
    }

    if (field === "muscleGroup") {
      const allMg = getAllMuscleGroups(workoutData, selectedSplit);
      const exact = findExactMatch(value, allMg);
      if (exact || value.trim().length < 2) {
        setMgSuggestions((prev) => ({ ...prev, [exIdx]: [] }));
      } else {
        const matches = findSimilarNames(value, allMg, 0.4, 5).map(
          (m) => m.name,
        );
        setMgSuggestions((prev) => ({ ...prev, [exIdx]: matches }));
      }
    }
  };

  const updateDraftSets = (exIdx: number, person: string, value: string) => {
    if (!dayDraft) return;
    const updated = [...dayDraft.exercises];
    updated[exIdx] = {
      ...updated[exIdx],
      setsByPerson: { ...updated[exIdx].setsByPerson, [person]: value },
    };
    setDayDraft({ exercises: updated });
  };

  const addExercise = () => {
    if (!dayDraft) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDayDraft({
      exercises: [...dayDraft.exercises, EMPTY_EXERCISE(programSplits)],
    });
  };

  const removeExercise = (exIdx: number) => {
    if (!dayDraft) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const updated = dayDraft.exercises.filter((_, i) => i !== exIdx);
    setDayDraft({ exercises: updated });
    setNameSuggestions((prev) => {
      const next = { ...prev };
      delete next[exIdx];
      return next;
    });
    setMgSuggestions((prev) => {
      const next = { ...prev };
      delete next[exIdx];
      return next;
    });
  };

  const applySuggestion = (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
    exerciseId?: string,
  ) => {
    if (!dayDraft) return;
    const updated = [...dayDraft.exercises];
    updated[exIdx] = { ...updated[exIdx], [field]: value };
    if (field === "name") updated[exIdx].exerciseId = exerciseId;
    setDayDraft({ exercises: updated });
    if (field === "name") {
      setNameSuggestions((prev) => ({ ...prev, [exIdx]: [] }));
      setFocusedNameIdx(null);
    } else {
      setMgSuggestions((prev) => ({ ...prev, [exIdx]: [] }));
      setFocusedMgIdx(null);
    }
  };

  const handleFocusName = (exIdx: number) => setFocusedNameIdx(exIdx);
  const handleBlurName = () => setTimeout(() => setFocusedNameIdx(null), 150);
  const handleFocusMg = (exIdx: number) => setFocusedMgIdx(exIdx);
  const handleBlurMg = () => setTimeout(() => setFocusedMgIdx(null), 150);

  const handleSubmitEdits = async () => {
    if (editingDayIdx === null || !dayDraft || !workoutData) return;
    setIsSubmitting(true);
    try {
      const realDays = (
        workoutData as unknown as {
          days?: Array<{
            split: Record<
              string,
              {
                exercises: Array<{
                  name: string;
                  muscleGroup?: string;
                  sets: number;
                }>;
                totalSets?: number;
              }
            >;
          }>;
        }
      )?.days;

      const updatedDays = (realDays ?? []).map((day, idx) => {
        if (idx !== editingDayIdx) return day;

        const updatedSplit = { ...day.split };

        Object.keys(updatedSplit).forEach((person) => {
          const exercisesForPerson = dayDraft.exercises
            .filter((draft) => {
              const raw = draft.setsByPerson[person];
              return raw !== undefined && (Number.parseInt(raw, 10) || 0) > 0;
            })
            .map((draft) => ({
              name: draft.name,
              muscleGroup: draft.muscleGroup,
              sets: Number.parseInt(draft.setsByPerson[person], 10) || 0,
            }));

          const totalSets = exercisesForPerson.reduce(
            (sum, ex) => sum + ex.sets,
            0,
          );

          updatedSplit[person] = {
            ...updatedSplit[person],
            exercises: exercisesForPerson,
            totalSets,
          };
        });

        return { ...day, split: updatedSplit };
      });

      const updatedData = {
        ...workoutData,
        days: updatedDays,
      } as unknown as WorkoutData;

      await saveWorkoutData(updatedData);
      alert(
        "Saved!",
        "Your changes have been saved.",
        [{ text: "OK" }],
        "success",
      );
      setEditingDayIdx(null);
      setDayDraft(null);
      setNameSuggestions({});
      setMgSuggestions({});
    } catch (error) {
      alert("Error", "Failed to save changes.", [{ text: "OK" }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const wd = workoutData as unknown as {
    split?: string[];
    totalDays?: number;
    days?: WdDay[];
  } | null;

  const programSplits: string[] = wd?.split ?? [];
  const allOptions = ["All", ...programSplits];

  const renderCreateSplitWidget = (): React.ReactNode => {
    const handleToggleCreating = () =>
      isCreatingSplit ? resetCreateSplitForm() : setIsCreatingSplit(true);
    const handleInsert = () => handleCreateSplit("insert");
    const handleCreateNew = () => handleCreateSplit("new");

    return (
      <View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleToggleCreating}
        >
          <Text style={styles.secondaryButtonText}>
            {isCreatingSplit ? "✕ Cancel" : "＋ Create New Split"}
          </Text>
        </TouchableOpacity>

        {isCreatingSplit && (
          <View style={styles.editExerciseBlock}>
            <Text style={styles.editFieldLabel}>Split name</Text>
            <TextInput
              style={styles.editInput}
              value={newSplitName}
              onChangeText={setNewSplitName}
              placeholder='e.g. My Custom Split'
              placeholderTextColor={colors.textMuted}
            />

            {draftSplitDays.map((day, idx) => (
              <SplitDayRow
                key={day.dayTitle || `day-${idx}`}
                index={idx}
                day={day}
                canRemove={draftSplitDays.length > 1}
                colors={colors}
                styles={styles}
                onChangeField={updateDraftSplitDay}
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
              {workoutData && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={isApplyingTemplate}
                  onPress={handleInsert}
                >
                  <Text style={styles.cancelBtnText}>Insert into current</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  isApplyingTemplate && { opacity: 0.6 },
                ]}
                disabled={isApplyingTemplate}
                onPress={handleCreateNew}
              >
                {isApplyingTemplate ? (
                  <ActivityIndicator color='#fff' size='small' />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {workoutData ? "Start as new program" : "Create split"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    const handleUnhideAll = () => setHiddenDays(new Set());
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
                styles.personCard,
                isSelected && styles.personCardSelected,
              ]}
              onPress={handleSelect}
            >
              <View style={styles.personCardHeader}>
                <Text
                  style={[
                    styles.personName,
                    isSelected && styles.personNameSelected,
                  ]}
                >
                  {split}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              {summary && (
                <View style={styles.personStats}>
                  <Text style={styles.personStat}>
                    {summary?.totalDays} workout days
                  </Text>
                  <Text style={styles.personStat}> </Text>
                  <Text style={styles.personStat}>
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
    const visibleDays = wd.days
      .map((day, dayIdx) => ({ day, dayIdx }))
      .filter(({ day }) => {
        const exerciseCount = day.exercises?.length ?? 0;
        const visibleCount = getDayExerciseList(day, selectedProgram).length;
        return !(selectedProgram && exerciseCount > 0 && visibleCount === 0);
      });

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

        {visibleDays.slice(0, visibleDayCount).map(({ day, dayIdx }) => (
          <ProgramDayCard
            key={day.dayNumber ?? `day-${dayIdx}`}
            day={day}
            dayIdx={dayIdx}
            selectedProgram={selectedProgram}
            isHidden={hiddenDays.has(dayIdx)}
            isEditing={editingDayIdx === dayIdx}
            canStartEditing={editingDayIdx === null}
            dayDraft={dayDraft}
            colors={colors}
            styles={styles}
            nameSuggestions={nameSuggestions}
            mgSuggestions={mgSuggestions}
            focusedNameIdx={focusedNameIdx}
            focusedMgIdx={focusedMgIdx}
            isSubmitting={isSubmitting}
            onStartEditing={startEditing}
            onToggleHidden={toggleDayHidden}
            onChangeField={updateDraftExercise}
            onFocusName={handleFocusName}
            onBlurName={handleBlurName}
            onFocusMg={handleFocusMg}
            onBlurMg={handleBlurMg}
            onApplySuggestion={applySuggestion}
            onRemoveExercise={removeExercise}
            onChangeSets={updateDraftSets}
            onAddExercise={addExercise}
            onCancelEditing={cancelEditing}
            onSubmitEdits={handleSubmitEdits}
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
    return renderer ? (
      renderer()
    ) : (
      <Text style={styles.widgetLineMuted}>Coming soon</Text>
    );
  };

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
      {isEmulator && (
        <TouchableOpacity
          style={styles.emulatorWidgetButton}
          onPress={() => setShowWidgetGallery(true)}
        >
          <Text style={styles.emulatorWidgetButtonText}>+ Widget</Text>
        </TouchableOpacity>
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

          {contentReady ? (
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
      {AlertComponent}
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
    emulatorWidgetButton: {
      position: "absolute",
      top: 8,
      right: 12,
      zIndex: 10,
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    emulatorWidgetButtonText: {
      color: colors.surface,
      fontSize: 13,
      fontWeight: "600",
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
    personCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 18,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
    },
    personCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
    },
    personCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    personName: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
    personNameSelected: { color: colors.accent },
    checkmark: { fontSize: 24, color: colors.accent },
    personStats: { flexDirection: "row", justifyContent: "flex-start" },
    personStat: { fontSize: 14, color: colors.textSecondary },
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

    editModeLabel: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    editExerciseBlock: {
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.background,
    },
    removeExerciseBtn: {
      alignSelf: "flex-end",
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    removeExerciseBtnText: {
      fontSize: 12,
      fontWeight: "600",
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
    editSetsRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 2,
    },
    editSetItem: {
      alignItems: "center",
      minWidth: 64,
    },
    editSetPersonLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
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
