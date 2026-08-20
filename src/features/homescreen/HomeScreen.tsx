import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkout } from "@shared/context/WorkoutContext";
import { useTheme } from "@shared/context/ThemeContext";
import type { ThemeColors } from "@shared/context/ThemeContext";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import ModalSheet from "@shared/components/ModalSheet";
import { useAlert } from "@shared/components/CustomAlert";
import { workoutApi } from "@features/workout/services/index";
import { formatTime as formatDuration } from "@utils/timeEstimation";
import { formatDate as formatDateUtil } from "@utils/format";
import { visibleDaysForSplit } from "@utils/programDays";
import { useWidgets } from "@shared/context/hooks/useWidgets";
import { useTwoFingerPull } from "@shared/context/hooks/useTwoFingerPull";
import WidgetGallery from "@shared/components/widgets/WidgetGallery";
import WidgetsPanel from "@shared/components/widgets/WidgetsPanel";
import {
  HOME_WIDGET_REGISTRY,
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGETS_STORAGE_KEY,
  type HomeWidgetType,
} from "./widgets";
import type {
  WorkoutData,
  WorkoutDay,
  WorkoutSession,
  FullSessionWithGroups,
  WidgetInstance,
  SetTiming,
  GroupedExercise,
  RootStackParamList,
} from "@shared/types";

type HomeScreenProps = {
  readonly navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};


type NextWorkoutWidgetProps = {
  readonly selectedSplit: unknown;
  readonly workoutData: WorkoutData | null;
  readonly currentDay: number;
  readonly isDayLocked: (day: number) => boolean;
  readonly hasActiveSession: () => boolean;
  readonly onChangeDay: () => void;
  readonly onGoToWorkout: () => void;
  readonly styles: ReturnType<typeof makeStyles>;
};

