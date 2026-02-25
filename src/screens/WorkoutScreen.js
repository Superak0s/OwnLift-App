/**
 * WorkoutScreen – with Joint Session highlights
 *
 * Joint session state is now consumed from WorkoutContext (single shared
 * instance). This screen no longer instantiates useJointSession directly.
 */

import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native"
import { ActivityIndicator } from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import { useAuth } from "../context/AuthContext"
import { useTabBar } from "../context/TabBarContext"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  getAllExerciseNames,
  getAllMuscleGroups,
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
} from "../utils/exerciseMatching"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"
import { LinearGradient } from "expo-linear-gradient"

// ─────────────────────────────────────────────────────────────────────────────
// Partner banner – compact strip pinned to the very top of the screen
// ─────────────────────────────────────────────────────────────────────────────
function PartnerBanner({
  partnerProgress,
  isPartnerReady,
  syncPulse,
  partnerUsername,
  onLeave,
}) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (syncPulse) {
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [syncPulse, pulse])

  const exerciseLabel = partnerProgress?.exerciseName
    ? partnerProgress.exerciseName
    : partnerProgress?.exerciseIndex != null
      ? `Ex ${partnerProgress.exerciseIndex + 1}`
      : "—"
  const setLabel =
    partnerProgress?.setIndex != null
      ? `Set ${partnerProgress.setIndex + 1}`
      : "—"
  const statusText = isPartnerReady
    ? "✅ Ready for next set"
    : partnerProgress
      ? `${exerciseLabel} · ${setLabel}`
      : "Waiting…"

  return (
    <Animated.View
      style={[bannerStyles.container, { transform: [{ scale: pulse }] }]}
    >
      <View style={bannerStyles.liveDot} />
      <View style={bannerStyles.avatarRing}>
        <Text style={bannerStyles.avatarText}>
          {partnerUsername?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <Text style={bannerStyles.label} numberOfLines={1}>
        <Text style={bannerStyles.name}>{partnerUsername}</Text>
        {"  "}
        <Text style={bannerStyles.status}>{statusText}</Text>
      </Text>
      <TouchableOpacity style={bannerStyles.leaveBtn} onPress={onLeave}>
        <Text style={bannerStyles.leaveBtnText}>Leave</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10b981",
  },
  avatarRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#a78bfa",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  label: { flex: 1, fontSize: 12 },
  name: { color: "#fff", fontWeight: "700" },
  status: { color: "rgba(255,255,255,0.6)" },
  leaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  leaveBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "600",
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// "Partner is here" pill
// ─────────────────────────────────────────────────────────────────────────────
function PartnerExercisePill({ username }) {
  return (
    <View style={pillStyles.pill}>
      <View style={pillStyles.dot} />
      <Text style={pillStyles.text}>{username} is here</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge showing set-count difference for shared exercises
// ─────────────────────────────────────────────────────────────────────────────
function PartnerExerciseMatchBadge({ partnerSets, mySets }) {
  const diff = (partnerSets ?? 0) - mySets
  const diffText =
    diff === 0
      ? "Same sets"
      : diff > 0
        ? `+${diff} partner sets`
        : `${diff} partner sets`
  const diffColor = diff === 0 ? "#78350f" : diff > 0 ? "#92400e" : "#78350f"
  const bgColor = diff === 0 ? "#fef9c3" : diff > 0 ? "#fef3c7" : "#fef9c3"
  const borderColor = diff === 0 ? "#fde68a" : diff > 0 ? "#fcd34d" : "#fde68a"
  return (
    <View
      style={[matchStyles.badge, { backgroundColor: bgColor, borderColor }]}
    >
      <Text style={[matchStyles.setsText, { color: diffColor }]}>
        🤝 {diffText}
      </Text>
    </View>
  )
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ede9fe",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#7c3aed" },
  text: { fontSize: 11, fontWeight: "700", color: "#5b21b6" },
})

const matchStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  setsText: { fontSize: 11, fontWeight: "700" },
})

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutScreen() {
  const { user } = useAuth()
  const { isTabBarCollapsed } = useTabBar()
  const {
    workoutData,
    selectedPerson,
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
    currentSessionId,
    endWorkout,
    updateExerciseName,
    addExtraSetsToExercise,
    addNewExercise,
    lastActivityTime,
    getSessionAverageRestTime,
    getTotalSessionTime,
    getCurrentRestTime,
    getSessionStats,
    // ── joint session ──
    isInJointSession,
    jointSession,
    partnerProgress,
    partnerExerciseList,
    isPartnerReady,
    syncPulse,
    pushJointProgress,
    leaveJointSession,
    partnerCompletedSets,
  } = useWorkout()

  const { alert, AlertComponent } = useAlert()

  const partnerUsername =
    jointSession?.participants?.find((p) => p.userId !== user?.id)?.username ??
    "Partner"

  const bottomAnim = useRef(new Animated.Value(74)).current
  const leftAnim = useRef(new Animated.Value(0)).current
  const borderRadiusAnim = useRef(new Animated.Value(0)).current
  const paddingBottomAnim = useRef(new Animated.Value(15)).current

  // ── local state ──────────────────────────────────────────────────────
  const [showSetModal, setShowSetModal] = useState(false)
  const [selectedSet, setSelectedSet] = useState(null)
  const [weight, setWeight] = useState("")
  const [reps, setReps] = useState("")
  const [performanceHistory, setPerformanceHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [setNote, setSetNote] = useState("")
  const [isWarmupSet, setIsWarmupSet] = useState(false)
  const [showEditNameModal, setShowEditNameModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [newExerciseName, setNewExerciseName] = useState("")
  const [newMuscleGroup, setNewMuscleGroup] = useState("")
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [muscleGroupSuggestions, setMuscleGroupSuggestions] = useState([])
  const [showAddSetsModal, setShowAddSetsModal] = useState(false)
  const [addingSetsExercise, setAddingSetsExercise] = useState(null)
  const [additionalSets, setAdditionalSets] = useState("")
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false)
  const [newExercise, setNewExercise] = useState({
    name: "",
    muscleGroup: "",
    sets: "",
  })
  const [newExerciseSuggestions, setNewExerciseSuggestions] = useState([])
  const [
    newExerciseMuscleGroupSuggestions,
    setNewExerciseMuscleGroupSuggestions,
  ] = useState([])
  const [currentRestTimer, setCurrentRestTimer] = useState(0)
  const [sessionStats, setSessionStats] = useState(null)

  const allExerciseNames = getAllExerciseNames(workoutData, selectedPerson)
  const allMuscleGroups = getAllMuscleGroups(workoutData, selectedPerson)
  const isCurrentDayLocked = isDayLocked(currentDay)
  const areAllSetsComplete = isDayComplete(currentDay)

  const getCurrentDayWorkout = () => {
    if (!workoutData?.days || !selectedPerson) return null
    const day = workoutData.days.find((d) => d.dayNumber === currentDay)
    if (!day || !day.people[selectedPerson]) return null
    return {
      dayNumber: day.dayNumber,
      dayTitle: day.dayTitle,
      muscleGroups: day.muscleGroups,
      exercises: day.people[selectedPerson].exercises || [],
      totalSets: day.people[selectedPerson].totalSets || 0,
    }
  }
  const dayWorkout = getCurrentDayWorkout()

  // ── session stats ticker ─────────────────────────────────────────────
  useEffect(() => {
    if (!workoutStartTime || isCurrentDayLocked) return
    const interval = setInterval(() => {
      setSessionStats(getSessionStats(currentDay))
      setCurrentRestTimer(getCurrentRestTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [workoutStartTime, isCurrentDayLocked, currentDay])

  useEffect(() => {
    if (showSetModal && selectedSet) loadPerformanceHistory()
  }, [showSetModal, selectedSet])

  useEffect(() => {
    if (showEditNameModal && newExerciseName.trim()) {
      const t = checkForTypo(newExerciseName, allExerciseNames)
      setNameSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setNameSuggestions([])
  }, [newExerciseName, showEditNameModal])

  useEffect(() => {
    if (showEditNameModal && newMuscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(newMuscleGroup, allMuscleGroups)
      setMuscleGroupSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setMuscleGroupSuggestions([])
  }, [newMuscleGroup, showEditNameModal])

  useEffect(() => {
    if (showAddExerciseModal && newExercise.name.trim()) {
      const t = checkForTypo(newExercise.name, allExerciseNames)
      setNewExerciseSuggestions(t.suggestions.length > 0 ? t.suggestions : [])
    } else setNewExerciseSuggestions([])
  }, [newExercise.name, showAddExerciseModal])

  useEffect(() => {
    if (showAddExerciseModal && newExercise.muscleGroup.trim()) {
      const t = checkMuscleGroupForTypo(
        newExercise.muscleGroup,
        allMuscleGroups,
      )
      setNewExerciseMuscleGroupSuggestions(
        t.suggestions.length > 0 ? t.suggestions : [],
      )
    } else setNewExerciseMuscleGroupSuggestions([])
  }, [newExercise.muscleGroup, showAddExerciseModal])

  useEffect(() => {
    if (isDayLocked(currentDay) && workoutStartTime && lastActivityTime) {
      const since = Date.now() - new Date(lastActivityTime).getTime()
      if (since >= 30 * 60 * 1000)
        alert(
          "Session Auto-Completed",
          "Your workout session was automatically completed due to 30 minutes of inactivity.",
          [{ text: "OK" }],
          "info",
        )
    }
  }, [])

  useEffect(() => {
    Animated.spring(bottomAnim, {
      toValue: isTabBarCollapsed ? -10 : 74,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(leftAnim, {
      toValue: isTabBarCollapsed ? 66 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(borderRadiusAnim, {
      toValue: isTabBarCollapsed ? 16 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
    Animated.spring(paddingBottomAnim, {
      toValue: isTabBarCollapsed ? 25 : 15,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()
  }, [isTabBarCollapsed])

  // ── performance history ──────────────────────────────────────────────
  const loadPerformanceHistory = async () => {
    if (!selectedSet || !dayWorkout) return
    setLoadingHistory(true)
    try {
      const exercise = dayWorkout.exercises[selectedSet.exerciseIndex]
      const canonicalName = getCanonicalName(exercise.name, allExerciseNames)
      const history = []
      Object.keys(completedDays).forEach((dayNumber) => {
        const day = workoutData.days.find(
          (d) => d.dayNumber === parseInt(dayNumber),
        )
        if (!day) return
        const pw = day.people[selectedPerson]
        if (!pw?.exercises) return
        pw.exercises.forEach((ex, exerciseIndex) => {
          if (
            getCanonicalName(ex.name, allExerciseNames).toLowerCase() !==
            canonicalName.toLowerCase()
          )
            return
          const sets = completedDays[dayNumber]?.[exerciseIndex]
          if (!sets) return
          Object.keys(sets).forEach((si) => {
            const s = sets[si]
            const w = s.weight ?? 0,
              r = s.reps ?? 0
            history.push({
              date: new Date(s.completedAt),
              weight: isFinite(w) ? w : 0,
              reps: isFinite(r) ? r : 0,
              volume: isFinite(w * r) ? w * r : 0,
              note: s.note || "",
              isWarmup: s.isWarmup || false,
            })
          })
        })
      })
      if (!history.length) {
        setPerformanceHistory(null)
        return
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const prev = history.filter((e) => e.date < today && !e.isWarmup)
      if (!prev.length) {
        setPerformanceHistory(null)
        return
      }
      prev.sort((a, b) => b.date - a.date)
      const last = prev[0]
      const best = prev.reduce((b, c) => (c.volume > b.volume ? c : b), prev[0])
      setPerformanceHistory({ last, best, totalAttempts: prev.length })
    } catch (e) {
      console.error("Error loading performance history:", e)
      setPerformanceHistory(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  // ── set press ────────────────────────────────────────────────────────
  const handleSetPress = (exerciseIndex, setIndex) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "This day has been completed and locked.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    const existing = getSetDetails(currentDay, exerciseIndex, setIndex)
    if (existing) {
      let msg = `Weight: ${existing.weight || 0} kg\nReps: ${existing.reps || 0}`
      if (existing.isWarmup) msg = `🔥 WARM-UP SET\n${msg}`
      if (existing.note) msg += `\n\nNote: ${existing.note}`
      alert(
        "Set Completed",
        msg,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () => {
              setSelectedSet({ exerciseIndex, setIndex })
              setWeight(existing.weight?.toString() || "")
              setReps(existing.reps?.toString() || "")
              setSetNote(existing.note || "")
              setIsWarmupSet(existing.isWarmup || false)
              setShowSetModal(true)
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              deleteSetDetails(currentDay, exerciseIndex, setIndex),
          },
        ],
        "info",
      )
    } else {
      setSelectedSet({ exerciseIndex, setIndex })
      setWeight("")
      setReps("")
      setSetNote("")
      setIsWarmupSet(false)
      setShowSetModal(true)
    }
  }

  // ── save set ─────────────────────────────────────────────────────────
  const handleSaveSetDetails = async () => {
    console.log("[SAVE_SET_START]", {
      selectedSet,
      weight,
      reps,
      isInJointSession,
    })

    if (!selectedSet) return
    const w = parseFloat(weight) || 0,
      r = parseInt(reps) || 0

    if (w === 0 || r === 0) {
      alert(
        "Invalid Set",
        "Please enter a weight and reps greater than 0.",
        [{ text: "OK" }],
        "error",
      )
      return
    }

    await saveSetDetailsCtx(
      currentDay,
      selectedSet.exerciseIndex,
      selectedSet.setIndex,
      w,
      r,
      setNote.trim(),
      isWarmupSet,
    )

    console.log("[SAVE_SET_SAVED_TO_STORAGE]")

    if (isInJointSession) {
      const exercise = dayWorkout.exercises[selectedSet.exerciseIndex]
      console.log("[PUSH_JOINT_PROGRESS_START]", {
        exerciseName: exercise.name,
        setIndex: selectedSet.setIndex,
      })

      await pushJointProgress({
        exerciseIndex: selectedSet.exerciseIndex,
        setIndex: selectedSet.setIndex,
        exerciseName: exercise.name,
        readyForNext: false,
      })

      console.log("[PUSH_JOINT_PROGRESS_DONE]")
    }

    console.log("[SAVE_SET_CLOSING_MODAL]")

    setShowSetModal(false)
    setSelectedSet(null)
    setWeight("")
    setReps("")
    setSetNote("")
    setIsWarmupSet(false)
    setPerformanceHistory(null)
  }

  // ── exercise editing ─────────────────────────────────────────────────
  const handleEditExerciseName = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot edit exercises on a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    const exercise = dayWorkout.exercises[exerciseIndex]
    setEditingExercise({ index: exerciseIndex, exercise })
    setNewExerciseName(exercise.name)
    setNewMuscleGroup(exercise.muscleGroup || "")
    setShowEditNameModal(true)
  }

  const closeEditModal = () => {
    setShowEditNameModal(false)
    setEditingExercise(null)
    setNewExerciseName("")
    setNewMuscleGroup("")
    setNameSuggestions([])
    setMuscleGroupSuggestions([])
  }

  const handleSaveExerciseName = () => {
    if (!editingExercise || !newExerciseName.trim()) {
      alert("Error", "Exercise name cannot be empty", [{ text: "OK" }], "error")
      return
    }
    const trimmed = newExerciseName.trim(),
      trimmedMG = newMuscleGroup.trim()
    const tc = checkForTypo(trimmed, allExerciseNames)
    if (tc.exactMatch) {
      updateExerciseName(
        currentDay,
        selectedPerson,
        editingExercise.index,
        tc.exactMatch,
        trimmedMG,
      )
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      )
      closeEditModal()
    } else if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0]
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}". Use that instead?`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedPerson,
                editingExercise.index,
                trimmed,
                trimmedMG,
              )
              closeEditModal()
            },
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedPerson,
                editingExercise.index,
                top.name,
                trimmedMG,
              )
              closeEditModal()
            },
          },
        ],
        "warning",
      )
    } else {
      updateExerciseName(
        currentDay,
        selectedPerson,
        editingExercise.index,
        trimmed,
        trimmedMG,
      )
      closeEditModal()
    }
  }

  const handleQuickAddSet = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add sets to a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    addExtraSetsToExercise(currentDay, selectedPerson, exerciseIndex, 1)
  }

  const handleAddMultipleSets = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add sets to a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    setAddingSetsExercise({
      index: exerciseIndex,
      exercise: dayWorkout.exercises[exerciseIndex],
    })
    setAdditionalSets("")
    setShowAddSetsModal(true)
  }

  const handleSaveAdditionalSets = () => {
    if (!addingSetsExercise) return
    const sets = parseInt(additionalSets)
    if (isNaN(sets) || sets < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    addExtraSetsToExercise(
      currentDay,
      selectedPerson,
      addingSetsExercise.index,
      sets,
    )
    setShowAddSetsModal(false)
    setAddingSetsExercise(null)
    setAdditionalSets("")
  }

  const handleAddNewExercise = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Locked",
        "Cannot add exercises to a locked day.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    setNewExercise({ name: "", muscleGroup: "", sets: "" })
    setShowAddExerciseModal(true)
  }

  const closeAddExerciseModal = () => {
    setShowAddExerciseModal(false)
    setNewExercise({ name: "", muscleGroup: "", sets: "" })
    setNewExerciseSuggestions([])
    setNewExerciseMuscleGroupSuggestions([])
  }

  const handleSaveNewExercise = () => {
    const { name, muscleGroup, sets } = newExercise
    if (!name.trim()) {
      alert("Error", "Exercise name is required", [{ text: "OK" }], "error")
      return
    }
    const setsNum = parseInt(sets)
    if (isNaN(setsNum) || setsNum < 1) {
      alert(
        "Error",
        "Please enter a valid number of sets (minimum 1)",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    const trimmed = name.trim(),
      trimmedMG = muscleGroup.trim()
    const tc = checkForTypo(trimmed, allExerciseNames)
    if (tc.exactMatch) {
      addNewExercise(currentDay, selectedPerson, {
        name: tc.exactMatch,
        muscleGroup: trimmedMG,
        sets: setsNum,
      })
      alert(
        "Exercise Matched! 🎯",
        `Matched to "${tc.exactMatch}".`,
        [{ text: "Great!" }],
        "success",
      )
      closeAddExerciseModal()
      return
    }
    if (tc.isLikelyTypo && tc.suggestions.length > 0) {
      const top = tc.suggestions[0]
      alert(
        "Did you mean?",
        `"${trimmed}" is similar to "${top.name}".`,
        [
          {
            text: "Use Original",
            style: "cancel",
            onPress: () => {
              addNewExercise(currentDay, selectedPerson, {
                name: trimmed,
                muscleGroup: trimmedMG,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
          },
          {
            text: `Use "${top.name}"`,
            onPress: () => {
              addNewExercise(currentDay, selectedPerson, {
                name: top.name,
                muscleGroup: trimmedMG,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
          },
        ],
        "warning",
      )
      return
    }
    addNewExercise(currentDay, selectedPerson, {
      name: trimmed,
      muscleGroup: trimmedMG,
      sets: setsNum,
    })
    closeAddExerciseModal()
  }

  const handleSuggestionPress = (suggestion, field = "name") => {
    if (showEditNameModal) {
      field === "muscleGroup"
        ? (setNewMuscleGroup(suggestion.name), setMuscleGroupSuggestions([]))
        : (setNewExerciseName(suggestion.name), setNameSuggestions([]))
    } else if (showAddExerciseModal) {
      field === "muscleGroup"
        ? (setNewExercise({ ...newExercise, muscleGroup: suggestion.name }),
          setNewExerciseMuscleGroupSuggestions([]))
        : (setNewExercise({ ...newExercise, name: suggestion.name }),
          setNewExerciseSuggestions([]))
    }
  }

  const handleCompleteWorkout = () => {
    if (isCurrentDayLocked) {
      alert(
        "Day Already Locked",
        "This day has already been completed.",
        [{ text: "OK" }],
        "lock",
      )
      return
    }
    const done = getCompletedSetsCount(),
      total = dayWorkout?.totalSets || 0
    const msg =
      done === total
        ? "Are you sure you want to finish? You've completed all sets!"
        : `You've completed ${done}/${total} sets. End this session? The day will be locked.`
    alert(
      "Complete Workout?",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete & Lock",
          onPress: async () => {
            if (isInJointSession) await leaveJointSession()
            const auto = await endWorkout()
            if (!auto)
              alert(
                "Workout Completed! 💪",
                `Day ${currentDay} is now locked.`,
                [{ text: "OK" }],
                "success",
              )
          },
        },
      ],
      "session",
    )
  }

  const getCompletedSetsCount = () => {
    if (!dayWorkout) return 0
    return dayWorkout.exercises.reduce(
      (n, _, i) => n + getExerciseCompletedSets(currentDay, i),
      0,
    )
  }

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600),
      m = Math.floor((seconds % 3600) / 60),
      s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }
  const formatEndTime = (d) =>
    d
      ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : ""
  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  const isAssistedExercise = (name) => name.toLowerCase().includes("assisted")

  // ── empty states ─────────────────────────────────────────────────────
  if (!workoutData)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyTitle}>No Workout Plan</Text>
        <Text style={styles.emptyText}>
          Go to the Home tab to upload your workout file
        </Text>
      </View>
    )
  if (!selectedPerson)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>No Profile Selected</Text>
        <Text style={styles.emptyText}>
          Go to the Home tab to select your profile
        </Text>
      </View>
    )
  if (!dayWorkout)
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🤷</Text>
        <Text style={styles.emptyTitle}>No Workout for This Day</Text>
        <Text style={styles.emptyText}>
          {selectedPerson} has no exercises scheduled for Day {currentDay}
        </Text>
      </View>
    )

  const completedSetsCount = getCompletedSetsCount()
  const totalSetsCount = dayWorkout.totalSets
  const progressPercentage =
    totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0
  const allSetsComplete = areAllSetsComplete && !isCurrentDayLocked
  const totalSessionTime = getTotalSessionTime()
  const sessionAvgRest = getSessionAverageRestTime(currentDay)
  const estimatedRemaining = getEstimatedTimeRemaining(currentDay)
  const estimatedEnd = getEstimatedEndTime(currentDay)

  // ── Build a fast lookup Set of partner exercise names (lowercase) ──────────
  const partnerParticipant = isInJointSession
    ? jointSession?.participants?.find((p) => p.userId !== user?.id)
    : null

  const partnerNameSet = useMemo(() => {
    if (!isInJointSession) return new Set()

    // Get partner's exercise list from jointSession
    const partnerExerciseNames = jointSession?.participants?.find(
      (p) => p.userId !== user?.id,
    )?.exerciseNames

    if (!partnerExerciseNames?.length) return new Set()

    // Build set of partner exercise names (lowercase)
    const partnerSet = new Set(
      partnerExerciseNames.map((e) =>
        (typeof e === "string" ? e : e.name).trim().toLowerCase(),
      ),
    )

    // Return only MY exercises that match partner
    const myExerciseNames = (dayWorkout?.exercises ?? [])
      .map((ex) => ex.name?.trim().toLowerCase())
      .filter(Boolean)

    return new Set(myExerciseNames.filter((n) => partnerSet.has(n)))
  }, [isInJointSession, jointSession?.participants, dayWorkout])

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.container}>
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

        {/* ── Header card – stats only, NO button inside ── */}
        <View
          style={[
            styles.headerCard,
            allSetsComplete && styles.headerCardComplete,
            isCurrentDayLocked && styles.headerCardLocked,
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.dayNumber}>
                Day {dayWorkout.dayNumber}
                {isCurrentDayLocked && " 🔒"}
              </Text>
            </View>
            <View style={styles.setsInfo}>
              <Text style={styles.setsLabel}>Total Sets</Text>
              <Text style={styles.setsValue}>{dayWorkout.totalSets}</Text>
            </View>
          </View>
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
                estimatedRemaining > 0 &&
                !isCurrentDayLocked && (
                  <Text style={styles.progressText}>
                    ~{formatTime(estimatedRemaining)} left
                  </Text>
                )}
            </View>
            {workoutStartTime &&
              estimatedEnd &&
              estimatedRemaining > 0 &&
              !isCurrentDayLocked && (
                <Text style={styles.endTimeText}>
                  Estimated finish: {formatEndTime(estimatedEnd)}
                </Text>
              )}
          </View>
          {workoutStartTime && !isCurrentDayLocked && sessionStats && (
            <View style={styles.sessionStatsContainer}>
              <View style={styles.sessionStatRow}>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>⏱️ Total Time</Text>
                  <Text style={styles.sessionStatValue}>
                    {formatTime(totalSessionTime)}
                  </Text>
                </View>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>💤 Avg Rest/Set</Text>
                  <Text style={styles.sessionStatValue}>
                    {formatTime(Math.round(sessionAvgRest))}
                  </Text>
                </View>
              </View>
              {getCurrentRestTime() > 0 && (
                <View style={styles.currentRestContainer}>
                  <Text style={styles.currentRestLabel}>
                    Rest since last set:
                  </Text>
                  <Text
                    style={[
                      styles.currentRestValue,
                      getCurrentRestTime() > sessionAvgRest &&
                        styles.currentRestOvertime,
                    ]}
                  >
                    {formatTime(getCurrentRestTime())}
                    {getCurrentRestTime() > sessionAvgRest && (
                      <Text style={styles.overtimeText}>
                        {" "}
                        (+
                        {formatTime(
                          Math.round(getCurrentRestTime() - sessionAvgRest),
                        )}
                        )
                      </Text>
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
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

        <ScrollView
          style={styles.exerciseList}
          contentContainerStyle={styles.exerciseListContent}
        >
          {dayWorkout.exercises.map((exercise, exerciseIndex) => {
            const completedSets = getExerciseCompletedSets(
              currentDay,
              exerciseIndex,
            )
            const allDone = completedSets === exercise.sets
            const isAssisted = isAssistedExercise(exercise.name)

            const exerciseNameLower = exercise.name?.trim().toLowerCase() ?? ""
            const partnerMatchesByName =
              isInJointSession && partnerNameSet.has(exerciseNameLower)

            const partnerActiveNameLower = partnerProgress?.exerciseName
              ?.trim()
              .toLowerCase()
            const partnerOnThis =
              isInJointSession &&
              !!partnerActiveNameLower &&
              partnerMatchesByName &&
              partnerActiveNameLower === exerciseNameLower

            const partnerSetCount = partnerMatchesByName
              ? (() => {
                  const entry = (partnerParticipant?.exerciseNames ?? []).find(
                    (e) =>
                      (typeof e === "string" ? e : e.name)
                        .trim()
                        .toLowerCase() === exerciseNameLower,
                  )
                  return typeof entry === "object"
                    ? (entry?.sets ?? null)
                    : null
                })()
              : null

            return (
              <View
                key={exerciseIndex}
                style={[
                  styles.exerciseCard,
                  allDone && styles.exerciseCardComplete,
                  isCurrentDayLocked && styles.exerciseCardLocked,
                  partnerMatchesByName && styles.exerciseCardShared,
                  partnerOnThis && styles.exerciseCardPartner,
                ]}
              >
                {partnerOnThis && (
                  <PartnerExercisePill username={partnerUsername} />
                )}
                {partnerMatchesByName &&
                  !partnerOnThis &&
                  partnerSetCount !== null && (
                    <PartnerExerciseMatchBadge
                      partnerSets={partnerSetCount}
                      mySets={exercise.sets}
                    />
                  )}

                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <View style={styles.exerciseNameRow}>
                      <Text
                        style={[
                          styles.exerciseName,
                          allDone && styles.exerciseNameComplete,
                        ]}
                      >
                        {exercise.name}
                        {isAssisted && " 🤝"}
                      </Text>
                      {!isCurrentDayLocked && (
                        <TouchableOpacity
                          onPress={() => handleEditExerciseName(exerciseIndex)}
                          style={styles.editButton}
                        >
                          <Text style={styles.editButtonText}>✏️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {exercise.muscleGroup && (
                      <Text style={styles.muscleGroup}>
                        {exercise.muscleGroup}
                      </Text>
                    )}
                  </View>
                  <View style={styles.exerciseProgress}>
                    <Text style={styles.exerciseProgressText}>
                      {completedSets}/{exercise.sets}
                    </Text>
                  </View>
                </View>

                <View style={styles.setsContainer}>
                  {Array.from({ length: exercise.sets }, (_, setIndex) => {
                    const done = isSetComplete(
                      currentDay,
                      exerciseIndex,
                      setIndex,
                    )
                    if (isCurrentDayLocked && !done) return null
                    const setDetails = getSetDetails(
                      currentDay,
                      exerciseIndex,
                      setIndex,
                    )
                    const partnerDoneThisSet =
                      isInJointSession &&
                      partnerCompletedSets.some(
                        (s) =>
                          s.exerciseName?.trim().toLowerCase() ===
                            exerciseNameLower && s.setIndex === setIndex,
                      )
                    const partnerOnSet =
                      partnerOnThis && partnerProgress?.setIndex === setIndex
                    return (
                      <TouchableOpacity
                        key={setIndex}
                        style={[
                          styles.setButton,
                          done && styles.setButtonComplete,
                          isCurrentDayLocked && done && styles.setButtonLocked,
                          setDetails?.isWarmup && styles.setButtonWarmup,
                          partnerDoneThisSet && styles.setButtonPartnerDone,
                          partnerOnSet && styles.setButtonPartner,
                        ]}
                        onPress={() => handleSetPress(exerciseIndex, setIndex)}
                        activeOpacity={isCurrentDayLocked ? 1 : 0.7}
                        disabled={isCurrentDayLocked && !done}
                      >
                        {partnerOnSet && <View style={styles.partnerSetDot} />}
                        <Text
                          style={[
                            styles.setButtonNumber,
                            done && styles.setButtonNumberComplete,
                            isCurrentDayLocked && done && { color: "#333" },
                            setDetails?.isWarmup && styles.warmupText,
                            partnerDoneThisSet && done && { color: "#7c3aed" },
                          ]}
                        >
                          {setDetails?.isWarmup ? "W" : setIndex + 1}
                        </Text>
                        {done && setDetails && (
                          <View style={styles.setDetailsPreview}>
                            <Text
                              style={[
                                styles.setDetailsText,
                                isCurrentDayLocked && { color: "#333" },
                              ]}
                            >
                              {setDetails.weight || 0}kg
                            </Text>
                            <Text
                              style={[
                                styles.setDetailsText,
                                isCurrentDayLocked && { color: "#333" },
                              ]}
                            >
                              ×{setDetails.reps || 0}
                            </Text>
                            {setDetails.note && (
                              <Text style={styles.setNoteIndicator}>📝</Text>
                            )}
                          </View>
                        )}
                        {done && (
                          <View style={styles.setCheckmark}>
                            <Text style={styles.setCheckmarkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                  {!isCurrentDayLocked && (
                    <TouchableOpacity
                      style={styles.addSetButton}
                      onPress={() => handleQuickAddSet(exerciseIndex)}
                      onLongPress={() => handleAddMultipleSets(exerciseIndex)}
                    >
                      <Text style={styles.addSetButtonIcon}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isCurrentDayLocked && (
                  <View style={styles.exerciseHint}>
                    <Text style={styles.exerciseHintText}>
                      Tap + to add 1 set · Long press for multiple
                    </Text>
                  </View>
                )}
              </View>
            )
          })}

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

        {/* ── Complete Session button – floats above the tab bar ── */}
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
                colors={["#667eea", "#764ba2"]}
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

        {/* ── Set Details Modal ── */}
        <ModalSheet
          visible={showSetModal}
          onClose={() => {
            setShowSetModal(false)
            setSelectedSet(null)
            setWeight("")
            setReps("")
            setSetNote("")
            setIsWarmupSet(false)
            setPerformanceHistory(null)
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
                    <Text style={styles.performanceStatValue}>
                      {performanceHistory.last.weight}kg
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
                      {performanceHistory.last.volume}kg
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
                      {performanceHistory.best.weight}kg
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
                      {performanceHistory.best.volume}kg
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
            <Text style={styles.inputLabel}>Weight (kg)</Text>
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
          {selectedSet &&
            dayWorkout.exercises[selectedSet.exerciseIndex] &&
            isAssistedExercise(
              dayWorkout.exercises[selectedSet.exerciseIndex].name,
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

        {/* ── Edit Exercise Modal ── */}
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
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveExerciseName}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </ModalSheet>

        {/* ── Add Sets Modal ── */}
        <ModalSheet
          visible={showAddSetsModal}
          onClose={() => {
            setShowAddSetsModal(false)
            setAddingSetsExercise(null)
            setAdditionalSets("")
          }}
          title='Add Multiple Sets'
          subtitle={
            addingSetsExercise
              ? `Adding sets to: ${addingSetsExercise.exercise.name}`
              : undefined
          }
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

        {/* ── Add New Exercise Modal ── */}
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
              onChangeText={(t) => setNewExercise({ ...newExercise, name: t })}
              placeholder='e.g., Bench Press'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>
          {newExerciseSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseSuggestions.map((s, i) => (
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

        {AlertComponent}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#f5f5f5",
  },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
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
    color: "#fff",
    marginBottom: 2,
  },
  lockedBannerText: { fontSize: 13, color: "#fff", opacity: 0.95 },
  headerCard: {
    backgroundColor: "#667eea",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    paddingBottom: 10,
    paddingTop: 10,
  },
  headerCardComplete: { backgroundColor: "#10b981" },
  headerCardLocked: { backgroundColor: "#6b7280" },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  dayNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  setsInfo: { alignItems: "flex-end" },
  setsLabel: { fontSize: 12, color: "#fff", opacity: 0.8, marginBottom: 2 },
  setsValue: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  progressContainer: { marginTop: 10 },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },
  progressTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: { fontSize: 14, color: "#fff", opacity: 0.9 },
  endTimeText: { fontSize: 12, color: "#fff", opacity: 0.8, marginTop: 4 },
  sessionStatsContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  sessionStatRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  sessionStat: { alignItems: "center" },
  sessionStatLabel: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.9,
    marginBottom: 4,
  },
  sessionStatValue: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  currentRestContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  currentRestLabel: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
    marginRight: 8,
  },
  currentRestValue: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  currentRestOvertime: { color: "#fbbf24" },
  overtimeText: { fontSize: 14, color: "#fbbf24" },
  completeMessage: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  completeMessageText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  exerciseList: { flex: 1 },
  exerciseListContent: { padding: 15, paddingBottom: 140 },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  exerciseCardComplete: { backgroundColor: "#f0fff4", borderColor: "#10b981" },
  exerciseCardLocked: { backgroundColor: "#f9fafb", borderColor: "#d1d5db" },
  exerciseCardShared: { borderColor: "#f59e0b", backgroundColor: "#fffbeb" },
  exerciseCardPartner: { borderColor: "#7c3aed", backgroundColor: "#faf5ff" },
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
    color: "#333",
    marginBottom: 4,
    flex: 1,
  },
  exerciseNameComplete: { color: "#10b981" },
  editButton: { padding: 4 },
  editButtonText: { fontSize: 16 },
  muscleGroup: { fontSize: 14, color: "#666" },
  exerciseProgress: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  exerciseProgressText: { fontSize: 14, fontWeight: "600", color: "#667eea" },
  setsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  setButton: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: 4,
  },
  setButtonComplete: { backgroundColor: "#667eea", borderColor: "#667eea" },
  setButtonLocked: { backgroundColor: "#ff9800", borderColor: "#d97706" },
  setButtonWarmup: { backgroundColor: "#fb923c", borderColor: "#ea580c" },
  setButtonPartner: {
    borderColor: "#7c3aed",
    borderWidth: 3,
    backgroundColor: "#ede9fe",
  },
  setButtonPartnerDone: {
    borderColor: "#a78bfa",
    borderWidth: 2,
  },
  partnerSetDot: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#7c3aed",
    borderWidth: 2,
    borderColor: "#fff",
  },
  setButtonNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 2,
  },
  setButtonNumberComplete: { color: "#fff" },
  warmupText: { fontSize: 14 },
  setDetailsPreview: { alignItems: "center" },
  setDetailsText: { fontSize: 10, color: "#fff", fontWeight: "500" },
  setNoteIndicator: { fontSize: 10, marginTop: 2 },
  setCheckmark: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  setCheckmarkText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  addSetButton: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#f0f3ff",
    borderWidth: 2,
    borderColor: "#667eea",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButtonIcon: { fontSize: 32, fontWeight: "bold", color: "#667eea" },
  exerciseHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  exerciseHintText: { fontSize: 12, color: "#999", fontStyle: "italic" },
  addExerciseButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#667eea",
    borderStyle: "dashed",
  },
  addExerciseButtonIcon: { fontSize: 32, marginBottom: 8 },
  addExerciseButtonText: { fontSize: 16, fontWeight: "600", color: "#667eea" },
  // ── Complete Session button ──
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
    shadowColor: "#667eea",
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
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  // ── Modals ──
  warmupToggle: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  warmupToggleActive: { backgroundColor: "#fff7ed", borderColor: "#fb923c" },
  warmupToggleText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "500",
  },
  warmupToggleTextActive: { color: "#ea580c", fontWeight: "600" },
  performanceSection: { marginBottom: 20 },
  performanceSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  performanceCard: {
    backgroundColor: "#f0f3ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#667eea",
  },
  bestPerformanceCard: { backgroundColor: "#fff7ed", borderColor: "#f59e0b" },
  performanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  performanceCardTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  performanceCardDate: { fontSize: 12, color: "#666" },
  performanceStats: { flexDirection: "row", justifyContent: "space-around" },
  performanceStat: { alignItems: "center" },
  performanceStatValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#667eea",
    marginBottom: 4,
  },
  bestStatValue: { color: "#f59e0b" },
  performanceStatLabel: { fontSize: 12, color: "#666" },
  performanceTotalAttempts: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },
  historyLoading: { padding: 20, alignItems: "center" },
  historyLoadingText: { fontSize: 14, color: "#999" },
  noHistoryContainer: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 20,
  },
  noHistoryText: { fontSize: 14, color: "#999", fontStyle: "italic" },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#333",
    borderWidth: 2,
    borderColor: "#e0e0e0",
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
  assistedInfoText: { fontSize: 14, color: "#1e40af", textAlign: "center" },
  saveButton: {
    backgroundColor: "#667eea",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  suggestionsContainer: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 12,
  },
  suggestionButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  suggestionText: { fontSize: 16, fontWeight: "500", color: "#333", flex: 1 },
  suggestionMatch: { fontSize: 12, color: "#92400e", fontWeight: "600" },
})
