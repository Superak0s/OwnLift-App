import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import ProgressChart from "@shared/components/ProgressChart";
import ModalSheet from "@shared/components/ModalSheet";
import UniversalCalendar from "@shared/components/UniversalCalendar";
import { useTheme } from "@shared/context/ThemeContext";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { WorkoutData, FullSessionWithGroups } from "@shared/types";
import type { CompletedDays } from "../types";
import { loadFromStorage, STORAGE_KEYS } from "@shared/services/storage";
import {
  buildTrainingSetEntries,
  getPeriodDateRange,
  aggregateTrainingSummary,
  getUndertrainedMuscleGroups,
  type SummaryPeriod,
  type DateRange,
} from "../utils/trainingSummary";

const { width: screenWidth } = Dimensions.get("window");
const MUSCLE_GROUP_BAR_COLORS = [
  "#4C6EF5", "#12B886", "#FA5252", "#FAB005", "#7950F2", "#15AABF", "#E64980", "#82C91E",
];

type Session = Pick<FullSessionWithGroups, "day_number" | "start_time" | "set_timings">;

interface Props {
  readonly sessions?: Session[];
  readonly workoutData?: WorkoutData | null;
  readonly selectedSplit?: string | null;
  readonly completedDays?: CompletedDays;
  readonly onRefresh?: (() => void) | null;
  readonly refreshing?: boolean;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly userId?: string | number | null;
}

const fmt = (value?: number | null): string => {
  const n = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(n)) return "0";
  return Number.parseFloat(n.toFixed(2)).toString();
};

