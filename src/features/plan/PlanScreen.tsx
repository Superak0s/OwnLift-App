import React, { useState, useEffect } from "react"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useWorkout } from "@shared/context/WorkoutContext"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import { useAlert } from "@shared/components/CustomAlert"
import {
  findSimilarNames,
  findExactMatch,
  getAllExerciseNames,
  getAllMuscleGroups,
} from "@utils/exerciseMatching"
import { workoutApi } from "@features/workout/services/index"
import { programApi } from "@features/plan/services/index"
import type { WorkoutData, RootStackParamList, WorkoutDay } from "@shared/types"
import {
  DEFAULT_SPLITS,
  createCustomSplitTemplate,
  buildProgramFromTemplate,
  insertTemplateIntoProgram,
  type SplitTemplate,
  type SplitDayTemplate,
} from "@features/plan/utils/splitTemplates"
import { exportProgramData } from "@features/plan/utils/exportProgram"
import {
  extractSplitColumnCandidates,
  parseWorkoutFileClient,
  type SplitColumnCandidate,
} from "@utils/clientWorkoutParser"
import SplitColumnPicker from "./utils/SplitColumnPicker"

interface ExerciseDraft {
  name: string
  muscleGroup: string
  setsByPerson: Record<string, string>
}

interface DayDraft {
  exercises: ExerciseDraft[]
}

