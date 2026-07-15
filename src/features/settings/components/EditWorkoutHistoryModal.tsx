import React, { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { workoutApi } from "@features/workout/services/index"
import type {
  WorkoutSession,
  FullSessionWithGroups,
  SetTiming,
} from "@shared/types"
import {
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
  getCanonicalMuscleGroup,
  normalizeExerciseName,
  CANONICAL_MUSCLE_GROUPS,
} from "@utils/exerciseMatching"
import ModalSheet from "@shared/components/ModalSheet"
import { useAlert } from "@shared/components/CustomAlert"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import type { SimilarityMatch, SessionExerciseGroup } from "../types"

/** day_title stamped on every session created by the CSV importer. */
const IMPORTED_DAY_TITLE = "Imported (Strength Level)"

interface Props {
  visible: boolean
  onClose: () => void
  person: string
  /** Called after any successful edit, so the caller can refresh analytics/progress */
  onDataChanged?: () => void
}
/** Groups a session's flat set list by exercise name, preserving set order. */
function groupSetsByExercise(sets: SetTiming[]): SessionExerciseGroup[] {
  const order: string[] = []
  const groups = new Map<string, SessionExerciseGroup>()

  sets.forEach((set) => {
    const name = set.exercise_name ?? "Unknown Exercise"
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        muscleGroup: set.exercise_muscle_group,
        sets: [],
      })
      order.push(name)
    }
    groups.get(name)!.sets.push(set)
  })

  return order.map((name) => groups.get(name)!)
}

function formatSessionLabel(session: WorkoutSession): string {
  const dateStr = session.start_time
    ? new Date(session.start_time).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown date"
  const title = session.day_title ?? `Day ${session.day_number}`
  return `${dateStr} — ${title}`
}