function NextWorkoutWidget({
  selectedSplit,
  workoutData,
  currentDay,
  isDayLocked,
  hasActiveSession,
  onChangeDay,
  onGoToWorkout,
  styles,
}: NextWorkoutWidgetProps): React.JSX.Element {
  if (!selectedSplit || !workoutData) {
    return (
      <Text style={styles.widgetLineMuted}>
        Upload a workout plan to see today's session here.
      </Text>
    );
  }

  const dayTitle = getDayTitle(workoutData, currentDay);
  const locked = isDayLocked(currentDay);

  return (
    <View
      style={[styles.currentDayCard, locked && styles.currentDayCardLocked]}
    >
      <Text style={styles.currentDayText}>
        Day {currentDay} - {dayTitle}
      </Text>
      {locked ? (
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
          onPress={onChangeDay}
        >
          <Text style={styles.changeDayButtonText}>
            {hasActiveSession() ? "🔒 Session Active" : "📅 Change Day"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.goToWorkoutButton,
            locked && styles.goToWorkoutButtonLocked,
          ]}
          onPress={onGoToWorkout}
        >
          <Text
            style={[
              styles.goToWorkoutButtonText,
              locked && styles.goToWorkoutButtonTextLocked,
            ]}
          >
            {locked ? "View Workout 👁️" : "Start Workout →"}
          </Text>
        </TouchableOpacity>
      </View>
      {locked && (
        <Text style={styles.lockedHintText}>
          💡 This day is view-only. Select another day to continue training.
        </Text>
      )}
    </View>
  );
}

type WeeklyProgressWidgetProps = {
  readonly selectedSplit: unknown;
  readonly workoutData: WorkoutData | null;
  readonly currentDay: number;
  readonly isDayLocked: (day: number) => boolean;
  readonly colors: ThemeColors;
  readonly styles: ReturnType<typeof makeStyles>;
};

function WeeklyProgressWidget({
  selectedSplit,
  workoutData,
  currentDay,
  isDayLocked,
  colors,
  styles,
}: WeeklyProgressWidgetProps): React.JSX.Element {
  if (!selectedSplit || !workoutData?.days?.length) {
    return (
      <Text style={styles.widgetLineMuted}>
        Start a program to see this week's progress here.
      </Text>
    );
  }

  const days = workoutData.days;
  const total = days.length;
  const lockedCount = days.filter((d) => isDayLocked(d.dayNumber)).length;
  const percent = total > 0 ? Math.round((lockedCount / total) * 100) : 0;

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
              backgroundColor: percent === 100 ? colors.success : colors.accent,
            },
          ]}
        />
      </View>
      <View style={styles.weeklyProgressDots}>
        {days.map((day) => (
          <WeeklyProgressDot
            key={day.dayNumber}
            done={isDayLocked(day.dayNumber)}
            isToday={day.dayNumber === currentDay}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function WeeklyProgressDot({
  done,
  isToday,
  styles,
}: {
  readonly done: boolean;
  readonly isToday: boolean;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.weeklyProgressDot,
        done && styles.weeklyProgressDotDone,
        isToday && !done && styles.weeklyProgressDotToday,
      ]}
    >
      {done && <Text style={styles.weeklyProgressDotCheck}>✓</Text>}
    </View>
  );
}

type WorkoutStreakWidgetProps = {
  readonly selectedSplit: unknown;
  readonly loadingHistory: boolean;
  readonly sessionHistory: WorkoutSession[];
  readonly weeklyStreak: { count: number; currentWeekLogged: boolean };
  readonly colors: ThemeColors;
  readonly styles: ReturnType<typeof makeStyles>;
};

function getStreakSubtitle(weeklyStreak: {
  count: number;
  currentWeekLogged: boolean;
}): string {
  if (weeklyStreak.currentWeekLogged) return "Logged this week 💪";
  if (weeklyStreak.count > 0) return "Log a workout this week to keep it going";
  return "Complete a workout to start your streak";
}

function WorkoutStreakWidget({
  selectedSplit,
  loadingHistory,
  sessionHistory,
  weeklyStreak,
  colors,
  styles,
}: WorkoutStreakWidgetProps): React.JSX.Element {
  if (!selectedSplit) {
    return (
      <Text style={styles.widgetLineMuted}>
        Start a program to build your streak.
      </Text>
    );
  }

  if (loadingHistory && sessionHistory.length === 0) {
    return (
      <View style={styles.streakLoading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const subtitle = getStreakSubtitle(weeklyStreak);

  return (
    <View style={styles.streakWrap}>
      <Text style={styles.streakEmoji}>
        {weeklyStreak.count > 0 ? "🔥" : "🕯️"}
      </Text>
      <Text style={styles.streakNumber}>{weeklyStreak.count}</Text>
      <Text style={styles.streakLabel}>week streak</Text>
      <Text style={styles.streakSub}>{subtitle}</Text>
    </View>
  );
}

type WorkoutCalendarWidgetProps = {
  readonly selectedSplit: unknown;
  readonly loadingHistory: boolean;
  readonly hasSessionOnDate: (date: Date) => boolean;
  readonly onDatePress: (date: Date) => void;
  readonly styles: ReturnType<typeof makeStyles>;
};

function WorkoutCalendarWidget({
  selectedSplit,
  loadingHistory,
  hasSessionOnDate,
  onDatePress,
  styles,
}: WorkoutCalendarWidgetProps): React.JSX.Element {
  if (!selectedSplit) {
    return (
      <Text style={styles.widgetLineMuted}>
        Start a program to track your workout history here.
      </Text>
    );
  }

  if (loadingHistory) {
    return (
      <View style={styles.calendarLoading}>
        <ActivityIndicator color='#667eea' />
      </View>
    );
  }

  return (
    <UniversalCalendar
      hasDataOnDate={hasSessionOnDate}
      onDatePress={onDatePress}
      initialView='month'
      legendText='Workout day'
      dotColor='#10b981'
    />
  );
}

function getDayTitle(
  workoutData: WorkoutData | null,
  dayNumber: number,
): string {
  const day = workoutData?.days?.find(
    (d: WorkoutDay) => d.dayNumber === dayNumber,
  );
  return day?.muscleGroups?.join("/") || `Day ${dayNumber}`;
}


function formatSetVolume(weight: unknown, reps: unknown): string {
  const w = typeof weight === "number" ? weight : 0;
  const r = typeof reps === "number" ? reps : 0;
  const volume = w * r;
  const displayVolume = Number.isInteger(volume)
    ? `${volume}`
    : volume.toFixed(1);
  return `${w}kg × ${r} = ${displayVolume}kg`;
}

function formatSetDuration(durationSeconds: number): string {
  if (durationSeconds < 60) return `${durationSeconds}s`;
  const minutes = Math.floor(durationSeconds / 60);
  const remainderSeconds = durationSeconds % 60;
  return remainderSeconds > 0
    ? `${minutes}m ${remainderSeconds}s`
    : `${minutes}m`;
}

function groupSetTimingsByExercise(
  setTimings: SetTiming[] | undefined,
): GroupedExercise[] {
  if (!setTimings || setTimings.length === 0) return [];

  const exerciseMap = new Map<string, GroupedExercise>();
  setTimings.forEach((timing) => {
    const key = timing.exercise_name || `Exercise ${timing.exercise_id ?? "?"}`;
    if (!exerciseMap.has(key)) {
      exerciseMap.set(key, { exerciseName: key, sets: [] });
    }
    exerciseMap.get(key)!.sets.push(timing);
  });

  exerciseMap.forEach((exercise) => {
    exercise.sets.sort(
      (a: SetTiming, b: SetTiming) => a.set_index - b.set_index,
    );
  });

  return Array.from(exerciseMap.values());
}


function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateStrPlusDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalDateStr(date);
}

function mondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return dateStrPlusDays(dateStr, diffToMonday);
}

export default function HomeScreen({
  navigation,
}: HomeScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    workoutData,
    selectedSplit,
    currentDay,
    saveCurrentDay,
    isDayLocked,
    fetchSessionHistory,
    hasActiveSession,
    userId,
  } = useWorkout();
  const { alert, AlertComponent } = useAlert();
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<WorkoutSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] =
    useState<FullSessionWithGroups | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
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
  } = useWidgets<HomeWidgetType>(userId ?? null, {
    registry: HOME_WIDGET_REGISTRY,
    defaults: DEFAULT_HOME_WIDGETS,
    storageKey: HOME_WIDGETS_STORAGE_KEY,
  });

  // Two-finger pull brings up the "deploy" panel for adding widgets. To
  // rearrange, resize, or remove widgets already on the screen, open that
  // same panel and tap "Edit Widgets" — it closes the panel and switches
  // the home screen into edit mode.
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

  const renderWidgetContent = (
    instance: WidgetInstance<HomeWidgetType>,
  ): React.ReactNode => {
    switch (instance.type) {
      case "next_workout":
        return (
          <NextWorkoutWidget
            selectedSplit={selectedSplit}
            workoutData={workoutData}
            currentDay={currentDay}
            isDayLocked={isDayLocked}
            hasActiveSession={hasActiveSession}
            onChangeDay={() => setShowDayPicker(true)}
            onGoToWorkout={() => navigation.navigate("Workout")}
            styles={styles}
          />
        );
      case "weekly_progress":
        return (
          <WeeklyProgressWidget
            selectedSplit={selectedSplit}
            workoutData={workoutData}
            currentDay={currentDay}
            isDayLocked={isDayLocked}
            colors={colors}
            styles={styles}
          />
        );
      case "workout_streak":
        return (
          <WorkoutStreakWidget
            selectedSplit={selectedSplit}
            loadingHistory={loadingHistory}
            sessionHistory={sessionHistory}
            weeklyStreak={weeklyStreak}
            colors={colors}
            styles={styles}
          />
        );
      case "workout_calendar":
        return (
          <WorkoutCalendarWidget
            selectedSplit={selectedSplit}
            loadingHistory={loadingHistory}
            hasSessionOnDate={hasSessionOnDate}
            onDatePress={handleDatePress}
            styles={styles}
          />
        );
      default:
        return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
    }
  };

  // "Streak" = consecutive Monday-start weeks with at least one logged
  // session, counting back from the current week. The current week doesn't
  // break the streak just for being in progress — it only starts counting
  // once a session has actually been logged in it.
  const weeksWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessionHistory.forEach((session) => {
      if (!session.start_time) return;
      const dateStr = String(session.start_time)
        .replace("T", " ")
        .split(" ")[0];
      set.add(mondayOfWeek(dateStr));
    });
    return set;
  }, [sessionHistory]);

  const weeklyStreak = useMemo(() => {
    const todayMonday = mondayOfWeek(toLocalDateStr(new Date()));
    const currentWeekLogged = weeksWithSessions.has(todayMonday);

    // Only fully elapsed weeks count toward the streak — the current week
    // hasn't "gone" yet, so even if it already has a session logged, it's
    // surfaced separately via currentWeekLogged rather than added to count.
    let cursor = dateStrPlusDays(todayMonday, -7);
    let count = 0;
    while (weeksWithSessions.has(cursor)) {
      count++;
      cursor = dateStrPlusDays(cursor, -7);
    }
    return { count, currentWeekLogged };
  }, [weeksWithSessions]);

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
                  });
                },
              },
            ],
            "warning",
          );
        } else {
          alert(
            "Error",
            "Failed to load your workout history.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Retry",
                onPress: () => {
                  loadSessionHistory().catch(() => {});
                },
              },
            ],
            "error",
          );
        }
      });
    }
  }, [selectedSplit]);

  const loadSessionHistory = async (): Promise<void> => {
    setLoadingHistory(true);
    try {
      const limit = 60;
      const sessions = await fetchSessionHistory(limit);
      setSessionHistory(sessions as WorkoutSession[]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await loadSessionHistory();
    } catch (error) {
      if ((error as Error)?.message === "SESSION_EXPIRED") {
        throw error;
      } else {
        alert("Error", "Failed to refresh session history", [{ text: "OK" }]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectDay = (day: number): void => {
    if (hasActiveSession()) {
      alert(
        "Active Workout Session",
        "You have an active workout session in progress. Please complete or end your current workout before selecting a different day.",
        [{ text: "OK" }],
        "warning",
      );
      return;
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
              saveCurrentDay(day);
              setShowDayPicker(false);
            },
          },
        ],
        "lock",
      );
      return;
    }

    saveCurrentDay(day);
    setShowDayPicker(false);
  };

  const handleDatePress = (date: Date): void => {
    const sessionsOnDate = getSessionsForDate(date);
    if (sessionsOnDate.length > 0) {
      setSelectedDate(date);
    }
  };

  const handleSessionPress = async (session: WorkoutSession): Promise<void> => {
    try {
      const details = await workoutApi.getSession(session.id);

      details.groupedExercises = groupSetTimingsByExercise(details.set_timings);

      setSelectedSession(details);
      setShowSessionDetails(true);
      setSelectedDate(null);
    } catch (error) {
      console.error("Failed to load session details:", error);
      alert("Error", "Failed to load session details");
    }
  };

  const getSessionTitle = (session: WorkoutSession): string => {
    if (!session?.day_title) return `Day ${session?.day_number ?? ""}`;
    const parts = session.day_title.split("—");
    return parts.length > 1 ? parts[1].trim() : session.day_title;
  };

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const session of sessionHistory) {
      const dateStr = String(session.start_time)
        .replace("T", " ")
        .split(" ")[0];
      const existing = map.get(dateStr);
      if (existing) existing.push(session);
      else map.set(dateStr, [session]);
    }
    return map;
  }, [sessionHistory]);

  const getSessionsForDate = useCallback(
    (date: Date): WorkoutSession[] =>
      sessionsByDate.get(toLocalDateStr(date)) ?? [],
    [sessionsByDate],
  );

  const hasSessionOnDate = useCallback(
    (date: Date): boolean =>
      (sessionsByDate.get(toLocalDateStr(date))?.length ?? 0) > 0,
    [sessionsByDate],
  );

  const formatDate = (date: Date): string =>
    formatDateUtil(date, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (seconds: number): string =>
    formatDuration(seconds, "N/A");

  const formatSessionTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";

    const timePart = String(dateString).replace("T", " ").split(" ")[1] || "";
    const [hourStr, minuteStr] = timePart.split(":");
    const hour = Number.parseInt(hourStr, 10);
    const minute = minuteStr || "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${ampm}`;
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
          {visibleDaysForSplit(
            workoutData?.days ?? [],
            typeof selectedSplit === "string" ? selectedSplit : null,
          ).map(({ day, displayNumber }) => (
            <DayOptionRow
              key={day.dayNumber}
              day={day}
              displayNumber={displayNumber}
              isCurrent={day.dayNumber === currentDay}
              isLocked={isDayLocked(day.dayNumber)}
              onPress={() => handleSelectDay(day.dayNumber)}
              styles={styles}
            />
          ))}
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
              <SessionListItem
                key={session.id}
                session={session}
                title={getSessionTitle(session)}
                formatSessionTime={formatSessionTime}
                formatTime={formatTime}
                onPress={() => handleSessionPress(session)}
                styles={styles}
              />
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
            <SessionDetails
              session={selectedSession}
              formatSessionTime={formatSessionTime}
              formatTime={formatTime}
              styles={styles}
            />
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
  );
}


