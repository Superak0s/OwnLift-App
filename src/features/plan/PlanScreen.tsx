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
  FlatList,
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
import type { WorkoutData, RootStackParamList } from "@shared/types"

// Enable LayoutAnimation on Android
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
  const { workoutData, selectedPerson, saveWorkoutData, saveSelectedPerson } =
    useWorkout()
  const { alert, AlertComponent } = useAlert()
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)

  const [hiddenDays, setHiddenDays] = useState<Set<number>>(new Set())
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null)
  const [dayDraft, setDayDraft] = useState<DayDraft | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Exercise name suggestion state
  const [nameSuggestions, setNameSuggestions] = useState<
    Record<number, string[]>
  >({})
  const [mgSuggestions, setMgSuggestions] = useState<Record<number, string[]>>(
    {},
  )
  const [focusedNameIdx, setFocusedNameIdx] = useState<number | null>(null)
  const [focusedMgIdx, setFocusedMgIdx] = useState<number | null>(null)

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
  }, [workoutData])

  const handleUploadFile = async (): Promise<void> => {
    try {
      setIsUploading(true)
      const fileUri = await workoutApi.pickWorkoutFile()
      if (!fileUri) {
        setIsUploading(false)
        return
      }
      const data = (await programApi.uploadAndSave(fileUri)) as WorkoutData & {
        success?: boolean
        totalDays?: number
        people?: string[]
      }
      if (data.success) {
        await saveWorkoutData(data)
        alert(
          "Success!",
          `Loaded ${data?.totalDays ?? 0} workout days for ${data.people?.join(", ") ?? ""}`,
          [{ text: "OK" }],
          "success",
        )
      }
    } catch (error) {
      alert(
        "Error",
        (error instanceof Error ? error.message : null) ??
          "Failed to upload workout file",
        [{ text: "OK" }],
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectPerson = (person: string): void => {
    saveSelectedPerson(person)
    alert(
      "Success",
      `Selected ${person}'s workout plan`,
      [{ text: "OK" }],
      "success",
    )
  }

  const getPersonWorkoutSummary = (person: string) => {
    if (!workoutData?.days) return null
    let totalSets = 0
    let totalDays = 0
    workoutData.days.forEach((day) => {
      if (day.people[person]?.exercises.length > 0) {
        totalDays++
        totalSets += day.people[person].totalSets || 0
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

    // Compute suggestions
    if (field === "name") {
      const allNames = getAllExerciseNames(workoutData, selectedPerson)
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
      const allMg = getAllMuscleGroups(workoutData, selectedPerson)
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
      exercises: [...dayDraft.exercises, EMPTY_EXERCISE(programPeople)],
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
      // IMPORTANT: the real data model (the one WorkoutScreen reads from)
      // keeps exercises PER PERSON under day.people[person].exercises,
      // each with its own `sets` count — there is no flat day.exercises[]
      // field on the actual WorkoutData. The `wd` object used elsewhere in
      // this screen is a synthetic/display-only view created purely for
      // rendering the editor UI (it flattens per-person exercises into one
      // row with a setsByPerson map). The previous version of this function
      // wrote the draft back into that fake `day.exercises` field, which
      // WorkoutScreen never reads — so saves looked successful (the alert
      // fired) but never actually showed up in the Workout tab.
      //
      // Fix: convert the flat draft rows back into each person's
      // exercises[] list and write into day.people[person].exercises so
      // WorkoutScreen picks up the change.
      const realDays = (
        workoutData as unknown as {
          days?: Array<{
            people: Record<
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

        const updatedPeople = { ...day.people }

        Object.keys(updatedPeople).forEach((person) => {
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

          updatedPeople[person] = {
            ...updatedPeople[person],
            exercises: exercisesForPerson,
            totalSets,
          }
        })

        return { ...day, people: updatedPeople }
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
    people?: string[]
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

  const programPeople: string[] = wd?.people ?? []
  const allOptions = ["All", ...programPeople]

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps='handled'>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📋 Workout Plan</Text>
            <Text style={styles.subtitle}>
              Upload your workout plan and choose who's training
            </Text>
          </View>

          {/* Upload button */}
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadFile}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <>
                <Text style={styles.uploadButtonIcon}>📁</Text>
                <Text style={styles.uploadButtonText}>
                  {workoutData ? "Upload New File" : "Upload Workout File"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Summary card */}
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
                <Text style={styles.summaryLabel}>People:</Text>
                <Text style={styles.summaryValue}>
                  {workoutData.people?.join(", ")}
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
            </View>
          )}

          {/* Person selector */}
          {workoutData && workoutData.people && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Profile</Text>
              {workoutData.people.map((person: string) => {
                const summary = getPersonWorkoutSummary(person)
                const isSelected = selectedPerson === person
                return (
                  <TouchableOpacity
                    key={person}
                    style={[
                      styles.personCard,
                      isSelected && styles.personCardSelected,
                    ]}
                    onPress={() => handleSelectPerson(person)}
                  >
                    <View style={styles.personCardHeader}>
                      <Text
                        style={[
                          styles.personName,
                          isSelected && styles.personNameSelected,
                        ]}
                      >
                        {person}
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

          {/* Program Viewer */}
          {workoutData && wd?.days && wd.days.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 View Program</Text>

              {/* Person filter pills */}
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

              {/* Day cards */}
              {wd.days.map((day, dayIdx) => {
                const exercises = Array.isArray(day.exercises)
                  ? day.exercises.filter(
                      (ex) =>
                        !selectedProgram ||
                        (ex.setsByPerson?.[selectedProgram] ?? 0) > 0,
                    )
                  : []
                if (!exercises.length) return null

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
                    {/* Day header row */}
                    <View style={styles.programDayHeader}>
                      <Text style={styles.programDayNumber}>{dayLabel}</Text>
                      <Text style={styles.programDayTitle} numberOfLines={2}>
                        {dayTitle}
                      </Text>

                      {/* Edit button */}
                      {!isHidden && editingDayIdx === null && (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => startEditing(dayIdx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.iconBtnText}>✏️</Text>
                        </TouchableOpacity>
                      )}

                      {/* Collapse/expand arrow */}
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

                    {/* Normal view */}
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

                    {/* Edit mode */}
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
                              {/* Remove exercise button */}
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

                              {/* Exercise name */}
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

                              {/* Muscle group */}
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

                              {/* Sets per person */}
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

                        {/* Add exercise button */}
                        <TouchableOpacity
                          style={styles.addExerciseBtn}
                          onPress={addExercise}
                        >
                          <Text style={styles.addExerciseBtnText}>
                            + Add exercise
                          </Text>
                        </TouchableOpacity>

                        {/* Submit / Cancel */}
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
                1. Tap "Upload Workout File" above
              </Text>
              <Text style={styles.instructionStep}>
                2. Select your .ods, .xlsx, or .xls workout file
              </Text>
              <Text style={styles.instructionStep}>
                3. Choose your profile (GF or BF)
              </Text>
              <Text style={styles.instructionStep}>
                4. Head to the Home tab to pick your day and start!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      {AlertComponent}
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
    uploadButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    uploadButtonIcon: { fontSize: 24, marginRight: 10 },
    uploadButtonText: {
      color: colors.surface,
      fontSize: 18,
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
      //   fontWeight: "600",
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
    // Edit mode
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