/** Splits an ISO string into separate date/time text fields for editing. */
function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Combines date (YYYY-MM-DD) and time (HH:MM) text back into an ISO string. */
function combineToIso(date: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match || !timeMatch) return null

  const d = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  )
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function EditWorkoutHistoryModal({
  visible,
  onClose,
  person,
  onDataChanged,
}: Props): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { alert, AlertComponent } = useAlert()

  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showImportedOnly, setShowImportedOnly] = useState(false)
  const [selectedSession, setSelectedSession] =
    useState<FullSessionWithGroups | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Known exercise names / muscle groups across this person's history, used to
  // catch typos/near-duplicates via exerciseMatching when renaming.
  const [knownExerciseNames, setKnownExerciseNames] = useState<string[]>([])
  const [knownMuscleGroups, setKnownMuscleGroups] = useState<string[]>([])

  // Edit-exercise (name + muscle group, applies everywhere) form state
  const [editingExercise, setEditingExercise] =
    useState<SessionExerciseGroup | null>(null)
  const [exerciseNameInput, setExerciseNameInput] = useState("")
  const [muscleGroupInput, setMuscleGroupInput] = useState("")
  const [savingExercise, setSavingExercise] = useState(false)
  const [nameSuggestions, setNameSuggestions] = useState<SimilarityMatch[]>([])
  const [muscleGroupSuggestions, setMuscleGroupSuggestions] = useState<
    SimilarityMatch[]
  >([])

  // Edit-set (time / weight / reps) form state
  const [editingSet, setEditingSet] = useState<SetTiming | null>(null)
  const [setDateInput, setSetDateInput] = useState("")
  const [setTimeInput, setSetTimeInput] = useState("")
  const [setWeightInput, setSetWeightInput] = useState("")
  const [setRepsInput, setSetRepsInput] = useState("")
  const [savingSet, setSavingSet] = useState(false)

  const loadSessions = useCallback(async () => {
    if (!person) return
    setLoadingSessions(true)
    try {
      const result = await workoutApi.getSessionHistory(person, null, 60)
      setSessions(result ?? [])
    } catch (error) {
      console.error("Error loading sessions to edit:", error)
    } finally {
      setLoadingSessions(false)
    }

    try {
      const withTimings = await workoutApi.getSessionHistory(
        person,
        null,
        200,
        true,
      )
      const names = new Set<string>()
      const groups = new Set<string>()
      ;(withTimings ?? []).forEach(
        (session: WorkoutSession & { set_timings?: SetTiming[] }) => {
          session.set_timings?.forEach((set: SetTiming) => {
            if (set.exercise_name) names.add(set.exercise_name.trim())
            if (set.exercise_muscle_group)
              groups.add(set.exercise_muscle_group.trim())
          })
        },
      )
      setKnownExerciseNames(Array.from(names))
      setKnownMuscleGroups(Array.from(groups))
    } catch (error) {
      console.error("Error building exercise name index:", error)
    }
  }, [person])

  const openSession = useCallback(async (session: WorkoutSession) => {
    setLoadingDetail(true)
    try {
      const full = await workoutApi.getSession(session.id)
      setSelectedSession(full as FullSessionWithGroups)
    } catch (error) {
      console.error("Error loading session detail:", error)
      alert(
        "Error",
        "Failed to load that session's sets.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setLoadingDetail(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShow = useCallback(() => {
    setSelectedSession(null)
    loadSessions()
  }, [loadSessions])

  const openEditExercise = (group: SessionExerciseGroup) => {
    setEditingExercise(group)
    setExerciseNameInput(group.name)
    setMuscleGroupInput(group.muscleGroup ?? "")
    setNameSuggestions([])
    setMuscleGroupSuggestions([])
  }

  const closeEditExercise = () => {
    setEditingExercise(null)
    setNameSuggestions([])
    setMuscleGroupSuggestions([])
  }

  // Live "did you mean" suggestions as the person types, mirroring the
  // typo-checking UX used on WorkoutScreen. Compared against everything else
  // this person has logged, excluding the exercise's own current name.
  useEffect(() => {
    if (!editingExercise || !exerciseNameInput.trim()) {
      setNameSuggestions([])
      return
    }
    const otherNames = knownExerciseNames.filter(
      (n) =>
        normalizeExerciseName(n) !==
        normalizeExerciseName(editingExercise.name),
    )
    const t = checkForTypo(exerciseNameInput, otherNames)
    setNameSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
  }, [exerciseNameInput, editingExercise, knownExerciseNames])

  useEffect(() => {
    if (!editingExercise || !muscleGroupInput.trim()) {
      setMuscleGroupSuggestions([])
      return
    }
    const otherGroups = Array.from(
      new Set([...CANONICAL_MUSCLE_GROUPS, ...knownMuscleGroups]),
    )
    const t = checkMuscleGroupForTypo(muscleGroupInput, otherGroups)
    setMuscleGroupSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
  }, [muscleGroupInput, editingExercise, knownMuscleGroups])

  const handleSuggestionPress = (
    suggestion: SimilarityMatch,
    field: "name" | "muscleGroup",
  ) => {
    if (field === "muscleGroup") {
      setMuscleGroupInput(suggestion.name)
      setMuscleGroupSuggestions([])
    } else {
      setExerciseNameInput(suggestion.name)
      setNameSuggestions([])
    }
  }

  /** Actually performs the rename/regroup call and updates local state. */
  const commitExerciseEdit = async (finalName: string, finalGroup: string) => {
    if (!editingExercise) return
    setSavingExercise(true)
    try {
      await workoutApi.renameExercise(person, editingExercise.name, {
        newName: finalName !== editingExercise.name ? finalName : undefined,
        muscleGroup: finalGroup || null,
      })

      setSelectedSession((prev) => {
        if (!prev?.set_timings) return prev
        return {
          ...prev,
          set_timings: prev.set_timings.map((s: SetTiming) =>
            s.exercise_name === editingExercise.name
              ? {
                  ...s,
                  exercise_name: finalName,
                  exercise_muscle_group: finalGroup,
                }
              : s,
          ),
        }
      })

      closeEditExercise()
      onDataChanged?.()
      alert(
        "Updated",
        `"${editingExercise.name}" was updated everywhere it appears.`,
        [{ text: "OK" }],
        "success",
      )
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update exercise.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSavingExercise(false)
    }
  }

  const saveExerciseEdit = async () => {
    if (!editingExercise) return
    const newName = exerciseNameInput.trim()
    const newMuscleGroup = muscleGroupInput.trim()

    if (!newName) {
      alert(
        "Missing Name",
        "Exercise name can't be empty.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    // Everything else this person has ever logged, excluding the exercise
    // currently being renamed (so we don't "catch" its own old name).
    const otherNames = knownExerciseNames.filter(
      (n) =>
        normalizeExerciseName(n) !==
        normalizeExerciseName(editingExercise.name),
    )
    const otherGroups = Array.from(
      new Set([...CANONICAL_MUSCLE_GROUPS, ...knownMuscleGroups]),
    )

    // Case/whitespace-only difference from an existing exercise → silently
    // normalize to that exercise's canonical spelling instead of creating a
    // near-duplicate.
    const canonicalName = getCanonicalName(newName, otherNames)
    const canonicalGroup = newMuscleGroup
      ? getCanonicalMuscleGroup(newMuscleGroup, otherGroups)
      : newMuscleGroup

    const nameTypo = checkForTypo(canonicalName, otherNames)
    if (nameTypo.isLikelyTypo && nameTypo.suggestions.length > 0) {
      const suggestion = nameTypo.suggestions[0].name
      alert(
        "Similar Exercise Exists",
        `"${canonicalName}" looks similar to your existing "${suggestion}". Merge into "${suggestion}", or keep "${canonicalName}" as a separate exercise?`,
        [
          {
            text: `Merge into "${suggestion}"`,
            onPress: () => commitExerciseEdit(suggestion, canonicalGroup),
          },
          {
            text: "Keep as new",
            onPress: () => commitExerciseEdit(canonicalName, canonicalGroup),
          },
        ],
        "warning",
      )
      return
    }

    if (canonicalGroup) {
      const groupTypo = checkMuscleGroupForTypo(canonicalGroup, otherGroups)
      if (groupTypo.isLikelyTypo && groupTypo.suggestions.length > 0) {
        const suggestion = groupTypo.suggestions[0].name
        alert(
          "Similar Muscle Group Exists",
          `"${canonicalGroup}" looks similar to "${suggestion}". Use "${suggestion}" instead, or keep "${canonicalGroup}"?`,
          [
            {
              text: `Use "${suggestion}"`,
              onPress: () => commitExerciseEdit(canonicalName, suggestion),
            },
            {
              text: "Keep as typed",
              onPress: () => commitExerciseEdit(canonicalName, canonicalGroup),
            },
          ],
          "warning",
        )
        return
      }
    }

    commitExerciseEdit(canonicalName, canonicalGroup)
  }

  const openEditSet = (set: SetTiming) => {
    const { date, time } = splitIso(set.end_time)
    setEditingSet(set)
    setSetDateInput(date)
    setSetTimeInput(time)
    setSetWeightInput(set.weight != null ? String(set.weight) : "")
    setSetRepsInput(set.reps != null ? String(set.reps) : "")
  }

  const saveSetEdit = async () => {
    if (!editingSet || !selectedSession || editingSet.id == null) {
      alert(
        "Can't Edit",
        "This set has no server ID yet, so it can't be edited directly.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    const newEndIso = combineToIso(setDateInput, setTimeInput)
    if (!newEndIso) {
      alert(
        "Invalid Date/Time",
        "Use format YYYY-MM-DD for date and HH:MM (24h) for time.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    const weight =
      setWeightInput.trim() === "" ? undefined : parseFloat(setWeightInput)
    const reps =
      setRepsInput.trim() === "" ? undefined : parseInt(setRepsInput, 10)
    if (weight !== undefined && Number.isNaN(weight)) {
      alert(
        "Invalid Weight",
        "Enter a valid number for weight.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    if (reps !== undefined && Number.isNaN(reps)) {
      alert(
        "Invalid Reps",
        "Enter a valid whole number for reps.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    // Preserve the original set duration by shifting start_time by the same delta
    const originalEnd = new Date(editingSet.end_time).getTime()
    const originalStart = editingSet.start_time
      ? new Date(editingSet.start_time).getTime()
      : NaN
    const durationMs =
      !Number.isNaN(originalEnd) && !Number.isNaN(originalStart)
        ? originalEnd - originalStart
        : 0
    const newEndMs = new Date(newEndIso).getTime()
    const newStartIso = new Date(
      newEndMs - Math.max(durationMs, 0),
    ).toISOString()

    setSavingSet(true)
    try {
      const updated = await workoutApi.updateSet(
        selectedSession.id,
        editingSet.id,
        {
          endTime: newEndIso,
          startTime: newStartIso,
          weight,
          reps,
        },
      )

      setSelectedSession((prev) => {
        if (!prev?.set_timings) return prev
        return {
          ...prev,
          set_timings: prev.set_timings.map((s: SetTiming) =>
            s.id === editingSet.id ? { ...s, ...updated } : s,
          ),
        }
      })

      setEditingSet(null)
      onDataChanged?.()
      alert("Updated", "Set updated successfully.", [{ text: "OK" }], "success")
    } catch (error) {
      alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update set.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSavingSet(false)
    }
  }

  const groupedExercises = selectedSession?.set_timings
    ? groupSetsByExercise(selectedSession.set_timings)
    : []

  const visibleSessions = showImportedOnly
    ? sessions.filter((s) => s.day_title === IMPORTED_DAY_TITLE)
    : sessions

  return (
    <Modal
      visible={visible}
      animationType='slide'
      onShow={handleShow}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          {selectedSession ? (
            <TouchableOpacity onPress={() => setSelectedSession(null)}>
              <Text style={styles.headerButton}>← Sessions</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
          <Text style={styles.headerTitle}>
            {selectedSession ? "Edit Sets" : "Edit Imported History"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerButton}>Close</Text>
          </TouchableOpacity>
        </View>

        {!selectedSession ? (
          <ScrollView contentContainerStyle={styles.listContent}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                showImportedOnly && styles.filterPillActive,
              ]}
              onPress={() => setShowImportedOnly((prev) => !prev)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  showImportedOnly && styles.filterPillTextActive,
                ]}
              >
                {showImportedOnly
                  ? "✓ Imported sessions only"
                  : "Show imported sessions only"}
              </Text>
            </TouchableOpacity>

            {loadingSessions ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 40 }}
              />
            ) : visibleSessions.length === 0 ? (
              <Text style={styles.emptyText}>
                {showImportedOnly
                  ? "No imported sessions found for this person."
                  : "No sessions found for this person."}
              </Text>
            ) : (
              visibleSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionRow}
                  onPress={() => openSession(session)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>
                      {formatSessionLabel(session)}
                    </Text>
                    <Text style={styles.sessionSubtitle}>
                      {session.set_count ?? 0} set
                      {(session.set_count ?? 0) === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {loadingDetail ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 40 }}
              />
            ) : groupedExercises.length === 0 ? (
              <Text style={styles.emptyText}>
                No sets recorded in this session.
              </Text>
            ) : (
              groupedExercises.map((group) => (
                <View key={group.name} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{group.name}</Text>
                      <Text style={styles.exerciseMuscleGroup}>
                        {group.muscleGroup || "No muscle group set"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.smallEditButton}
                      onPress={() => openEditExercise(group)}
                    >
                      <Text style={styles.smallEditButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>

                  {group.sets.map((set, idx) => (
                    <TouchableOpacity
                      key={set.id ?? `${group.name}-${idx}`}
                      style={styles.setRow}
                      onPress={() => openEditSet(set)}
                    >
                      <Text style={styles.setLabel}>Set {set.set_index}</Text>
                      <Text style={styles.setDetail}>
                        {set.weight ?? 0}kg × {set.reps ?? 0}
                      </Text>
                      <Text style={styles.setTime}>
                        {new Date(set.end_time).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ── Edit Exercise (name + muscle group, applies everywhere) ── */}
      <ModalSheet
        visible={!!editingExercise}
        onClose={closeEditExercise}
        title='Edit Exercise'
        onConfirm={saveExerciseEdit}
        confirmText={savingExercise ? "Saving…" : "Save Everywhere"}
      >
        <Text style={styles.modalDescription}>
          Changes apply to every set logged under this exercise name for this
          person, not just this session.
        </Text>
        <Text style={styles.fieldLabel}>Exercise Name</Text>
        <TextInput
          style={styles.input}
          value={exerciseNameInput}
          onChangeText={setExerciseNameInput}
          placeholder='e.g. Bench Press'
          placeholderTextColor='#999'
        />
        {nameSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
            {nameSuggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
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
        <Text style={styles.fieldLabel}>Muscle Group</Text>
        <TextInput
          style={styles.input}
          value={muscleGroupInput}
          onChangeText={setMuscleGroupInput}
          placeholder='e.g. Chest'
          placeholderTextColor='#999'
        />
        {muscleGroupSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
            {muscleGroupSuggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
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
      </ModalSheet>

      {/* ── Edit Set (time / weight / reps) ── */}
      <ModalSheet
        visible={!!editingSet}
        onClose={() => setEditingSet(null)}
        title='Edit Set'
        onConfirm={saveSetEdit}
        confirmText={savingSet ? "Saving…" : "Save"}
      >
        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={setDateInput}
          onChangeText={setSetDateInput}
          placeholder='2026-01-13'
          placeholderTextColor='#999'
        />
        <Text style={styles.fieldLabel}>Time (24h, HH:MM)</Text>
        <TextInput
          style={styles.input}
          value={setTimeInput}
          onChangeText={setSetTimeInput}
          placeholder='18:30'
          placeholderTextColor='#999'
        />
        <Text style={styles.fieldLabel}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          value={setWeightInput}
          onChangeText={setSetWeightInput}
          keyboardType='decimal-pad'
          placeholder='60'
          placeholderTextColor='#999'
        />
        <Text style={styles.fieldLabel}>Reps</Text>
        <TextInput
          style={styles.input}
          value={setRepsInput}
          onChangeText={setSetRepsInput}
          keyboardType='number-pad'
          placeholder='8'
          placeholderTextColor='#999'
        />
      </ModalSheet>

      {AlertComponent}
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    headerButton: { fontSize: 15, fontWeight: "600", color: colors.accent },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
    listContent: { padding: 16, paddingBottom: 60 },
    emptyText: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: 40,
      fontSize: 15,
    },
    filterPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 14,
    },
    filterPillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: colors.background,
    },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },
    sessionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    sessionSubtitle: { fontSize: 13, color: colors.textSecondary },
    chevron: { fontSize: 22, color: colors.textMuted, marginLeft: 8 },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    },
    exerciseHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    exerciseMuscleGroup: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    smallEditButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    smallEditButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    setLabel: { fontSize: 13, color: colors.textMuted, width: 50 },
    setDetail: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      flex: 1,
    },
    setTime: { fontSize: 12, color: colors.textSecondary },
    modalDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 4,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      marginBottom: 12,
    },
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
  })