function DayOptionRow({
  day,
  displayNumber,
  isCurrent,
  isLocked,
  onPress,
  styles,
}: {
  readonly day: WorkoutDay;
  readonly displayNumber: number;
  readonly isCurrent: boolean;
  readonly isLocked: boolean;
  readonly onPress: () => void;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[
        styles.dayOption,
        isCurrent && styles.dayOptionCurrent,
        isLocked && styles.dayOptionComplete,
      ]}
      onPress={onPress}
    >
      <View style={styles.dayOptionLeft}>
        <Text
          style={[
            styles.dayOptionNumber,
            isCurrent && styles.dayOptionTextCurrent,
            isLocked && styles.dayOptionTextComplete,
          ]}
        >
          {`Day ${displayNumber}${isLocked ? " 🔒" : ""}`}
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
  );
}

function SessionListItem({
  session,
  title,
  formatSessionTime,
  formatTime,
  onPress,
  styles,
}: {
  readonly session: WorkoutSession;
  readonly title: string;
  readonly formatSessionTime: (dateString: string | null | undefined) => string;
  readonly formatTime: (seconds: number) => string;
  readonly onPress: () => void;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.sessionListItem} onPress={onPress}>
      <View style={styles.sessionListLeft}>
        <Text style={styles.sessionListTitle}>
          {`Day ${session.day_number} - ${title}`}
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
  );
}

