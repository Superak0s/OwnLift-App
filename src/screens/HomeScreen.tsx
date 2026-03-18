import React, { useState, useEffect } from "react"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { WorkoutData } from "../types/index"
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
import { useAlert } from "../components/CustomAlert"
import { useTheme } from "../context/ThemeContext"

type RootStackParamList = {
  Home: undefined
  Workout: undefined
  Login: undefined
}

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">
}

export default function HomeScreen({
  navigation,
}: HomeScreenProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
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
  const { alert, AlertComponent } = useAlert()
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false)
  const [sessionHistory, setSessionHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [showSessionDetails, setShowSessionDetails] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  useEffect(() => {
    if (selectedPerson) {
      loadSessionHistory().catch((error) => {
        if (error.message === "SESSION_EXPIRED") {
          alert(
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
            "warning",
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
          await saveWorkoutData(saved as any)
        }
      } catch (error: any) {
        if (error.message === "SESSION_EXPIRED") {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] })
        }
      }
    }

    restoreProgram()
  }, [])

  const loadSessionHistory = async (): Promise<void> => {
    setLoadingHistory(true)
    try {
      const limit = 60
      const sessions = await fetchSessionHistory(limit)
      setSessionHistory(sessions)
    } catch (error: any) {
      if (error.message === "SESSION_EXPIRED") {
        throw error
      }
    } finally {
      setLoadingHistory(false)
    }
  }

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await loadSessionHistory()
    } catch (error: any) {
      if (error.message === "SESSION_EXPIRED") {
        throw error
      } else {
        alert("Error", "Failed to refresh session history", [{ text: "OK" }])
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleUploadFile = async (): Promise<void> => {
    try {
      setIsUploading(true)

      const fileUri = await workoutApi.pickWorkoutFile()
      if (!fileUri) {
        setIsUploading(false)
        return
      }

      const data = (await programApi.uploadAndSave(fileUri)) as any

      if (data.success) {
        await saveWorkoutData(data)
        alert(
          "Success!",
          `Loaded ${(data as any)?.totalDays} workout days for ${(data as any).people?.join(", ")}`,
          [{ text: "OK" }],
          "success",
        )
      }
    } catch (error: any) {
      alert(
        "Error",
        (error as any)?.message || "Failed to upload workout file",
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

  const handleSelectDay = (day: number): void => {
    if (hasActiveSession()) {
      alert(
        "Active Workout Session",
        "You have an active workout session in progress. Please complete or end your current workout before selecting a different day.",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    if (isDayLocked(day)) {
      alert(
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
        "lock",
      )
      return
    }

    saveCurrentDay(day)
    setShowDayPicker(false)
  }

  const handleDatePress = (date: Date): void => {
    const sessionsOnDate = getSessionsForDate(date)
    if (sessionsOnDate.length > 0) {
      setSelectedDate(date)
    }
  }

  const handleSessionPress = async (session: any): Promise<void> => {
    try {
      const details = (await workoutApi.getSession(session.id)) as any

      if (details.set_timings && details.set_timings.length > 0) {
        // Group by exercise_name (stable string) instead of the old
        // exercise_index (positional integer that no longer exists).
        const exerciseMap = new Map()

        details.set_timings.forEach((timing: any) => {
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
          exercise.sets.sort((a: any, b: any) => a.set_index - b.set_index)
        })

        // Preserve insertion order (server already orders by name, set_index)
        details.groupedExercises = Array.from(exerciseMap.values())
      } else {
        details.groupedExercises = []
      }

      setSelectedSession(details as any)
      setShowSessionDetails(true)
      setSelectedDate(null)
    } catch (error: any) {
      alert("Error", "Failed to load session details")
    }
  }

  const getPersonWorkoutSummary = (
    person: string,
  ): { totalSets: number; totalDays: number } | null => {
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

  const getDayTitle = (dayNumber: number): string => {
    const day = workoutData?.days?.find((d) => d.dayNumber === dayNumber)
    return day?.muscleGroups?.join("/") || `Day ${dayNumber}`
  }

  const getSessionTitle = (session: any): string => {
    if (!session?.day_title) return `Day ${session?.day_number ?? ""}`
    const parts = session.day_title.split("—")
    return parts.length > 1 ? parts[1].trim() : session.day_title
  }

  const getSessionsForDate = (date: Date): unknown[] => {
    const targetStr = toLocalDateStr(date) // reuse the helper from UniversalCalendar logic

    return sessionHistory.filter((session) => {
      const sessionDateStr = String(session.start_time)
        .replace("T", " ")
        .split(" ")[0]
      return sessionDateStr === targetStr
    })
  }

  const hasSessionOnDate = (date: Date): boolean => {
    return getSessionsForDate(date).length > 0
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (seconds: number): string => {
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

  const formatSessionTime = (dateString: string | null | undefined): string => {
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
            colors={[colors.accent]}
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
                <Text style={styles.summaryValue}>
                  {(workoutData as any)?.totalDays}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>People:</Text>
                <Text style={styles.summaryValue}>
                  {(workoutData as any).people.join(", ")}
                </Text>
              </View>
            </View>
          )}

          {workoutData && (workoutData as any).people && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Profile</Text>
              {(workoutData as any).people.map((person: any) => {
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
                    {(day.muscleGroups ?? []).join(", ")}
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
            getSessionsForDate(selectedDate).map((session: any) => (
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
          scrollable={true}
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
                      {selectedSession.muscle_groups.map(
                        (group: string, idx: number) => (
                          <View key={idx} style={styles.muscleTag}>
                            <Text style={styles.muscleTagText}>
                              {String(group)}
                            </Text>
                          </View>
                        ),
                      )}
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
                    {formatTime(selectedSession.total_duration as number)}
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
                      (exercise: any, exerciseIdx: any) => (
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

                          {exercise.sets.map((set: any, setIdx: any) => (
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
      {AlertComponent}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  uploadButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
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
  summaryLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 20,
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
  personName: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  personNameSelected: {
    color: colors.accent,
  },
  checkmark: {
    fontSize: 24,
    color: colors.accent,
  },
  personStats: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  personStat: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  currentDayCard: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  currentDayCardLocked: {
    backgroundColor: colors.textSecondary,
  },
  currentDayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.surface,
    marginBottom: 8,
  },
  currentDayText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.surface,
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
    color: colors.surface,
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
    color: colors.surface,
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
    borderColor: colors.surface,
  },
  changeDayButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  goToWorkoutButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goToWorkoutButtonLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  goToWorkoutButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  goToWorkoutButtonTextLocked: {
    color: colors.textSecondary,
  },
  lockedHintText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.surface,
    opacity: 0.9,
    textAlign: "center",
  },
  calendarLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.surfaceBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 28,
    color: colors.textSecondary,
    paddingHorizontal: 10,
  },
  dayList: {
    padding: 15,
  },
  dayOption: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  dayOptionCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  dayOptionComplete: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
  },
  dayOptionLeft: {
    flex: 1,
  },
  dayOptionNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dayOptionTextCurrent: {
    color: colors.accent,
  },
  dayOptionTextComplete: {
    color: colors.textMuted,
  },
  dayOptionMuscles: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 12,
    color: colors.success,
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
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  completeIconText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: "bold",
  },
  currentBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "600",
  },
  modalFooter: {
    padding: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    alignItems: "center",
  },
  modalFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
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
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionListLeft: {
    flex: 1,
  },
  sessionListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sessionListMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sessionListTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sessionListDuration: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sessionListSets: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sessionListArrow: {
    fontSize: 24,
    color: colors.surfaceBorder,
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
    color: colors.textPrimary,
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  muscleGroupsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -8,
    marginBottom: -8,
  },
  muscleTag: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  muscleTagText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  detailLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "bold",
    color: colors.textPrimary,
    flex: 1,
  },
  exerciseSetsCount: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "600",
  },
  setTimingCard: {
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
  },
  setTimingDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  setTimingDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  changeDayButtonDisabled: {
    opacity: 0.5,
  },
})
