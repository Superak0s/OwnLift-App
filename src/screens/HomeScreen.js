import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  RefreshControl,
} from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import { workoutApi, programApi } from "../services/api"
import { SafeAreaView } from "react-native-safe-area-context"
import UniversalCalendar from "../components/UniversalCalendar"
import ModalSheet from "../components/ModalSheet"

export default function HomeScreen({ navigation }) {
  const {
    workoutData,
    selectedPerson,
    currentDay,
    saveWorkoutData,
    saveSelectedPerson,
    saveCurrentDay,
    isDayLocked,
    fetchSessionHistory,
    hasActiveSession,
  } = useWorkout()
  const [isUploading, setIsUploading] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [sessionHistory, setSessionHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const toLocalDateStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  useEffect(() => {
    if (selectedPerson) {
      loadSessionHistory().catch((error) => {
        if (error.message === "SESSION_EXPIRED") {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again.",
            [
              {
                text: "OK",
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                },
              },
            ],
          )
        }
      })
    }
  }, [selectedPerson])

  useEffect(() => {
    const restoreProgram = async () => {
      if (workoutData) return

      try {
        const saved = await programApi.fetchSavedProgram()
        if (saved && saved.success) {
          await saveWorkoutData(saved)
        }
      } catch (error) {
        if (error.message === "SESSION_EXPIRED") {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] })
        }
      }
    }

    restoreProgram()
  }, [])

  const loadSessionHistory = async () => {
    setLoadingHistory(true)
    try {
      const limit = 60
      const sessions = await fetchSessionHistory(limit)
      setSessionHistory(sessions)
    } catch (error) {
      if (error.message === "SESSION_EXPIRED") {
        throw error
      }
    } finally {
      setLoadingHistory(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await loadSessionHistory()
    } catch (error) {
      if (error.message === "SESSION_EXPIRED") {
        throw error
      } else {
        Alert.alert("Error", "Failed to refresh session history")
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleUploadFile = async () => {
    try {
      setIsUploading(true)

      const fileUri = await workoutApi.pickWorkoutFile()
      if (!fileUri) {
        setIsUploading(false)
        return
      }

      const data = await programApi.uploadAndSave(fileUri)

      if (data.success) {
        await saveWorkoutData(data)
        Alert.alert(
          "Success!",
          `Loaded ${data.totalDays} workout days for ${data.people.join(", ")}`,
          [{ text: "OK" }],
        )
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to upload workout file")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectPerson = (person) => {
    saveSelectedPerson(person)
    Alert.alert("Success", `Selected ${person}'s workout plan`)
  }

  const handleSelectDay = (day) => {
    if (hasActiveSession()) {
      Alert.alert(
        "Active Workout Session",
        "You have an active workout session in progress. Please complete or end your current workout before selecting a different day.",
        [{ text: "OK" }],
      )
      return
    }

    if (isDayLocked(day)) {
      Alert.alert(
        "View Locked Day",
        `Day ${day} has been completed and locked this week. You can view the workout details but cannot make changes.\n\nSelect this day to view it in read-only mode.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Day",
            onPress: () => {
              saveCurrentDay(day)
              setShowDayPicker(false)
            },
          },
        ],
      )
      return
    }

    saveCurrentDay(day)
    setShowDayPicker(false)
  }

  const handleDatePress = (date) => {
    const sessionsOnDate = getSessionsForDate(date)
    if (sessionsOnDate.length > 0) {
      setSelectedDate(date)
    }
  }

  const handleSessionPress = async (session) => {
    try {
      const details = await workoutApi.getSession(session.id)

      if (details.set_timings && details.set_timings.length > 0) {
        // Group by exercise_name (stable string) instead of the old
        // exercise_index (positional integer that no longer exists).
        const exerciseMap = new Map()

        details.set_timings.forEach((timing) => {
          const key =
            timing.exercise_name || `Exercise ${timing.exercise_id ?? "?"}`
          if (!exerciseMap.has(key)) {
            exerciseMap.set(key, {
              exerciseName: key,
              sets: [],
            })
          }
          exerciseMap.get(key).sets.push(timing)
        })

        exerciseMap.forEach((exercise) => {
          exercise.sets.sort((a, b) => a.set_index - b.set_index)
        })

        // Preserve insertion order (server already orders by name, set_index)
        details.groupedExercises = Array.from(exerciseMap.values())
      } else {
        details.groupedExercises = []
      }

      setSelectedSession(details)
      setShowSessionDetails(true)
      setSelectedDate(null)
    } catch (error) {
      Alert.alert("Error", "Failed to load session details")
    }
  }

  const getPersonWorkoutSummary = (person) => {
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

  const getDayTitle = (dayNumber) => {
    const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
    return day?.muscleGroups?.join("/") || `Day ${dayNumber}`
  }

  const getSessionTitle = (session) => {
    if (!session?.day_title) return `Day ${session?.day_number ?? ""}`
    const parts = session.day_title.split("—")
    return parts.length > 1 ? parts[1].trim() : session.day_title
  }

  const getSessionsForDate = (date) => {
    const targetStr = toLocalDateStr(date) // reuse the helper from UniversalCalendar logic

    return sessionHistory.filter((session) => {
      const sessionDateStr = String(session.start_time)
        .replace("T", " ")
        .split(" ")[0]
      return sessionDateStr === targetStr
    })
  }

  const hasSessionOnDate = (date) => {
    return getSessionsForDate(date).length > 0
  }

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (seconds) => {
    if (!seconds) return "N/A"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    if (seconds >= 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`
    }
    return `${seconds}s`
  }

  const formatSessionTime = (dateString) => {
    if (!dateString) return ""
    // Extract HH:MM directly from the string to avoid timezone conversion
    // Works for both "2026-02-19 18:44:58" and "2026-02-19T18:44:58"
    const timePart = String(dateString).replace("T", " ").split(" ")[1] || ""
    const [hourStr, minuteStr] = timePart.split(":")
    const hour = parseInt(hourStr)
    const minute = minuteStr || "00"
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minute} ${ampm}`
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#667eea"]}
            tintColor='#667eea'
            title='Pull to refresh'
            titleColor='#667eea'
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>💪 Workout Tracker</Text>
            <Text style={styles.subtitle}>
              Upload your workout plan and get started
            </Text>
          </View>

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

          {workoutData && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📊 Workout Plan Loaded</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Days:</Text>
                <Text style={styles.summaryValue}>{workoutData.totalDays}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>People:</Text>
                <Text style={styles.summaryValue}>
                  {workoutData.people.join(", ")}
                </Text>
              </View>
            </View>
          )}

          {workoutData && workoutData.people && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Profile</Text>
              {workoutData.people.map((person) => {
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
                          {summary.totalDays} workout days
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

          {selectedPerson && workoutData && (
            <View
              style={[
                styles.currentDayCard,
                isDayLocked(currentDay) && styles.currentDayCardLocked,
              ]}
            >
              <Text style={styles.currentDayTitle}>
                {isDayLocked(currentDay)
                  ? "🔒 Current Workout (Locked)"
                  : "🎯 Current Workout"}
              </Text>
              <Text style={styles.currentDayText}>
                Day {currentDay} - {getDayTitle(currentDay)}
              </Text>
              {isDayLocked(currentDay) && (
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>✓ Locked</Text>
                </View>
              )}
              {!isDayLocked(currentDay) && (
                <View style={styles.completeBadge}>
                  <Text style={styles.completeBadgeText}>In Progress</Text>
                </View>
              )}
              <View style={styles.dayActions}>
                <TouchableOpacity
                  style={[
                    styles.changeDayButton,
                    hasActiveSession() && styles.changeDayButtonDisabled,
                  ]}
                  onPress={() => setShowDayPicker(true)}
                >
                  <Text style={styles.changeDayButtonText}>
                    {hasActiveSession() ? "🔒 Session Active" : "📅 Change Day"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.goToWorkoutButton,
                    isDayLocked(currentDay) && styles.goToWorkoutButtonLocked,
                  ]}
                  onPress={() => navigation.navigate("Workout")}
                >
                  <Text
                    style={[
                      styles.goToWorkoutButtonText,
                      isDayLocked(currentDay) &&
                        styles.goToWorkoutButtonTextLocked,
                    ]}
                  >
                    {isDayLocked(currentDay)
                      ? "View Workout 👁️"
                      : "Start Workout →"}
                  </Text>
                </TouchableOpacity>
              </View>
              {isDayLocked(currentDay) && (
                <Text style={styles.lockedHintText}>
                  💡 This day is view-only. Select another day to continue
                  training.
                </Text>
              )}
            </View>
          )}

          {selectedPerson && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Workout History</Text>

              {loadingHistory ? (
                <View style={styles.calendarLoading}>
                  <ActivityIndicator color='#667eea' />
                </View>
              ) : (
                <UniversalCalendar
                  hasDataOnDate={hasSessionOnDate}
                  onDatePress={handleDatePress}
                  initialView='week'
                  legendText='Workout day'
                  dotColor='#10b981'
                />
              )}
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
                4. Select which day you want to do
              </Text>
              <Text style={styles.instructionStep}>
                5. Go to the Workout tab to start!
              </Text>
            </View>
          )}
        </View>

        {/* Day Picker Modal */}
        <ModalSheet
          visible={showDayPicker}
          onClose={() => setShowDayPicker(false)}
          title='Select Workout Day'
          showCancelButton={false}
          showConfirmButton={false}
        >
          {workoutData?.days?.map((day) => {
            const isLocked = isDayLocked(day.dayNumber)
            const isCurrent = day.dayNumber === currentDay

            return (
              <TouchableOpacity
                key={day.dayNumber}
                style={[
                  styles.dayOption,
                  isCurrent && styles.dayOptionCurrent,
                  isLocked && styles.dayOptionComplete,
                ]}
                onPress={() => handleSelectDay(day.dayNumber)}
              >
                <View style={styles.dayOptionLeft}>
                  <Text
                    style={[
                      styles.dayOptionNumber,
                      isCurrent && styles.dayOptionTextCurrent,
                      isLocked && styles.dayOptionTextComplete,
                    ]}
                  >
                    {`Day ${day.dayNumber}${isLocked ? " 🔒" : ""}`}
                  </Text>
                  <Text style={styles.dayOptionMuscles}>
                    {day.muscleGroups.join(", ")}
                  </Text>
                  {isLocked && (
                    <Text style={styles.lockedText}>Locked - Tap to View</Text>
                  )}
                </View>
                <View style={styles.dayOptionRight}>
                  {isLocked && (
                    <View style={styles.completeIcon}>
                      <Text style={styles.completeIconText}>✓</Text>
                    </View>
                  )}
                  {isCurrent && !isLocked && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
          <View style={styles.modalFooter}>
            <Text style={styles.modalFooterText}>
              🔒 Locked days can be viewed in read-only mode • Resets every
              Monday
            </Text>
          </View>
        </ModalSheet>

        {/* Date Sessions Modal */}
        <ModalSheet
          visible={selectedDate !== null}
          onClose={() => setSelectedDate(null)}
          title={selectedDate ? formatDate(selectedDate) : ""}
          showCancelButton={false}
          showConfirmButton={false}
        >
          {selectedDate &&
            getSessionsForDate(selectedDate).map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionListItem}
                onPress={() => handleSessionPress(session)}
              >
                <View style={styles.sessionListLeft}>
                  <Text style={styles.sessionListTitle}>
                    {`Day ${session.day_number} - ${getSessionTitle(session)}`}
                  </Text>
                  <View style={styles.sessionListMeta}>
                    <Text style={styles.sessionListTime}>
                      {`⏱️ ${formatSessionTime(session.start_time)}`}
                    </Text>
                    {!!session.total_duration && (
                      <Text style={styles.sessionListDuration}>
                        {` • ${formatTime(session.total_duration)}`}
                      </Text>
                    )}
                    <Text style={styles.sessionListSets}>
                      {` • ${session.completed_sets} sets`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sessionListArrow}>›</Text>
              </TouchableOpacity>
            ))}
        </ModalSheet>

        {/* Session Details Modal */}
        <ModalSheet
          visible={showSessionDetails}
          onClose={() => setShowSessionDetails(false)}
          title='Session Details'
          showCancelButton={false}
          showConfirmButton={false}
        >
          {selectedSession && (
            <>
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>
                  {`Day ${selectedSession.day_number}`}
                </Text>
                <Text style={styles.detailSubtitle}>
                  {selectedSession.day_title ?? ""}
                </Text>
                {Array.isArray(selectedSession.muscle_groups) &&
                  selectedSession.muscle_groups.length > 0 && (
                    <View style={styles.muscleGroupsRow}>
                      {selectedSession.muscle_groups.map((group, idx) => (
                        <View key={idx} style={styles.muscleTag}>
                          <Text style={styles.muscleTagText}>
                            {String(group)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
              </View>

              <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedSession.start_time).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Start Time</Text>
                  <Text style={styles.detailValue}>
                    {formatSessionTime(selectedSession.start_time)}
                  </Text>
                </View>
                {!!selectedSession.end_time && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>End Time</Text>
                    <Text style={styles.detailValue}>
                      {formatSessionTime(selectedSession.end_time)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(selectedSession.total_duration)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sets Completed</Text>
                  <Text style={styles.detailValue}>
                    {`${selectedSession.completed_sets ?? 0}`}
                  </Text>
                </View>
              </View>

              {Array.isArray(selectedSession.groupedExercises) &&
                selectedSession.groupedExercises.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Exercises</Text>
                    {selectedSession.groupedExercises.map(
                      (exercise, exerciseIdx) => (
                        <View key={exerciseIdx} style={styles.exerciseCard}>
                          <View style={styles.exerciseHeader}>
                            {/* exercise_name comes directly from the server JOIN */}
                            <Text style={styles.exerciseName}>
                              {exercise.exerciseName}
                            </Text>
                            <Text style={styles.exerciseSetsCount}>
                              {`${exercise.sets.length} sets`}
                            </Text>
                          </View>

                          {exercise.sets.map((set, setIdx) => (
                            <View key={setIdx} style={styles.setTimingCard}>
                              <View style={styles.setTimingHeader}>
                                <Text style={styles.setTimingTitle}>
                                  {`Set ${set.set_index + 1}`}
                                </Text>
                              </View>
                              <View style={styles.setTimingDetails}>
                                <Text style={styles.setTimingDetail}>
                                  {(() => {
                                    const w = parseFloat(set.weight ?? 0)
                                    const r = parseInt(set.reps ?? 0)
                                    const volume = w * r
                                    const displayVolume = Number.isInteger(
                                      volume,
                                    )
                                      ? `${volume}`
                                      : `${volume.toFixed(1)}`
                                    return `${w}kg × ${r} = ${displayVolume}kg`
                                  })()}
                                </Text>
                                {!!set.set_duration && (
                                  <Text style={styles.setTimingDetail}>
                                    {`Duration: ${
                                      set.set_duration >= 60
                                        ? `${Math.floor(set.set_duration / 60)}m${set.set_duration % 60 > 0 ? ` ${set.set_duration % 60}s` : ""}`
                                        : `${set.set_duration}s`
                                    }`}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      ),
                    )}
                  </View>
                )}
            </>
          )}
        </ModalSheet>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  uploadButton: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  personCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  personCardSelected: {
    borderColor: "#667eea",
    backgroundColor: "#f0f3ff",
  },
  personCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  personName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  personNameSelected: {
    color: "#667eea",
  },
  checkmark: {
    fontSize: 24,
    color: "#667eea",
  },
  personStats: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  personStat: {
    fontSize: 14,
    color: "#666",
  },
  currentDayCard: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  currentDayCardLocked: {
    backgroundColor: "#6b7280",
  },
  currentDayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  currentDayText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  completeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 15,
  },
  completeBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  lockedBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 15,
  },
  lockedBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  dayActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  changeDayButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fff",
  },
  changeDayButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  goToWorkoutButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goToWorkoutButtonLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  goToWorkoutButtonText: {
    color: "#667eea",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  goToWorkoutButtonTextLocked: {
    color: "#6b7280",
  },
  lockedHintText: {
    marginTop: 12,
    fontSize: 13,
    color: "#fff",
    opacity: 0.9,
    textAlign: "center",
  },
  calendarLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  instructionsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#667eea",
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  instructionStep: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalClose: {
    fontSize: 28,
    color: "#666",
    paddingHorizontal: 10,
  },
  dayList: {
    padding: 15,
  },
  dayOption: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  dayOptionCurrent: {
    borderColor: "#667eea",
    backgroundColor: "#f0f3ff",
  },
  dayOptionComplete: {
    backgroundColor: "#f5f5f5",
    borderColor: "#d1d5db",
  },
  dayOptionLeft: {
    flex: 1,
  },
  dayOptionNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  dayOptionTextCurrent: {
    color: "#667eea",
  },
  dayOptionTextComplete: {
    color: "#999",
  },
  dayOptionMuscles: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    fontStyle: "italic",
  },
  dayOptionRight: {
    marginLeft: 10,
  },
  completeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  completeIconText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  currentBadge: {
    backgroundColor: "#667eea",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalFooter: {
    padding: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  modalFooterText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
  sessionsList: {
    padding: 15,
  },
  sessionListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionListLeft: {
    flex: 1,
  },
  sessionListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  sessionListMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sessionListTime: {
    fontSize: 13,
    color: "#666",
  },
  sessionListDuration: {
    fontSize: 13,
    color: "#666",
  },
  sessionListSets: {
    fontSize: 13,
    color: "#666",
  },
  sessionListArrow: {
    fontSize: 24,
    color: "#ccc",
    marginLeft: 10,
  },
  sessionDetailsContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 25,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  muscleGroupsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -8,
    marginBottom: -8,
  },
  muscleTag: {
    backgroundColor: "#f0f3ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  muscleTagText: {
    color: "#667eea",
    fontSize: 13,
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 15,
    color: "#666",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  exerciseSetsCount: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
  },
  setTimingCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  setTimingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  setTimingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  setTimingDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  setTimingDetail: {
    fontSize: 14,
    color: "#666",
  },
  changeDayButtonDisabled: {
    opacity: 0.5,
  },
})