function SessionDetails({
  session,
  formatSessionTime,
  formatTime,
  styles,
}: {
  readonly session: FullSessionWithGroups;
  readonly formatSessionTime: (dateString: string | null | undefined) => string;
  readonly formatTime: (seconds: number) => string;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <>
      <View style={styles.detailSection}>
        <Text style={styles.detailTitle}>{`Day ${session.day_number}`}</Text>
        <Text style={styles.detailSubtitle}>{session.day_title ?? ""}</Text>
        {Array.isArray(session.muscle_groups) &&
          session.muscle_groups.length > 0 && (
            <View style={styles.muscleGroupsRow}>
              {session.muscle_groups.map((group: string) => (
                <View key={group} style={styles.muscleTag}>
                  <Text style={styles.muscleTagText}>{String(group)}</Text>
                </View>
              ))}
            </View>
          )}
      </View>

      <View style={styles.detailSection}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {session.start_time
              ? new Date(session.start_time).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start Time</Text>
          <Text style={styles.detailValue}>
            {formatSessionTime(session.start_time)}
          </Text>
        </View>
        {!!session.end_time && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>End Time</Text>
            <Text style={styles.detailValue}>
              {formatSessionTime(session.end_time)}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>
            {formatTime(session.total_duration as number)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sets Completed</Text>
          <Text
            style={styles.detailValue}
          >{`${session.completed_sets ?? 0}`}</Text>
        </View>
      </View>

      {Array.isArray(session.groupedExercises) &&
        session.groupedExercises.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Exercises</Text>
            {session.groupedExercises.map((exercise: GroupedExercise) => (
              <ExerciseCard
                key={exercise.exerciseName}
                exercise={exercise}
                styles={styles}
              />
            ))}
          </View>
        )}
    </>
  );
}

function ExerciseCard({
  exercise,
  styles,
}: {
  readonly exercise: GroupedExercise;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        {/* exercise_name comes directly from the server JOIN */}
        <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
        <Text
          style={styles.exerciseSetsCount}
        >{`${exercise.sets.length} sets`}</Text>
      </View>

      {exercise.sets.map((set: SetTiming) => (
        <SetTimingCard key={set.set_index} set={set} styles={styles} />
      ))}
    </View>
  );
}

function SetTimingCard({
  set,
  styles,
}: {
  readonly set: SetTiming;
  readonly styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <View style={styles.setTimingCard}>
      <View style={styles.setTimingHeader}>
        <Text style={styles.setTimingTitle}>{`Set ${set.set_index + 1}`}</Text>
      </View>
      <View style={styles.setTimingDetails}>
        <Text style={styles.setTimingDetail}>
          {formatSetVolume(set.weight, set.reps)}
        </Text>
        {!!set.set_duration && (
          <Text style={styles.setTimingDetail}>
            {`Duration: ${formatSetDuration(set.set_duration)}`}
          </Text>
        )}
      </View>
    </View>
  );
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
      backgroundColor: colors.overlay,
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
  });