export default function TrainingSummaryTab({
  sessions = [],
  workoutData = null,
  selectedSplit = null,
  completedDays = {},
  onRefresh = null,
  refreshing = false,
  isLoading = false,
  error = null,
  userId = null,
}: Readonly<Props>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("today");
  const [summaryCustomRange, setSummaryCustomRange] = useState<DateRange | null>(null);
  const [summaryMetric, setSummaryMetric] = useState<"sets" | "volume">("sets");
  const [showSummaryRangePicker, setShowSummaryRangePicker] = useState(false);
  const [pendingRangeStart, setPendingRangeStart] = useState<Date | null>(null);
  const [calculationMode, setCalculationMode] = useState<
    "days_done" | "full_split"
  >("days_done");

  useEffect(() => {
    (async () => {
      const mode = await loadFromStorage<string>(
        STORAGE_KEYS.UNDERTRAINED_CALCULATION_MODE,
        userId == null ? null : String(userId),
        false,
      );
      if (mode) setCalculationMode(mode as "days_done" | "full_split");
    })();
  }, [userId]);

  const chartWidth = screenWidth - 40;

  const allSetEntries = useMemo(
    () => buildTrainingSetEntries(sessions, workoutData, selectedSplit, completedDays),
    [sessions, workoutData, selectedSplit, completedDays],
  );

  const summaryRange = useMemo(
    () => getPeriodDateRange(summaryPeriod, summaryCustomRange),
    [summaryPeriod, summaryCustomRange],
  );

  const trainingSummary = useMemo(
    () => aggregateTrainingSummary(allSetEntries, summaryRange),
    [allSetEntries, summaryRange],
  );

  const undertrainedGroups = useMemo(
    () =>
      getUndertrainedMuscleGroups(
        allSetEntries,
        workoutData,
        selectedSplit,
        new Date(),
        calculationMode,
      ),
    [allSetEntries, workoutData, selectedSplit, calculationMode],
  );
  const topUndertrained = undertrainedGroups[0] ?? null;

  const handleSummaryRangeDatePress = (date: Date) => {
    if (!pendingRangeStart) {
      setPendingRangeStart(date);
      return;
    }
    setSummaryCustomRange({ start: pendingRangeStart, end: date });
    setPendingRangeStart(null);
    setShowSummaryRangePicker(false);
    setSummaryPeriod("custom");
  };

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyTitle}>Something went wrong</Text>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  const periodOptions: { key: SummaryPeriod; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  const metricValue = (row: { sets: number; volume: number }): number =>
    summaryMetric === "sets" ? row.sets : row.volume;
  const sortedMuscleGroups = [...trainingSummary.muscleGroups].sort(
    (a, b) => metricValue(b) - metricValue(a),
  );
  const sortedExercises = [...trainingSummary.exercises].sort(
    (a, b) => metricValue(b) - metricValue(a),
  );

  const muscleChartData =
    sortedMuscleGroups.length > 0
      ? {
          labels: sortedMuscleGroups.map((row) => row.muscleGroup),
          datasets: [
            {
              data: sortedMuscleGroups.map((row) =>
                summaryMetric === "sets" ? row.sets : Math.round(row.volume),
              ),
            },
          ],
        }
      : { labels: ["No data"], datasets: [{ data: [0] }] };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {topUndertrained && (
        <View style={styles.undertrainedCard}>
          <Text style={styles.undertrainedTitle}>
            💪 {topUndertrained.muscleGroup} is behind this week
          </Text>
          <Text style={styles.undertrainedSubtitle}>
            {Math.round(topUndertrained.deltaFromAvg)} points below average —{" "}
            {topUndertrained.actualSets} of {topUndertrained.targetSets} planned sets
          </Text>
        </View>
      )}

      <View style={styles.periodRow}>
        {periodOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.periodChip, summaryPeriod === option.key && styles.periodChipActive]}
            onPress={() => {
              if (option.key === "custom") {
                setPendingRangeStart(null);
                setShowSummaryRangePicker(true);
                return;
              }
              setSummaryPeriod(option.key);
            }}
          >
            <Text
              style={[
                styles.periodChipText,
                summaryPeriod === option.key && styles.periodChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.metricToggle}>
        <TouchableOpacity
          style={[styles.metricButton, summaryMetric === "sets" && styles.metricButtonActive]}
          onPress={() => setSummaryMetric("sets")}
        >
          <Text
            style={[
              styles.metricButtonText,
              summaryMetric === "sets" && styles.metricButtonTextActive,
            ]}
          >
            Sets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.metricButton, summaryMetric === "volume" && styles.metricButtonActive]}
          onPress={() => setSummaryMetric("volume")}
        >
          <Text
            style={[
              styles.metricButtonText,
              summaryMetric === "volume" && styles.metricButtonTextActive,
            ]}
          >
            Volume
          </Text>
        </TouchableOpacity>
      </View>

      {sortedMuscleGroups.length === 0 ? (
        <Text style={styles.emptyMuted}>No sets logged in this period yet.</Text>
      ) : (
        <>
          <ProgressChart
            title="By Muscle Group"
            data={muscleChartData}
            chartType="bar"
            chartWidth={chartWidth}
            barColors={sortedMuscleGroups.map(
              (_, i) => MUSCLE_GROUP_BAR_COLORS[i % MUSCLE_GROUP_BAR_COLORS.length],
            )}
            yAxisSuffix={summaryMetric === "volume" ? "kg" : ""}
          />

          <Text style={styles.listHeader}>By Exercise</Text>
          {sortedExercises.slice(0, 15).map((row) => (
            <View key={row.exerciseName} style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <Text style={styles.listRowText}>{row.exerciseName}</Text>
                {row.muscleGroup && <Text style={styles.listRowMuscle}>{row.muscleGroup}</Text>}
              </View>
              <Text style={styles.listRowValue}>
                {summaryMetric === "sets" ? `${row.sets} sets` : `${fmt(row.volume)}kg`}
              </Text>
            </View>
          ))}
          {sortedExercises.length > 15 && (
            <Text style={styles.emptyMuted}>+{sortedExercises.length - 15} more</Text>
          )}
        </>
      )}

      <ModalSheet
        visible={showSummaryRangePicker}
        onClose={() => {
          setShowSummaryRangePicker(false);
          setPendingRangeStart(null);
        }}
        title={pendingRangeStart ? "Select end date" : "Select start date"}
        showCancelButton={false}
        showConfirmButton={false}
      >
        <UniversalCalendar
          hasDataOnDate={() => false}
          onDatePress={handleSummaryRangeDatePress}
          initialView="month"
          legendText="Tap a start date, then an end date"
        />
      </ModalSheet>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { padding: 20 },
    undertrainedCard: {
      backgroundColor: colors.warningLight,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#fcd34d",
    },
    undertrainedTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
    undertrainedSubtitle: { fontSize: 12, color: "#92400e", marginTop: 2 },
    periodRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
    periodChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    periodChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    periodChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    periodChipTextActive: { color: colors.surface },
    metricToggle: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 4,
      marginBottom: 16,
    },
    metricButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    metricButtonActive: { backgroundColor: colors.accent },
    metricButtonText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    metricButtonTextActive: { color: colors.surface },
    listHeader: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 8,
    },
    listRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    listRowLeft: { flex: 1 },
    listRowText: { fontSize: 16, fontWeight: "500", color: colors.textPrimary, marginBottom: 4 },
    listRowMuscle: { fontSize: 13, color: colors.textSecondary },
    listRowValue: { fontSize: 13, color: colors.success, fontWeight: "600" },
    emptyMuted: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    emptyIcon: { fontSize: 64, marginBottom: 20 },
    emptyTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: "center",
    },
    emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24 },
    loadingText: { marginTop: 12, fontSize: 16, color: colors.textSecondary },
  });