const EMPTY_EXERCISE = (splits: string[]): ExerciseDraft => ({
  name: "",
  muscleGroup: "",
  setsByPerson: Object.fromEntries(splits.map((split) => [split, "0"])),
})

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type PlanScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Plan">
}
export default function PlanScreen({
  navigation,
}: PlanScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { workoutData, selectedSplit, saveWorkoutData, saveSelectedSplit } =
    useWorkout()
  const { alert, AlertComponent } = useAlert()
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)

  const [hiddenDays, setHiddenDays] = useState<Set<number>>(new Set())
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null)
  const [dayDraft, setDayDraft] = useState<DayDraft | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [nameSuggestions, setNameSuggestions] = useState<
    Record<number, string[]>
  >({})
  const [mgSuggestions, setMgSuggestions] = useState<Record<number, string[]>>(
    {},
  )
  const [focusedNameIdx, setFocusedNameIdx] = useState<number | null>(null)
  const [focusedMgIdx, setFocusedMgIdx] = useState<number | null>(null)

  const [isCreatingSplit, setIsCreatingSplit] = useState(false)
  const [newSplitName, setNewSplitName] = useState("")
  const [draftSplitDays, setDraftSplitDays] = useState<
    { dayTitle: string; muscleGroups: string }[]
  >([{ dayTitle: "", muscleGroups: "" }])
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null)
  const [pendingImportName, setPendingImportName] = useState<string | null>(
    null,
  )
  const [columnCandidates, setColumnCandidates] = useState<
    SplitColumnCandidate[]
  >([])
  const [selectedColumnIndices, setSelectedColumnIndices] = useState<
    Set<number>
  >(new Set())
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [isImportingColumns, setIsImportingColumns] = useState(false)

  useEffect(() => {
    const restoreProgram = async () => {
      if (workoutData) return
      try {
        const saved = await programApi.fetchSavedProgram()
        if (saved && (saved as unknown as { success?: boolean }).success) {
          await saveWorkoutData(saved as unknown as WorkoutData)
        }
      } catch (error) {
        if ((error as Error)?.message === "SESSION_EXPIRED") {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] })
        }
      }
    }
    restoreProgram()
  }, [])

  useEffect(() => {
    setSelectedProgram(null)
    setHiddenDays(new Set())
    setEditingDayIdx(null)
    setDayDraft(null)
    setIsCreatingSplit(false)
  }, [workoutData])

  const handleUploadFile = async (): Promise<void> => {
    try {
      setIsUploading(true)
      const fileUri = await workoutApi.pickWorkoutFile()
      if (!fileUri) {
        setIsUploading(false)
        return
      }

      const candidates = await extractSplitColumnCandidates(fileUri)
      if (candidates.length === 0) {
        alert(
          "No columns found",
          'We couldn\'t find any column headers to choose from in this file. Double-check it has a "Day" row followed by a header row.',
          [{ text: "OK" }],
        )
        setIsUploading(false)
        return
      }

      const fileName = fileUri.split("/").pop() ?? null
      setPendingImportUri(fileUri)
      setPendingImportName(fileName)
      setColumnCandidates(candidates)
      setSelectedColumnIndices(
        new Set(candidates.filter((c) => c.autoSelected).map((c) => c.index)),
      )
      setShowColumnPicker(true)
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to read workout file",
        [{ text: "OK" }],
      )
    } finally {
      setIsUploading(false)
    }
  }

  const toggleColumnSelection = (index: number) => {
    setSelectedColumnIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectAllColumns = () => {
    setSelectedColumnIndices(new Set(columnCandidates.map((c) => c.index)))
  }

  const selectNoneColumns = () => {
    setSelectedColumnIndices(new Set())
  }

  const resetColumnPicker = () => {
    setShowColumnPicker(false)
    setPendingImportUri(null)
    setPendingImportName(null)
    setColumnCandidates([])
    setSelectedColumnIndices(new Set())
  }

  const handleConfirmColumnImport = async (): Promise<void> => {
    if (!pendingImportUri || selectedColumnIndices.size === 0) return
    setIsImportingColumns(true)
    try {
      const data = await parseWorkoutFileClient(
        pendingImportUri,
        Array.from(selectedColumnIndices),
      )
      await saveWorkoutData(data)
      try {
        await programApi.saveProgram(data)
      } catch (err) {
        console.warn(
          "Could not sync imported program to server (will retry on next sync):",
          (err as Error).message,
        )
      }
      alert(
        "Success!",
        `Loaded ${data?.totalDays ?? data?.days?.length ?? 0} workout days for ${data.split?.join(", ") ?? ""}`,
        [{ text: "OK" }],
        "success",
      )
      resetColumnPicker()
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to import workout file",
        [{ text: "OK" }],
      )
    } finally {
      setIsImportingColumns(false)
    }
  }

  const addDraftSplitDay = () => {
    setDraftSplitDays((prev) => [...prev, { dayTitle: "", muscleGroups: "" }])
  }

  const removeDraftSplitDay = (idx: number) => {
    setDraftSplitDays((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateDraftSplitDay = (
    idx: number,
    field: "dayTitle" | "muscleGroups",
    value: string,
  ) => {
    setDraftSplitDays((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const resetCreateSplitForm = () => {
    setIsCreatingSplit(false)
    setNewSplitName("")
    setDraftSplitDays([{ dayTitle: "", muscleGroups: "" }])
  }

  const handleCreateSplit = async (mode: "new" | "insert") => {
    if (!newSplitName.trim()) {
      alert("Missing name", "Give your split a name first.", [{ text: "OK" }])
      return
    }
    const days: SplitDayTemplate[] = draftSplitDays
      .filter((d) => d.dayTitle.trim())
      .map((d) => ({
        dayTitle: d.dayTitle,
        muscleGroups: d.muscleGroups
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      }))
    if (days.length === 0) {
      alert("Add at least one day", "Give your split at least one named day.", [
        { text: "OK" },
      ])
      return
    }
    const template = createCustomSplitTemplate(newSplitName, days)
    await applyTemplate(template, mode, newSplitName.trim())
    resetCreateSplitForm()
  }

  const applyTemplate = async (
    template: SplitTemplate,
    mode: "new" | "insert",
    personName?: string,
  ) => {
    setIsApplyingTemplate(true)
    try {
      if (mode === "insert" && workoutData) {
        let workoutToInsert = workoutData as unknown as WorkoutData
        if (personName && !workoutToInsert.split?.includes(personName)) {
          const splitWithNew = [...(workoutToInsert.split ?? []), personName]
          const existingDays = workoutToInsert.days ?? []
          const updatedExistingDays = existingDays.map((d) => ({
            ...d,
            split: {
              ...(d.split ?? {}),
              [personName]: { exercises: [], totalSets: 0 },
            },
          }))
          workoutToInsert = {
            ...workoutToInsert,
            split: splitWithNew,
            days: updatedExistingDays,
            totalDays: updatedExistingDays.length,
          }
        }

        const updated = insertTemplateIntoProgram(workoutToInsert, template)
        await saveWorkoutData(updated)
        try {
          await programApi.saveProgram(updated)
        } catch (err) {
          console.warn(
            "Could not sync inserted days to server (will retry on next sync):",
            (err as Error).message,
          )
        }
        alert(
          "Inserted!",
          `Added ${template.days.length} day(s) from "${template.name}" to your current program.`,
          [{ text: "OK" }],
          "success",
        )
      } else {
        const splitNames = personName ? [personName] : [selectedSplit ?? "Me"]
        const fresh = buildProgramFromTemplate(template, splitNames)
        await saveWorkoutData(fresh)
        try {
          await programApi.saveProgram(fresh)
        } catch (err) {
          console.warn(
            "Could not sync new program to server (will retry on next sync):",
            (err as Error).message,
          )
        }
        alert(
          "Split created!",
          `"${template.name}" is now your active program. Add exercises via the day editor.`,
          [{ text: "OK" }],
          "success",
        )
      }
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to apply split template",
        [{ text: "OK" }],
      )
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  const handlePickDefaultSplit = (template: SplitTemplate) => {
    if (!workoutData) {
      applyTemplate(template, "new")
      return
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
    )
  }

  const handleExportProgram = async () => {
    if (!workoutData) return
    setIsExporting(true)
    try {
      const uri = await exportProgramData(
        workoutData as unknown as WorkoutData,
        selectedSplit,
        "downloads",
      )
      if (!uri) {
        alert("Nothing to export", "Load a program first.", [{ text: "OK" }])
      } else {
        alert(
          "Exported",
          `Saved program JSON to: ${uri}`,
          [{ text: "OK" }],
          "success",
        )
      }
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to export program",
        [{ text: "OK" }],
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleSelectSplit = (split: string): void => {
    saveSelectedSplit(split)
    alert("Success", `Selected the ${split} split`, [{ text: "OK" }], "success")
  }

  const getSplitWorkoutSummary = (split: string) => {
    if (!workoutData?.days) return null
    let totalSets = 0
    let totalDays = 0
    workoutData.days.forEach((day: WorkoutDay) => {
      if (day.split[split]?.exercises.length > 0) {
        totalDays++
        totalSets += day.split[split].totalSets || 0
      }
    })
    return { totalSets, totalDays }
  }

  const toggleDayHidden = (dayIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setHiddenDays((prev) => {
      const next = new Set(prev)
      if (next.has(dayIdx)) next.delete(dayIdx)
      else next.add(dayIdx)
      return next
    })
  }

  const startEditing = (dayIdx: number) => {
    const day = wd?.days?.[dayIdx]
    if (!day) return
    const exercises: ExerciseDraft[] = (day.exercises ?? []).map((ex) => ({
      name: ex.name ?? "",
      muscleGroup: ex.muscleGroup ?? "",
      setsByPerson: Object.fromEntries(
        Object.entries(ex.setsByPerson ?? {}).map(([p, v]) => [p, String(v)]),
      ),
    }))
    setDayDraft({ exercises })
    setEditingDayIdx(dayIdx)
    setNameSuggestions({})
    setMgSuggestions({})
    setFocusedNameIdx(null)
    setFocusedMgIdx(null)
  }

  const cancelEditing = () => {
    setEditingDayIdx(null)
    setDayDraft(null)
    setNameSuggestions({})
    setMgSuggestions({})
  }

  const updateDraftExercise = (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
  ) => {
    if (!dayDraft) return
    const updated = [...dayDraft.exercises]
    updated[exIdx] = { ...updated[exIdx], [field]: value }
    setDayDraft({ exercises: updated })

    if (field === "name") {
      const allNames = getAllExerciseNames(workoutData, selectedSplit)
      const exact = findExactMatch(value, allNames)
      if (exact || value.trim().length < 2) {
        setNameSuggestions((prev) => ({ ...prev, [exIdx]: [] }))
      } else {
        const matches = findSimilarNames(value, allNames, 0.5, 5).map(
          (m) => m.name,
        )
        setNameSuggestions((prev) => ({ ...prev, [exIdx]: matches }))
      }
    }

    if (field === "muscleGroup") {
      const allMg = getAllMuscleGroups(workoutData, selectedSplit)
      const exact = findExactMatch(value, allMg)
      if (exact || value.trim().length < 2) {
        setMgSuggestions((prev) => ({ ...prev, [exIdx]: [] }))
      } else {
        const matches = findSimilarNames(value, allMg, 0.4, 5).map(
          (m) => m.name,
        )
        setMgSuggestions((prev) => ({ ...prev, [exIdx]: matches }))
      }
    }
  }

  const updateDraftSets = (exIdx: number, person: string, value: string) => {
    if (!dayDraft) return
    const updated = [...dayDraft.exercises]
    updated[exIdx] = {
      ...updated[exIdx],
      setsByPerson: { ...updated[exIdx].setsByPerson, [person]: value },
    }
    setDayDraft({ exercises: updated })
  }

  const addExercise = () => {
    if (!dayDraft) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setDayDraft({
      exercises: [...dayDraft.exercises, EMPTY_EXERCISE(programSplits)],
    })
  }

  const removeExercise = (exIdx: number) => {
    if (!dayDraft) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const updated = dayDraft.exercises.filter((_, i) => i !== exIdx)
    setDayDraft({ exercises: updated })
    setNameSuggestions((prev) => {
      const next = { ...prev }
      delete next[exIdx]
      return next
    })
    setMgSuggestions((prev) => {
      const next = { ...prev }
      delete next[exIdx]
      return next
    })
  }

  const applySuggestion = (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
  ) => {
    if (!dayDraft) return
    const updated = [...dayDraft.exercises]
    updated[exIdx] = { ...updated[exIdx], [field]: value }
    setDayDraft({ exercises: updated })
    if (field === "name") {
      setNameSuggestions((prev) => ({ ...prev, [exIdx]: [] }))
      setFocusedNameIdx(null)
    } else {
      setMgSuggestions((prev) => ({ ...prev, [exIdx]: [] }))
      setFocusedMgIdx(null)
    }
  }

  const handleSubmitEdits = async () => {
    if (editingDayIdx === null || !dayDraft || !workoutData) return
    setIsSubmitting(true)
    try {
      const realDays = (
        workoutData as unknown as {
          days?: Array<{
            split: Record<
              string,
              {
                exercises: Array<{
                  name: string
                  muscleGroup?: string
                  sets: number
                }>
                totalSets?: number
              }
            >
          }>
        }
      )?.days

      const updatedDays = (realDays ?? []).map((day, idx) => {
        if (idx !== editingDayIdx) return day

        const updatedSplit = { ...day.split }

        Object.keys(updatedSplit).forEach((person) => {
          const exercisesForPerson = dayDraft.exercises
            .filter((draft) => {
              const raw = draft.setsByPerson[person]
              return raw !== undefined && (parseInt(raw, 10) || 0) > 0
            })
            .map((draft) => ({
              name: draft.name,
              muscleGroup: draft.muscleGroup,
              sets: parseInt(draft.setsByPerson[person], 10) || 0,
            }))

          const totalSets = exercisesForPerson.reduce(
            (sum, ex) => sum + ex.sets,
            0,
          )

          updatedSplit[person] = {
            ...updatedSplit[person],
            exercises: exercisesForPerson,
            totalSets,
          }
        })

        return { ...day, split: updatedSplit }
      })

      const updatedData = {
        ...workoutData,
        days: updatedDays,
      } as unknown as WorkoutData

      await saveWorkoutData(updatedData)
      alert(
        "Saved!",
        "Your changes have been saved.",
        [{ text: "OK" }],
        "success",
      )
      setEditingDayIdx(null)
      setDayDraft(null)
      setNameSuggestions({})
      setMgSuggestions({})
    } catch (error) {
      alert("Error", "Failed to save changes.", [{ text: "OK" }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const wd = workoutData as unknown as {
    split?: string[]
    totalDays?: number
    days?: Array<{
      dayNumber?: number
      dayTitle?: string
      exercises?: Array<{
        name?: string
        muscleGroup?: string
        setsByPerson?: Record<string, number>
      }>
    }>
  } | null

  const programSplits: string[] = wd?.split ?? []
  const allOptions = ["All", ...programSplits]

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps='handled'>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📋 Workout Plan</Text>
            <Text style={styles.subtitle}>
              Upload your workout plan and choose your split
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits</Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                isCreatingSplit
                  ? resetCreateSplitForm()
                  : setIsCreatingSplit(true)
              }
            >
              <Text style={styles.secondaryButtonText}>
                {isCreatingSplit ? "✕ Cancel" : "＋ Create New Split"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={handleUploadFile}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={colors.accent} size='small' />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  📁 Import New Workout
                </Text>
              )}
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
                  <View key={idx} style={{ marginTop: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={styles.editFieldLabel}>
                        Day {idx + 1} title
                      </Text>
                      {draftSplitDays.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeDraftSplitDay(idx)}
                        >
                          <Text style={styles.removeExerciseBtnText}>
                            − Remove day
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.editInput}
                      value={day.dayTitle}
                      onChangeText={(v) =>
                        updateDraftSplitDay(idx, "dayTitle", v)
                      }
                      placeholder='e.g. Push Day'
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.editFieldLabel}>
                      Muscle groups (comma separated)
                    </Text>
                    <TextInput
                      style={styles.editInput}
                      value={day.muscleGroups}
                      onChangeText={(v) =>
                        updateDraftSplitDay(idx, "muscleGroups", v)
                      }
                      placeholder='Chest, Shoulders, Triceps'
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
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
                      onPress={() => handleCreateSplit("insert")}
                    >
                      <Text style={styles.cancelBtnText}>
                        Insert into current
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      isApplyingTemplate && { opacity: 0.6 },
                    ]}
                    disabled={isApplyingTemplate}
                    onPress={() => handleCreateSplit("new")}
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

            <Text style={[styles.editFieldLabel, { marginTop: 16 }]}>
              Or start from a default split
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
            >
              {DEFAULT_SPLITS.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handlePickDefaultSplit(template)}
                  disabled={isApplyingTemplate}
                >
                  <Text style={styles.templateCardTitle}>{template.name}</Text>
                  <Text style={styles.templateCardMeta}>
                    {template.days.length} day
                    {template.days.length === 1 ? "" : "s"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {workoutData && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📊 Workout Plan Loaded</Text>
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
              {hiddenDays.size > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Hidden days:</Text>
                  <TouchableOpacity onPress={() => setHiddenDays(new Set())}>
                    <Text
                      style={[styles.summaryValue, { color: colors.accent }]}
                    >
                      {hiddenDays.size} — Unhide all
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
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
          )}

          {workoutData && workoutData.split && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Split</Text>
              {workoutData.split.map((split: string) => {
                const summary = getSplitWorkoutSummary(split)
                const isSelected = selectedSplit === split
                return (
                  <TouchableOpacity
                    key={split}
                    style={[
                      styles.personCard,
                      isSelected && styles.personCardSelected,
                    ]}
                    onPress={() => handleSelectSplit(split)}
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
                )
              })}
            </View>
          )}

          {workoutData && wd?.days && wd.days.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 View Program</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peopleSelectorScroll}
                style={styles.peopleSelectorContainer}
              >
                {allOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.peoplePill,
                      (selectedProgram === option ||
                        (option === "All" && !selectedProgram)) &&
                        styles.peoplePillActive,
                    ]}
                    onPress={() =>
                      setSelectedProgram(option === "All" ? null : option)
                    }
                  >
                    <Text
                      style={[
                        styles.peoplePillText,
                        (selectedProgram === option ||
                          (option === "All" && !selectedProgram)) &&
                          styles.peoplePillTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {wd.days.map((day, dayIdx) => {
                const exercises = Array.isArray(day.exercises)
                  ? day.exercises.filter(
                      (ex) =>
                        !selectedProgram ||
                        (ex.setsByPerson?.[selectedProgram] ?? 0) > 0,
                    )
                  : []

                if (
                  selectedProgram &&
                  Array.isArray(day.exercises) &&
                  day.exercises.length > 0 &&
                  exercises.length === 0
                ) {
                  return null
                }

                const isHidden = hiddenDays.has(dayIdx)
                const isEditing = editingDayIdx === dayIdx

                const dayLabel = `Day ${day.dayNumber ?? dayIdx + 1}`
                const dayTitle = day.dayTitle
                  ? day.dayTitle.includes("—")
                    ? day.dayTitle.split("—")[1].trim()
                    : day.dayTitle
                  : ""

                return (
                  <View key={dayIdx} style={styles.programDayCard}>
                    <View style={styles.programDayHeader}>
                      <Text style={styles.programDayNumber}>{dayLabel}</Text>
                      <Text style={styles.programDayTitle} numberOfLines={2}>
                        {dayTitle}
                      </Text>

                      {!isHidden && editingDayIdx === null && (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => startEditing(dayIdx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.iconBtnText}>✏️</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => toggleDayHidden(dayIdx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.chevron}>
                          {isHidden ? "›" : "‹"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {!isHidden && !isEditing && exercises.length === 0 && (
                      <Text style={styles.emptyDayText}>
                        No exercises yet — tap ✏️ to add some.
                      </Text>
                    )}
                    {!isHidden &&
                      !isEditing &&
                      exercises.map((exercise, exIdx) => {
                        const setsByPerson = exercise.setsByPerson ?? {}
                        const personEntries: Array<[string, number]> =
                          selectedProgram
                            ? [
                                [
                                  selectedProgram,
                                  setsByPerson[selectedProgram] ?? 0,
                                ],
                              ]
                            : Object.entries(setsByPerson)
                        return (
                          <View key={exIdx} style={styles.programExerciseRow}>
                            <View style={styles.programExerciseLeft}>
                              <Text style={styles.programExerciseName}>
                                {exercise.name ?? `Exercise ${exIdx + 1}`}
                              </Text>
                              {exercise.muscleGroup ? (
                                <Text style={styles.programExerciseSets}>
                                  {exercise.muscleGroup}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.programSetsRow}>
                              {personEntries.map(([person, count]) => (
                                <View
                                  key={person}
                                  style={styles.programSetsBadge}
                                >
                                  <Text style={styles.programSetsBadgeText}>
                                    {count}
                                  </Text>
                                  <Text style={styles.programSetsBadgeLabel}>
                                    {person}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )
                      })}

                    {!isHidden && isEditing && dayDraft && (
                      <View>
                        <Text style={styles.editModeLabel}>
                          Editing — tap fields to change
                        </Text>

                        {dayDraft.exercises.map((draft, exIdx) => {
                          const personKeys = Object.keys(draft.setsByPerson)
                          const showNameSuggestions =
                            focusedNameIdx === exIdx &&
                            (nameSuggestions[exIdx] ?? []).length > 0
                          const showMgSuggestions =
                            focusedMgIdx === exIdx &&
                            (mgSuggestions[exIdx] ?? []).length > 0

                          return (
                            <View key={exIdx} style={styles.editExerciseBlock}>
                              <TouchableOpacity
                                style={styles.removeExerciseBtn}
                                onPress={() => removeExercise(exIdx)}
                                hitSlop={{
                                  top: 6,
                                  bottom: 6,
                                  left: 6,
                                  right: 6,
                                }}
                              >
                                <Text style={styles.removeExerciseBtnText}>
                                  − Remove
                                </Text>
                              </TouchableOpacity>

                              <Text style={styles.editFieldLabel}>
                                Exercise name
                              </Text>
                              <TextInput
                                style={styles.editInput}
                                value={draft.name}
                                onChangeText={(v) =>
                                  updateDraftExercise(exIdx, "name", v)
                                }
                                onFocus={() => setFocusedNameIdx(exIdx)}
                                onBlur={() =>
                                  setTimeout(() => setFocusedNameIdx(null), 150)
                                }
                                placeholderTextColor={colors.textMuted}
                                placeholder='Exercise name'
                              />
                              {showNameSuggestions && (
                                <View style={styles.suggestionsBox}>
                                  {(nameSuggestions[exIdx] ?? []).map((s) => (
                                    <TouchableOpacity
                                      key={s}
                                      style={styles.suggestionItem}
                                      onPress={() =>
                                        applySuggestion(exIdx, "name", s)
                                      }
                                    >
                                      <Text style={styles.suggestionText}>
                                        {s}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}

                              <Text style={styles.editFieldLabel}>
                                Muscle group
                              </Text>
                              <TextInput
                                style={styles.editInput}
                                value={draft.muscleGroup}
                                onChangeText={(v) =>
                                  updateDraftExercise(exIdx, "muscleGroup", v)
                                }
                                onFocus={() => setFocusedMgIdx(exIdx)}
                                onBlur={() =>
                                  setTimeout(() => setFocusedMgIdx(null), 150)
                                }
                                placeholderTextColor={colors.textMuted}
                                placeholder='Muscle group'
                              />
                              {showMgSuggestions && (
                                <View style={styles.suggestionsBox}>
                                  {(mgSuggestions[exIdx] ?? []).map((s) => (
                                    <TouchableOpacity
                                      key={s}
                                      style={styles.suggestionItem}
                                      onPress={() =>
                                        applySuggestion(exIdx, "muscleGroup", s)
                                      }
                                    >
                                      <Text style={styles.suggestionText}>
                                        {s}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}

                              <Text style={styles.editFieldLabel}>Sets</Text>
                              <View style={styles.editSetsRow}>
                                {personKeys.map((person) => (
                                  <View key={person} style={styles.editSetItem}>
                                    <Text style={styles.editSetPersonLabel}>
                                      {person}
                                    </Text>
                                    <TextInput
                                      style={styles.editSetInput}
                                      value={draft.setsByPerson[person]}
                                      onChangeText={(v) =>
                                        updateDraftSets(exIdx, person, v)
                                      }
                                      keyboardType='numeric'
                                      maxLength={3}
                                      placeholderTextColor={colors.textMuted}
                                      placeholder='0'
                                    />
                                  </View>
                                ))}
                              </View>
                            </View>
                          )
                        })}

                        <TouchableOpacity
                          style={styles.addExerciseBtn}
                          onPress={addExercise}
                        >
                          <Text style={styles.addExerciseBtnText}>
                            + Add exercise
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={cancelEditing}
                            disabled={isSubmitting}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.submitBtn,
                              isSubmitting && { opacity: 0.6 },
                            ]}
                            onPress={handleSubmitEdits}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <ActivityIndicator color='#fff' size='small' />
                            ) : (
                              <Text style={styles.submitBtnText}>
                                Save changes
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
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
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 60, paddingBottom: 120 },
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
    suggestionsBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 8,
      marginTop: 2,
      overflow: "hidden",
    },
    suggestionItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    suggestionText: {
      fontSize: 14,
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
  })
