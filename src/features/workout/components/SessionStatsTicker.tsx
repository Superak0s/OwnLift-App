import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useWorkout } from "@shared/context/WorkoutContext";
import { formatTime as formatDuration } from "@utils/timeEstimation";
import {
  getNotifications,
  scheduleNotification,
  cancelNotification,
} from "@shared/services/notifications";
import { initializeSupplementNotifications } from "../../../../tasks/supplementLocationTask";
import type { makeStyles } from "../WorkoutScreen";

// Owns its own 1s interval and state so the per-second tick re-renders only
// this widget, not the whole WorkoutScreen (see note on ExerciseCard).

type ExerciseCardStyles = ReturnType<typeof makeStyles>;

type SessionStatsWidgetProps = {
  workoutStartTime: string | null;
  isCurrentDayLocked: boolean;
  currentDay: number;
  restReminderEnabled: boolean;
  restReminderSeconds: number;
  onOpenReminderModal: () => void;
  styles: ExerciseCardStyles;
};

export const SessionStatsWidget = React.memo(function SessionStatsWidget({
  workoutStartTime,
  isCurrentDayLocked,
  currentDay,
  restReminderEnabled,
  restReminderSeconds,
  onOpenReminderModal,
  styles,
}: SessionStatsWidgetProps) {
  const {
    getSessionStats,
    getCurrentRestTime,
    getTotalSessionTime,
    getSessionAverageRestTime,
    lastSetEndTime,
  } = useWorkout();
  const [sessionStats, setSessionStats] = useState<Record<
    string,
    unknown
  > | null>(null);
  const scheduledNotifIdRef = useRef<string | null>(null);

  // Ticks the displayed stats every second while the screen is open. The
  // reminder notification itself is scheduled separately below with a real
  // OS-level trigger, since this interval is throttled/paused once the app
  // backgrounds or the screen locks and can't be relied on to fire on time.
  useEffect(() => {
    if (!workoutStartTime || isCurrentDayLocked) return;

    const interval = setInterval(() => {
      setSessionStats(
        getSessionStats(currentDay) as Record<string, unknown> | null,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime, isCurrentDayLocked, currentDay, getSessionStats]);

  useEffect(() => {
    const cancelPending = async () => {
      if (scheduledNotifIdRef.current) {
        await cancelNotification(scheduledNotifIdRef.current).catch(() => {});
        scheduledNotifIdRef.current = null;
      }
    };

    if (
      !workoutStartTime ||
      isCurrentDayLocked ||
      !lastSetEndTime ||
      !restReminderEnabled ||
      restReminderSeconds <= 0
    ) {
      void cancelPending();
      return;
    }

    (async () => {
      await cancelPending();
      try {
        // No-op in Expo Go — Notifications module is never loaded there.
        const Notifications = await getNotifications();
        if (!Notifications) return;
        const ready = await initializeSupplementNotifications();
        if (!ready) return;
        const identifier = await scheduleNotification({
          content: {
            title: `⏱️ Time to start your next set`,
            body: `You've rested ${formatDuration(restReminderSeconds)}. Start your next set when ready.`,
            data: { type: "rest_reminder" },
            priority: Notifications.AndroidNotificationPriority.HIGH,
            ...(Platform.OS === "android" && {
              channelId: "supplement-reminders",
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: restReminderSeconds,
            repeats: false,
          },
        });
        scheduledNotifIdRef.current = identifier;
      } catch (err) {
        console.warn("Failed to schedule rest reminder:", err);
      }
    })();

    return () => {
      void cancelPending();
    };
  }, [
    workoutStartTime,
    isCurrentDayLocked,
    lastSetEndTime,
    restReminderEnabled,
    restReminderSeconds,
  ]);

  if (!workoutStartTime || isCurrentDayLocked || !sessionStats) {
    return (
      <Text style={styles.widgetLineMuted}>
        Starts once you begin a session.
      </Text>
    );
  }

  const totalSessionTime = getTotalSessionTime();
  const sessionAvgRest = getSessionAverageRestTime(currentDay);
  const currentRest = getCurrentRestTime();

  return (
    <View>
      <View style={styles.sessionStatsRow}>
        <View style={styles.sessionStat}>
          <Text style={styles.sessionStatLabel}>⏱️ Total Time</Text>
          <Text style={styles.sessionStatValue}>
            {formatDuration(totalSessionTime)}
          </Text>
        </View>
        <View style={styles.sessionStat}>
          <Text style={styles.sessionStatLabel}>💤 Avg Rest/Set</Text>
          <Text style={styles.sessionStatValue}>
            {formatDuration(Math.round(sessionAvgRest))}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.sessionStat}
          onPress={onOpenReminderModal}
        >
          <Text style={styles.sessionStatLabel}>⏰ Reminder</Text>
          <Text style={styles.sessionStatValue}>
            {restReminderEnabled && restReminderSeconds > 0
              ? formatDuration(restReminderSeconds)
              : "Off"}
          </Text>
        </TouchableOpacity>
      </View>
      {currentRest > 0 && (
        <View style={styles.currentRestContainer}>
          <Text style={styles.currentRestLabel}>Rest since last set:</Text>
          <Text
            style={[
              styles.currentRestValue,
              currentRest > sessionAvgRest && styles.currentRestOvertime,
            ]}
          >
            {formatDuration(currentRest)}
            {currentRest > sessionAvgRest && (
              <Text style={styles.overtimeText}>
                {" "}
                (+{formatDuration(Math.round(currentRest - sessionAvgRest))})
              </Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
});
