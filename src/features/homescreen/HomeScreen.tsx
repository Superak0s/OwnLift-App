import React, { useState, useEffect, useMemo } from "react"
import * as Device from "expo-device"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
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
import { SafeAreaView } from "react-native-safe-area-context"
import { useWorkout } from "@shared/context/WorkoutContext"
import { useTheme } from "@shared/context/ThemeContext"
import type { ThemeColors } from "@shared/context/ThemeContext"
import UniversalCalendar from "@shared/components/UniversalCalendar"
import ModalSheet from "@shared/components/ModalSheet"
import { useAlert } from "@shared/components/CustomAlert"
import { workoutApi } from "@features/workout/services/index"
import { programApi } from "@features/plan/services/index"
import { formatTime as formatDuration } from "@utils/timeEstimation"
import { formatDate as formatDateUtil } from "@utils/format"
import { useWidgets } from "@shared/context/hooks/useWidgets"
import { useTwoFingerPull } from "@shared/context/hooks/useTwoFingerPull"
import WidgetGallery from "@shared/components/widgets/WidgetGallery"
import WidgetsPanel from "@shared/components/widgets/WidgetsPanel"
import {
  HOME_WIDGET_REGISTRY,
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGETS_STORAGE_KEY,
  type HomeWidgetType,
} from "./widgets"
import type {
  WorkoutData,
  WorkoutDay,
  WorkoutSession,
  FullSessionWithGroups,
  WidgetInstance,
} from "@shared/types"
import type { SetTiming } from "@shared/types"
import type { GroupedExercise } from "@features/friends/types"
import type { RootStackParamList } from "@shared/types"

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
    selectedSplit,
    currentDay,
    saveWorkoutData,
    saveCurrentDay,
    isDayLocked,
    fetchSessionHistory,
    hasActiveSession,
    userId,
  } = useWorkout()
  const { alert, AlertComponent } = useAlert()
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false)
  const [sessionHistory, setSessionHistory] = useState<WorkoutSession[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [selectedSession, setSelectedSession] =
    useState<FullSessionWithGroups | null>(null)
  const [showSessionDetails, setShowSessionDetails] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [showWidgetGallery, setShowWidgetGallery] = useState<boolean>(false)
  const [widgetEditMode, setWidgetEditMode] = useState<boolean>(false)
  const isEmulator = !Device.isDevice

  // ─── Widgets ────────────────────────────────────────────────────────────
  const {
    widgets,
    isLoaded: widgetsLoaded,
    availableToAdd,
    addWidget,
    removeWidget,
    cycleWidgetSize,
    reorderWidgets,
  } = useWidgets<HomeWidgetType>(userId ?? null, {
    registry: HOME_WIDGET_REGISTRY,
    defaults: DEFAULT_HOME_WIDGETS,
    storageKey: HOME_WIDGETS_STORAGE_KEY,
  })

  // Two-finger pull brings up the "deploy" panel for adding widgets. To
  // rearrange, resize, or remove widgets already on the screen, open that
  // same panel and tap "Edit Widgets" — it closes the panel and switches
  // the home screen into edit mode.
  const { panHandlers, pullDistance, isPulling } = useTwoFingerPull(() => {
    setShowWidgetGallery(true)
  })

  const handleEditWidgets = () => {
    setShowWidgetGallery(false)
    setWidgetEditMode(true)
  }

  const handleAddWidget = async (type: Parameters<typeof addWidget>[0]) => {
    const result = await addWidget(type)
    if (!result.success && result.error) {
      alert("Can't Add Widget", result.error, [{ text: "OK" }])
      return
    }
    setShowWidgetGallery(false)
  }

  const renderWidgetContent = (
    instance: WidgetInstance<HomeWidgetType>,
  ): React.ReactNode => {
    switch (instance.type) {
      case "next_workout": {
        if (!selectedSplit || !workoutData) {
          return (
            <Text style={styles.widgetLineMuted}>
              Upload a workout plan to see today's session here.
            </Text>
          )
        }
        return (
          <View
            style={[
              styles.currentDayCard,
              isDayLocked(currentDay) && styles.currentDayCardLocked,
            ]}
          >
            <Text style={styles.currentDayText}>
              Day {currentDay} - {getDayTitle(currentDay)}
            </Text>
            {isDayLocked(currentDay) ? (
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>✓ Locked</Text>
              </View>
            ) : (
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
        )
      }
      case "weekly_progress": {
        if (!selectedSplit || !workoutData?.days?.length) {
          return (
            <Text style={styles.widgetLineMuted}>
              Start a program to see this week's progress here.
            </Text>
          )
        }
        const days = workoutData.days
        const total = days.length
        const lockedCount = days.filter((d) => isDayLocked(d.dayNumber)).length
        const percent = total > 0 ? Math.round((lockedCount / total) * 100) : 0
        return (
          <View style={styles.weeklyProgressWrap}>
            <View style={styles.weeklyProgressHeaderRow}>
              <Text style={styles.weeklyProgressPercent}>{percent}%</Text>
              <Text style={styles.weeklyProgressCount}>
                {lockedCount}/{total} days done
              </Text>
            </View>
            <View style={styles.weeklyProgressTrack}>
              <View
                style={[
                  styles.weeklyProgressFill,
                  {
                    width: `${percent}%`,
                    backgroundColor:
                      percent === 100 ? colors.success : colors.accent,
                  },
                ]}
              />
            </View>
            <View style={styles.weeklyProgressDots}>
              {days.map((day) => {
                const done = isDayLocked(day.dayNumber)
                const isToday = day.dayNumber === currentDay
                return (
                  <View
                    key={day.dayNumber}
                    style={[
                      styles.weeklyProgressDot,
                      done && styles.weeklyProgressDotDone,
                      isToday && !done && styles.weeklyProgressDotToday,
                    ]}
                  >
                    {done && (
                      <Text style={styles.weeklyProgressDotCheck}>✓</Text>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        )
      }
      case "workout_streak": {
        if (!selectedSplit) {
          return (
            <Text style={styles.widgetLineMuted}>
              Start a program to build your streak.
            </Text>
          )
        }
        if (loadingHistory && sessionHistory.length === 0) {
          return (
            <View style={styles.streakLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )
        }
        const subtitle = weeklyStreak.currentWeekLogged
          ? "Logged this week 💪"
          : weeklyStreak.count > 0
            ? "Log a workout this week to keep it going"
            : "Complete a workout to start your streak"
        return (
          <View style={styles.streakWrap}>
            <Text style={styles.streakEmoji}>
              {weeklyStreak.count > 0 ? "🔥" : "🕯️"}
            </Text>
            <Text style={styles.streakNumber}>{weeklyStreak.count}</Text>
            <Text style={styles.streakLabel}>week streak</Text>
            <Text style={styles.streakSub}>{subtitle}</Text>
          </View>
        )
      }
      case "workout_calendar": {
        if (!selectedSplit) {
          return (
            <Text style={styles.widgetLineMuted}>
              Start a program to track your workout history here.
            </Text>
          )
        }
        // UniversalCalendar is a generic, reusable component (used all over
        // the app already) — dropping it into a widget body needs no special
        // handling, same as any other widget's content.
        return loadingHistory ? (
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
        )
      }
      case "getting_started": {
        return (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>📝 How to get started:</Text>
            <Text style={styles.instructionStep}>
              1. Select which day you want to do
            </Text>
            <Text style={styles.instructionStep}>
              2. Go to the Workout tab to start!
            </Text>
            <Text style={styles.instructionStep}>
              3. Pull down with two fingers anytime to add widgets
            </Text>
          </View>
        )
      }
      default:
        return <Text style={styles.widgetLineMuted}>Coming soon</Text>
    }
  }

  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  // ─── Streak ───────────────────────────────────────────────────────────────
  // "Streak" = consecutive Monday-start weeks with at least one logged
  // session, counting back from the current week. The current week doesn't
  // break the streak just for being in progress — it only starts counting
  // once a session has actually been logged in it.
  const dateStrPlusDays = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + days)
    return toLocalDateStr(date)
  }

  const mondayOfWeek = (dateStr: string): string => {
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    const dayOfWeek = date.getDay() // 0 = Sun ... 6 = Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    return dateStrPlusDays(dateStr, diffToMonday)
  }

  const weeksWithSessions = useMemo(() => {
    const set = new Set<string>()
    sessionHistory.forEach((session) => {
      if (!session.start_time) return
      const dateStr = String(session.start_time).replace("T", " ").split(" ")[0]
      set.add(mondayOfWeek(dateStr))
    })
    return set
  }, [sessionHistory])

  const weeklyStreak = useMemo(() => {
    const todayMonday = mondayOfWeek(toLocalDateStr(new Date()))
    const currentWeekLogged = weeksWithSessions.has(todayMonday)

    // Only fully elapsed weeks count toward the streak — the current week
    // hasn't "gone" yet, so even if it already has a session logged, it's
    // surfaced separately via currentWeekLogged rather than added to count.
    let cursor = dateStrPlusDays(todayMonday, -7)
    let count = 0
    while (weeksWithSessions.has(cursor)) {
      count++
      cursor = dateStrPlusDays(cursor, -7)
    }
    return { count, currentWeekLogged }
  }, [weeksWithSessions])

  useEffect(() => {
    if (selectedSplit) {
      loadSessionHistory().catch((error) => {
        if ((error as Error)?.message === "SESSION_EXPIRED") {
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
  }, [selectedSplit])

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

  const loadSessionHistory = async (): Promise<void> => {
    setLoadingHistory(true)
    try {
      const limit = 60
      const sessions = await fetchSessionHistory(limit)
      setSessionHistory(sessions as WorkoutSession[])
    } catch (error) {
      if ((error as Error)?.message === "SESSION_EXPIRED") {
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
    } catch (error) {
      if ((error as Error)?.message === "SESSION_EXPIRED") {
        throw error
      } else {
        alert("Error", "Failed to refresh session history", [{ text: "OK" }])
      }
    } finally {
      setRefreshing(false)
    }
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

  const handleSessionPress = async (session: WorkoutSession): Promise<void> => {
    try {
      const details = (await workoutApi.getSession(
        session.id,
      )) as FullSessionWithGroups

      if (details.set_timings && details.set_timings.length > 0) {
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
          exercise.sets.sort(
            (a: SetTiming, b: SetTiming) => a.set_index - b.set_index,
          )
        })

        details.groupedExercises = Array.from(exerciseMap.values())
      } else {
        details.groupedExercises = []
      }

      setSelectedSession(details)
      setShowSessionDetails(true)
      setSelectedDate(null)
    } catch (error) {
      alert("Error", "Failed to load session details")
    }
  }

  const getDayTitle = (dayNumber: number): string => {
    const day = workoutData?.days?.find(
      (d: WorkoutDay) => d.dayNumber === dayNumber,
    )
    return day?.muscleGroups?.join("/") || `Day ${dayNumber}`
  }
  const getSessionTitle = (session: WorkoutSession): string => {
    if (!session?.day_title) return `Day ${session?.day_number ?? ""}`
    const parts = session.day_title.split("—")
    return parts.length > 1 ? parts[1].trim() : session.day_title
  }

  const getSessionsForDate = (date: Date): WorkoutSession[] => {
    const targetStr = toLocalDateStr(date)

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

  const formatDate = (date: Date): string =>
    formatDateUtil(date, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })

  const formatTime = (seconds: number): string => formatDuration(seconds, "N/A")

  const formatSessionTime = (dateString: string | null | undefined): string => {
    if (!dateString) return ""

    const timePart = String(dateString).replace("T", " ").split(" ")[1] || ""
    const [hourStr, minuteStr] = timePart.split(":")
    const hour = parseInt(hourStr)
    const minute = minuteStr || "00"
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minute} ${ampm}`
  }

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
            isLoaded={widgetsLoaded}
            editMode={widgetEditMode}
            onCycleSize={cycleWidgetSize}
            onRemove={removeWidget}
            onReorder={reorderWidgets}
            renderContent={renderWidgetContent}
            registry={HOME_WIDGET_REGISTRY}
          />
        </View>

        <ModalSheet
          visible={showDayPicker}
          onClose={() => setShowDayPicker(false)}
          title='Select Workout Day'
          showCancelButton={false}
          showConfirmButton={false}
        >
          {workoutData?.days?.map((day: WorkoutDay) => {
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
                    {selectedSession.start_time
                      ? new Date(selectedSession.start_time).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )
                      : "—"}
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
                      (exercise: GroupedExercise, exerciseIdx: number) => (
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

                          {exercise.sets.map(
                            (set: SetTiming, setIdx: number) => (
                              <View key={setIdx} style={styles.setTimingCard}>
                                <View style={styles.setTimingHeader}>
                                  <Text style={styles.setTimingTitle}>
                                    {`Set ${set.set_index + 1}`}
                                  </Text>
                                </View>
                                <View style={styles.setTimingDetails}>
                                  <Text style={styles.setTimingDetail}>
                                    {(() => {
                                      const w = parseFloat(
                                        String(set.weight ?? 0),
                                      )
                                      const r = parseInt(String(set.reps ?? 0))
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
                            ),
                          )}
                        </View>
                      ),
                    )}
                  </View>
                )}
            </>
          )}
        </ModalSheet>
      </ScrollView>

      <WidgetGallery
        visible={showWidgetGallery}
        onClose={() => setShowWidgetGallery(false)}
        availableWidgets={availableToAdd}
        onAddWidget={handleAddWidget}
        hasPlacedWidgets={widgets.length > 0}
        onEditWidgets={handleEditWidgets}
      />

      {AlertComponent}
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 10,
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
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
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
      color: colors.textSecondary,
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
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    goToWorkoutButton: {
      flex: 1,
      backgroundColor: colors.surface,
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
    weeklyProgressWrap: {
      paddingVertical: 2,
    },
    weeklyProgressHeaderRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    weeklyProgressPercent: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    weeklyProgressCount: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    weeklyProgressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.inputBackground,
      overflow: "hidden",
      marginBottom: 12,
    },
    weeklyProgressFill: {
      height: "100%",
      borderRadius: 4,
    },
    weeklyProgressDots: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    weeklyProgressDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    weeklyProgressDotToday: {
      borderColor: colors.accent,
      borderStyle: "dashed",
    },
    weeklyProgressDotDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    weeklyProgressDotCheck: {
      color: colors.surface,
      fontSize: 11,
      fontWeight: "bold",
    },
    streakWrap: {
      alignItems: "center",
      paddingVertical: 4,
    },
    streakLoading: {
      paddingVertical: 16,
      alignItems: "center",
    },
    streakEmoji: {
      fontSize: 26,
      marginBottom: 2,
    },
    streakNumber: {
      fontSize: 30,
      fontWeight: "bold",
      color: colors.textPrimary,
      lineHeight: 34,
    },
    streakLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    streakSub: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
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
  })
