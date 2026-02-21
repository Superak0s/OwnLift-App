import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  getAllExerciseNames,
  getAllMuscleGroups,
  checkForTypo,
  checkMuscleGroupForTypo,
  getCanonicalName,
} from "../utils/exerciseMatching"
import ModalSheet from "../components/ModalSheet"

export default function WorkoutScreen() {
  const {
    workoutData,
    selectedPerson,
    currentDay,
    completedDays,
    saveSetDetails,
    deleteSetDetails,
    isSetComplete,
    getSetDetails,
    getExerciseCompletedSets,
    isDayComplete,
    isDayLocked,
    getEstimatedTimeRemaining,
    getEstimatedEndTime,
    workoutStartTime,
    endWorkout,
    updateExerciseName,
    addExtraSetsToExercise,
    addNewExercise,
    lastActivityTime,
    getSessionAverageRestTime,
    getTotalSessionTime,
    getCurrentRestTime,
    getSessionStats,
  } = useWorkout()

  const [showSetModal, setShowSetModal] = useState(false)
  const [selectedSet, setSelectedSet] = useState(null)
  const [weight, setWeight] = useState("")
  const [reps, setReps] = useState("")
  const [performanceHistory, setPerformanceHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [setNote, setSetNote] = useState("")
  const [isWarmupSet, setIsWarmupSet] = useState(false)
  const [assistedWeight, setAssistedWeight] = useState("")

  // Exercise management modals
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

  // Session stats tracking
  const [currentRestTimer, setCurrentRestTimer] = useState(0)
  const [sessionStats, setSessionStats] = useState(null)

  // Get all unique exercise names and muscle groups for matching
  const allExerciseNames = getAllExerciseNames(workoutData, selectedPerson)
  const allMuscleGroups = getAllMuscleGroups(workoutData, selectedPerson)

  // Check if current day is locked
  const isCurrentDayLocked = isDayLocked(currentDay)
  // Check if all sets are actually completed
  const areAllSetsComplete = isDayComplete(currentDay)

  // Get current day's workout
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

  // Update session stats every second
  useEffect(() => {
    if (!workoutStartTime || isCurrentDayLocked) return

    const interval = setInterval(() => {
      const stats = getSessionStats(currentDay)
      setSessionStats(stats)

      const currentRest = getCurrentRestTime()
      setCurrentRestTimer(currentRest)
    }, 1000)

    return () => clearInterval(interval)
  }, [workoutStartTime, isCurrentDayLocked, currentDay])

  // Load performance history when set modal opens
  useEffect(() => {
    if (showSetModal && selectedSet) {
      loadPerformanceHistory()
    }
  }, [showSetModal, selectedSet])

  // Check exercise name for suggestions when editing
  useEffect(() => {
    if (showEditNameModal && newExerciseName.trim()) {
      const typoCheck = checkForTypo(newExerciseName, allExerciseNames)
      setNameSuggestions(
        typoCheck.suggestions.length > 0 ? typoCheck.suggestions : [],
      )
    } else {
      setNameSuggestions([])
    }
  }, [newExerciseName, showEditNameModal])

  // Check muscle group for suggestions when editing
  useEffect(() => {
    if (showEditNameModal && newMuscleGroup.trim()) {
      const typoCheck = checkMuscleGroupForTypo(newMuscleGroup, allMuscleGroups)
      setMuscleGroupSuggestions(
        typoCheck.suggestions.length > 0 ? typoCheck.suggestions : [],
      )
    } else {
      setMuscleGroupSuggestions([])
    }
  }, [newMuscleGroup, showEditNameModal])

  // Check new exercise name for suggestions
  useEffect(() => {
    if (showAddExerciseModal && newExercise.name.trim()) {
      const typoCheck = checkForTypo(newExercise.name, allExerciseNames)
      setNewExerciseSuggestions(
        typoCheck.suggestions.length > 0 ? typoCheck.suggestions : [],
      )
    } else {
      setNewExerciseSuggestions([])
    }
  }, [newExercise.name, showAddExerciseModal])

  // Check new exercise muscle group for suggestions
  useEffect(() => {
    if (showAddExerciseModal && newExercise.muscleGroup.trim()) {
      const typoCheck = checkMuscleGroupForTypo(
        newExercise.muscleGroup,
        allMuscleGroups,
      )
      setNewExerciseMuscleGroupSuggestions(
        typoCheck.suggestions.length > 0 ? typoCheck.suggestions : [],
      )
    } else {
      setNewExerciseMuscleGroupSuggestions([])
    }
  }, [newExercise.muscleGroup, showAddExerciseModal])

  // Check for session auto-completion on mount
  useEffect(() => {
    const checkAutoCompletion = async () => {
      if (isDayLocked(currentDay) && workoutStartTime && lastActivityTime) {
        const now = Date.now()
        const lastActivity = new Date(lastActivityTime).getTime()
        const timeSinceLastActivity = now - lastActivity
        const INACTIVITY_TIMEOUT = 30 * 60 * 1000

        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
          Alert.alert(
            "Session Auto-Completed",
            "Your workout session was automatically completed due to 30 minutes of inactivity. The day has been locked.",
            [{ text: "OK" }],
          )
        }
      }
    }

    checkAutoCompletion()
  }, [])

  const loadPerformanceHistory = async () => {
    if (!selectedSet || !dayWorkout) return

    setLoadingHistory(true)
    try {
      const exercise = dayWorkout.exercises[selectedSet.exerciseIndex]
      const exerciseName = exercise.name
      const canonicalName = getCanonicalName(exerciseName, allExerciseNames)

      const exerciseHistory = []

      Object.keys(completedDays).forEach((dayNumber) => {
        const day = workoutData.days.find(
          (d) => d.dayNumber === parseInt(dayNumber),
        )
        if (!day) return

        const personWorkout = day.people[selectedPerson]
        if (!personWorkout?.exercises) return

        personWorkout.exercises.forEach((ex, exerciseIndex) => {
          const exName = getCanonicalName(ex.name, allExerciseNames)
          if (exName.toLowerCase() !== canonicalName.toLowerCase()) return

          const exerciseSets = completedDays[dayNumber]?.[exerciseIndex]
          if (!exerciseSets) return

          Object.keys(exerciseSets).forEach((setIndex) => {
            const setData = exerciseSets[setIndex]
            const rawWeight = setData.weight ?? 0
            const rawReps = setData.reps ?? 0

            exerciseHistory.push({
              date: new Date(setData.completedAt),
              weight: isFinite(rawWeight) ? rawWeight : 0,
              reps: isFinite(rawReps) ? rawReps : 0,
              volume: isFinite(rawWeight * rawReps) ? rawWeight * rawReps : 0,
              setIndex: parseInt(setIndex),
              dayNumber: parseInt(dayNumber),
              note: setData.note || "",
              isWarmup: setData.isWarmup || false,
            })
          })
        })
      })

      if (exerciseHistory.length === 0) {
        setPerformanceHistory(null)
        return
      }

      const todayMidnight = new Date()
      todayMidnight.setHours(0, 0, 0, 0)

      const previousHistory = exerciseHistory.filter(
        (entry) => entry.date < todayMidnight && !entry.isWarmup,
      )

      if (previousHistory.length === 0) {
        setPerformanceHistory(null)
        return
      }

      previousHistory.sort((a, b) => b.date - a.date)

      const lastPerformance = previousHistory[0]

      const bestPerformance = previousHistory.reduce((best, current) => {
        return current.volume > best.volume ? current : best
      }, previousHistory[0])

      setPerformanceHistory({
        last: lastPerformance,
        best: bestPerformance,
        totalAttempts: previousHistory.length,
      })
    } catch (error) {
      console.error("Error loading performance history:", error)
      setPerformanceHistory(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSetPress = (exerciseIndex, setIndex) => {
    if (isCurrentDayLocked) {
      Alert.alert(
        "Day Locked",
        "This day has been completed and is now locked. You can view the details but cannot make changes. Please select a different day to continue your workout.",
        [{ text: "OK" }],
      )
      return
    }

    const existingDetails = getSetDetails(currentDay, exerciseIndex, setIndex)
    const exercise = dayWorkout.exercises[exerciseIndex]

    if (existingDetails) {
      let detailsMessage = `Weight: ${existingDetails.weight || 0} kg\nReps: ${existingDetails.reps || 0}`

      if (existingDetails.isWarmup) {
        detailsMessage = `🔥 WARM-UP SET\n${detailsMessage}`
      }

      if (existingDetails.note) {
        detailsMessage += `\n\nNote: ${existingDetails.note}`
      }

      Alert.alert("Set Completed", detailsMessage, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => {
            setSelectedSet({ exerciseIndex, setIndex })
            setWeight(existingDetails.weight?.toString() || "")
            setReps(existingDetails.reps?.toString() || "")
            setSetNote(existingDetails.note || "")
            setIsWarmupSet(existingDetails.isWarmup || false)
            setAssistedWeight("")
            setShowSetModal(true)
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSetDetails(currentDay, exerciseIndex, setIndex),
        },
      ])
    } else {
      setSelectedSet({ exerciseIndex, setIndex })
      setWeight("")
      setReps("")
      setSetNote("")
      setIsWarmupSet(false)
      setShowSetModal(true)
    }
  }

  const handleSaveSetDetails = () => {
    if (!selectedSet) return

    const weightValue = parseFloat(weight) || 0
    const repsValue = parseInt(reps) || 0

    if (weightValue === 0 || repsValue === 0) {
      Alert.alert(
        "Invalid Set",
        "Please enter a weight and reps greater than 0 before saving.",
        [{ text: "OK" }],
      )
      return
    }

    saveSetDetails(
      currentDay,
      selectedSet.exerciseIndex,
      selectedSet.setIndex,
      weightValue,
      repsValue,
      setNote.trim(),
      isWarmupSet,
    )

    setShowSetModal(false)
    setSelectedSet(null)
    setWeight("")
    setReps("")
    setSetNote("")
    setIsWarmupSet(false)
    setPerformanceHistory(null)
  }

  const handleEditExerciseName = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      Alert.alert("Day Locked", "Cannot edit exercises on a locked day.")
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
      Alert.alert("Error", "Exercise name cannot be empty")
      return
    }

    const trimmedName = newExerciseName.trim()
    const trimmedMuscleGroup = newMuscleGroup.trim()
    const typoCheck = checkForTypo(trimmedName, allExerciseNames)

    if (typoCheck.exactMatch) {
      updateExerciseName(
        currentDay,
        selectedPerson,
        editingExercise.index,
        typoCheck.exactMatch,
        trimmedMuscleGroup,
      )
      Alert.alert(
        "Exercise Matched! 🎯",
        `This exercise matches "${typoCheck.exactMatch}". Historical data will be loaded automatically.`,
        [{ text: "Great!" }],
      )
      closeEditModal()
    } else if (typoCheck.isLikelyTypo && typoCheck.suggestions.length > 0) {
      const topSuggestion = typoCheck.suggestions[0]
      Alert.alert(
        "Did you mean?",
        `The exercise name "${trimmedName}" is similar to "${topSuggestion.name}". Would you like to use that instead? This will load historical data for that exercise.`,
        [
          {
            text: "Use Original",
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedPerson,
                editingExercise.index,
                trimmedName,
                trimmedMuscleGroup,
              )
              closeEditModal()
            },
          },
          {
            text: `Use "${topSuggestion.name}"`,
            onPress: () => {
              updateExerciseName(
                currentDay,
                selectedPerson,
                editingExercise.index,
                topSuggestion.name,
                trimmedMuscleGroup,
              )
              closeEditModal()
            },
            style: "default",
          },
        ],
      )
      return
    } else {
      updateExerciseName(
        currentDay,
        selectedPerson,
        editingExercise.index,
        trimmedName,
        trimmedMuscleGroup,
      )
      closeEditModal()
    }
  }

  const handleQuickAddSet = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      Alert.alert("Day Locked", "Cannot add sets to a locked day.")
      return
    }

    addExtraSetsToExercise(currentDay, selectedPerson, exerciseIndex, 1)
  }

  const handleAddMultipleSets = (exerciseIndex) => {
    if (isCurrentDayLocked) {
      Alert.alert("Day Locked", "Cannot add sets to a locked day.")
      return
    }

    const exercise = dayWorkout.exercises[exerciseIndex]
    setAddingSetsExercise({ index: exerciseIndex, exercise })
    setAdditionalSets("")
    setShowAddSetsModal(true)
  }

  const handleSaveAdditionalSets = () => {
    if (!addingSetsExercise) return

    const sets = parseInt(additionalSets)
    if (isNaN(sets) || sets < 1) {
      Alert.alert("Error", "Please enter a valid number of sets (minimum 1)")
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
      Alert.alert("Day Locked", "Cannot add exercises to a locked day.")
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
      Alert.alert("Error", "Exercise name is required")
      return
    }

    const setsNum = parseInt(sets)
    if (isNaN(setsNum) || setsNum < 1) {
      Alert.alert("Error", "Please enter a valid number of sets (minimum 1)")
      return
    }

    const trimmedName = name.trim()
    const trimmedMuscleGroup = muscleGroup.trim()
    const typoCheck = checkForTypo(trimmedName, allExerciseNames)

    if (typoCheck.exactMatch) {
      addNewExercise(currentDay, selectedPerson, {
        name: typoCheck.exactMatch,
        muscleGroup: trimmedMuscleGroup,
        sets: setsNum,
      })
      Alert.alert(
        "Exercise Matched! 🎯",
        `This exercise matches "${typoCheck.exactMatch}". Historical data will be loaded automatically.`,
        [{ text: "Great!" }],
      )
      closeAddExerciseModal()
      return
    }

    if (typoCheck.isLikelyTypo && typoCheck.suggestions.length > 0) {
      const topSuggestion = typoCheck.suggestions[0]
      Alert.alert(
        "Did you mean?",
        `The exercise name "${trimmedName}" is similar to "${topSuggestion.name}". Would you like to use that instead? This will load historical data for that exercise.`,
        [
          {
            text: "Use Original",
            onPress: () => {
              addNewExercise(currentDay, selectedPerson, {
                name: trimmedName,
                muscleGroup: trimmedMuscleGroup,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
          },
          {
            text: `Use "${topSuggestion.name}"`,
            onPress: () => {
              addNewExercise(currentDay, selectedPerson, {
                name: topSuggestion.name,
                muscleGroup: trimmedMuscleGroup,
                sets: setsNum,
              })
              closeAddExerciseModal()
            },
            style: "default",
          },
        ],
      )
      return
    }

    addNewExercise(currentDay, selectedPerson, {
      name: trimmedName,
      muscleGroup: trimmedMuscleGroup,
      sets: setsNum,
    })
    closeAddExerciseModal()
  }

  const handleSuggestionPress = (suggestion, field = "name") => {
    if (showEditNameModal) {
      if (field === "muscleGroup") {
        setNewMuscleGroup(suggestion.name)
        setMuscleGroupSuggestions([])
      } else {
        setNewExerciseName(suggestion.name)
        setNameSuggestions([])
      }
    } else if (showAddExerciseModal) {
      if (field === "muscleGroup") {
        setNewExercise({ ...newExercise, muscleGroup: suggestion.name })
        setNewExerciseMuscleGroupSuggestions([])
      } else {
        setNewExercise({ ...newExercise, name: suggestion.name })
        setNewExerciseSuggestions([])
      }
    }
  }

  const handleCompleteWorkout = () => {
    if (isCurrentDayLocked) {
      Alert.alert(
        "Day Already Locked",
        "This day has already been completed and locked.",
        [{ text: "OK" }],
      )
      return
    }

    const completedSetsCount = getCompletedSetsCount()
    const totalSetsCount = dayWorkout?.totalSets || 0
    const allSetsComplete = completedSetsCount === totalSetsCount

    const message = allSetsComplete
      ? "Are you sure you want to finish this workout session? You've completed all sets!"
      : `You've completed ${completedSetsCount} out of ${totalSetsCount} sets. Are you sure you want to end this workout session? This day will be locked and you won't be able to add more sets.`

    Alert.alert("Complete Workout?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete & Lock",
        onPress: async () => {
          const wasAutoCompleted = await endWorkout()
          if (!wasAutoCompleted) {
            Alert.alert(
              "Workout Completed! 💪",
              `Day ${currentDay} is now locked. You can view it anytime, but you won't be able to make changes until the Monday reset.`,
              [{ text: "OK" }],
            )
          }
        },
      },
    ])
  }

  const getCompletedSetsCount = () => {
    if (!dayWorkout) return 0
    let count = 0
    dayWorkout.exercises.forEach((exercise, exerciseIndex) => {
      count += getExerciseCompletedSets(currentDay, exerciseIndex)
    })
    return count
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const formatEndTime = (date) => {
    if (!date) return ""
    const hours = date.getHours()
    const minutes = date.getMinutes()
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (!workoutData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyTitle}>No Workout Plan</Text>
        <Text style={styles.emptyText}>
          Go to the Home tab to upload your workout file
        </Text>
      </View>
    )
  }

  if (!selectedPerson) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>No Profile Selected</Text>
        <Text style={styles.emptyText}>
          Go to the Home tab to select your profile
        </Text>
      </View>
    )
  }

  if (!dayWorkout) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🤷</Text>
        <Text style={styles.emptyTitle}>No Workout for This Day</Text>
        <Text style={styles.emptyText}>
          {selectedPerson} has no exercises scheduled for Day {currentDay}
        </Text>
      </View>
    )
  }

  const completedSetsCount = getCompletedSetsCount()
  const totalSetsCount = dayWorkout.totalSets
  const progressPercentage =
    totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0
  const allSetsComplete = areAllSetsComplete && !isCurrentDayLocked

  const totalSessionTime = getTotalSessionTime()
  const currentRestTime = getCurrentRestTime()
  const sessionAvgRest = getSessionAverageRestTime(currentDay)

  const estimatedTimeRemaining = getEstimatedTimeRemaining(currentDay)
  const estimatedEndTime = getEstimatedEndTime(currentDay)

  const isAssistedExercise = (exerciseName) =>
    exerciseName.toLowerCase().includes("assisted")

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.container}>
        {/* Locked Banner */}
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

        {/* Header Card */}
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

          {/* Progress Bar */}
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
                estimatedTimeRemaining > 0 &&
                !isCurrentDayLocked && (
                  <Text style={styles.progressText}>
                    ~{formatTime(estimatedTimeRemaining)} left
                  </Text>
                )}
            </View>
            {workoutStartTime &&
              estimatedEndTime &&
              estimatedTimeRemaining > 0 &&
              !isCurrentDayLocked && (
                <Text style={styles.endTimeText}>
                  Estimated finish: {formatEndTime(estimatedEndTime)}
                </Text>
              )}
          </View>

          {/* Session Stats */}
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
              {currentRestTime > 0 && (
                <View style={styles.currentRestContainer}>
                  <Text style={styles.currentRestLabel}>
                    Rest since last set:
                  </Text>
                  <Text
                    style={[
                      styles.currentRestValue,
                      currentRestTime > sessionAvgRest &&
                        styles.currentRestOvertime,
                    ]}
                  >
                    {formatTime(currentRestTime)}
                    {currentRestTime > sessionAvgRest && (
                      <Text style={styles.overtimeText}>
                        {" "}
                        (+
                        {formatTime(
                          Math.round(currentRestTime - sessionAvgRest),
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

        {/* Exercise List */}
        <ScrollView
          style={styles.exerciseList}
          contentContainerStyle={styles.exerciseListContent}
        >
          {dayWorkout.exercises.map((exercise, exerciseIndex) => {
            const completedSets = getExerciseCompletedSets(
              currentDay,
              exerciseIndex,
            )
            const allSetsComplete = completedSets === exercise.sets
            const isAssisted = isAssistedExercise(exercise.name)

            return (
              <View
                key={exerciseIndex}
                style={[
                  styles.exerciseCard,
                  allSetsComplete && styles.exerciseCardComplete,
                  isCurrentDayLocked && styles.exerciseCardLocked,
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <View style={styles.exerciseNameRow}>
                      <Text
                        style={[
                          styles.exerciseName,
                          allSetsComplete && styles.exerciseNameComplete,
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

                {/* Sets */}
                <View style={styles.setsContainer}>
                  {Array.from({ length: exercise.sets }, (_, setIndex) => {
                    const isCompleted = isSetComplete(
                      currentDay,
                      exerciseIndex,
                      setIndex,
                    )
                    if (isCurrentDayLocked && !isCompleted) return null

                    const setDetails = getSetDetails(
                      currentDay,
                      exerciseIndex,
                      setIndex,
                    )

                    return (
                      <TouchableOpacity
                        key={setIndex}
                        style={[
                          styles.setButton,
                          isCompleted && styles.setButtonComplete,
                          isCurrentDayLocked &&
                            isCompleted &&
                            styles.setButtonLocked,
                          setDetails?.isWarmup && styles.setButtonWarmup,
                        ]}
                        onPress={() => handleSetPress(exerciseIndex, setIndex)}
                        activeOpacity={isCurrentDayLocked ? 1 : 0.7}
                        disabled={isCurrentDayLocked && !isCompleted}
                      >
                        <Text
                          style={[
                            styles.setButtonNumber,
                            isCompleted && styles.setButtonNumberComplete,
                            isCurrentDayLocked && isCompleted
                              ? { color: "#333" }
                              : null,
                            setDetails?.isWarmup && styles.warmupText,
                          ]}
                        >
                          {setDetails?.isWarmup ? "W" : setIndex + 1}
                        </Text>

                        {isCompleted && setDetails && (
                          <View style={styles.setDetailsPreview}>
                            <Text
                              style={[
                                styles.setDetailsText,
                                isCurrentDayLocked ? { color: "#333" } : null,
                              ]}
                            >
                              {setDetails.weight || 0}kg
                            </Text>
                            <Text
                              style={[
                                styles.setDetailsText,
                                isCurrentDayLocked ? { color: "#333" } : null,
                              ]}
                            >
                              ×{setDetails.reps || 0}
                            </Text>
                            {setDetails.note && (
                              <Text style={styles.setNoteIndicator}>📝</Text>
                            )}
                          </View>
                        )}

                        {isCompleted && (
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
                      Tap + to add 1 set • Long press for multiple
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

        {/* Complete Workout Button */}
        {workoutStartTime && !isCurrentDayLocked && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.completeWorkoutButton}
              onPress={handleCompleteWorkout}
            >
              <Text style={styles.completeWorkoutButtonText}>
                Complete Workout Session
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Set Details Modal ─────────────────────────────────────────── */}
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
          {/* Warm-up Toggle */}
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

          {/* Performance History */}
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

          {/* Input Fields */}
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

          {/* Assisted Exercise Info */}
          {selectedSet &&
            dayWorkout.exercises[selectedSet.exerciseIndex] &&
            isAssistedExercise(
              dayWorkout.exercises[selectedSet.exerciseIndex].name,
            ) && (
              <View style={styles.assistedInfoBox}>
                <Text style={styles.assistedInfoText}>
                  🤝 Assisted Exercise - For assisted exercises, "Weight"
                  represents the assistance/counterweight from the machine.
                  Lower weight = more difficult.
                </Text>
              </View>
            )}

          {/* Set Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={setNote}
              onChangeText={setSetNote}
              placeholder='e.g., felt strong, use lighter next time'
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

        {/* ── Edit Exercise Modal ───────────────────────────────────────── */}
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
              {nameSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(suggestion, "name")}
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(suggestion.similarity * 100)}% match
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
              {muscleGroupSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() =>
                    handleSuggestionPress(suggestion, "muscleGroup")
                  }
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(suggestion.similarity * 100)}% match
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

        {/* ── Add Sets Modal ────────────────────────────────────────────── */}
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

        {/* ── Add New Exercise Modal ────────────────────────────────────── */}
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
              onChangeText={(text) =>
                setNewExercise({ ...newExercise, name: text })
              }
              placeholder='e.g., Bench Press'
              placeholderTextColor='#999'
              autoFocus={true}
            />
          </View>

          {newExerciseSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(suggestion, "name")}
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(suggestion.similarity * 100)}% match
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
              onChangeText={(text) =>
                setNewExercise({ ...newExercise, muscleGroup: text })
              }
              placeholder='e.g., Chest'
              placeholderTextColor='#999'
            />
          </View>

          {newExerciseMuscleGroupSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Did you mean:</Text>
              {newExerciseMuscleGroupSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() =>
                    handleSuggestionPress(suggestion, "muscleGroup")
                  }
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMatch}>
                    {Math.round(suggestion.similarity * 100)}% match
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
              onChangeText={(text) =>
                setNewExercise({ ...newExercise, sets: text })
              }
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
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
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
    backgroundColor: "rgba(255, 255, 255, 0.3)",
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
    backgroundColor: "rgba(255, 255, 255, 0.15)",
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
    borderTopColor: "rgba(255, 255, 255, 0.2)",
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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
  bottomActions: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  completeWorkoutButton: {
    backgroundColor: "#667eea",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  completeWorkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Modal content styles (used inside ModalSheet children)
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
