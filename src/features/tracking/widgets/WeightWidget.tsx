import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ProgressChart from "@shared/components/ProgressChart";
import UniversalCalendar from "@shared/components/UniversalCalendar";

export interface WeightRenderCtx {
  history: any[];
  weightUnit: string;
  entriesShown: number;
  trendAverageDays: number;
  setTrendAverageDays: (d: number) => void;
  trend: {
    direction: string;
    diff: number;
    percentChange: number;
    daysCompared: number;
  } | null;
  chartData: { labels: string[]; datasets: { data: number[] }[] };
  loadMoreEntries: () => void;
  deleteWeightEntry: (entry: any) => void;
  openWeightModal: () => void;
  setSelectedLogDate: (date: Date | null) => void;
  hasDataOnDate: (date: Date) => boolean;
  colors: any;
  styles: any;
  handleCalendarDatePress: (date: Date, type: string) => void;
}

export function renderWeightWidget(
  type: string,
  ctx: WeightRenderCtx,
): React.ReactNode {
  const {
    history,
    weightUnit,
    entriesShown,
    trend,
    trendAverageDays,
    setTrendAverageDays,
    chartData,
    loadMoreEntries,
    deleteWeightEntry,
    openWeightModal,
    setSelectedLogDate,
    hasDataOnDate,
    colors,
    styles,
    handleCalendarDatePress,
  } = ctx;

  switch (type) {
    case "weight_overview": {
      return history.length > 0 ? (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Current Weight</Text>
          <Text style={styles.statsValue}>
            {weightUnit === "kg"
              ? `${Number(history[0].weight_kg).toFixed(1)} kg`
              : `${(Number(history[0].weight_kg) * 2.20462).toFixed(1)} lbs`}
          </Text>
          <Text style={styles.statsDate}>
            {new Date(history[0].recorded_at).toLocaleDateString()}
          </Text>
          {trend && (
            <View style={styles.trendContainer}>
              <View
                style={[
                  styles.trendBadge,
                  trend.direction === "up"
                    ? styles.trendUp
                    : trend.direction === "down"
                      ? styles.trendDown
                      : styles.trendStable,
                ]}
              >
                <Text style={styles.trendIcon}>
                  {trend.direction === "up"
                    ? "↗"
                    : trend.direction === "down"
                      ? "↘"
                      : "→"}
                </Text>
                <Text style={styles.trendText}>
                  {Math.abs(trend.diff).toFixed(1)} {weightUnit}
                </Text>
                <Text style={styles.trendPercent}>
                  ({trend.percentChange > 0 ? "+" : ""}
                  {trend.percentChange.toFixed(1)}%)
                </Text>
              </View>
              <Text style={styles.trendSubtext}>
                vs. {trend.daysCompared}-day average
              </Text>
              <View style={styles.trendSelector}>
                {[3, 7, 14, 30].map((days: number) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.trendOption,
                      trendAverageDays === days && styles.trendOptionActive,
                    ]}
                    onPress={() => setTrendAverageDays(days)}
                  >
                    <Text
                      style={[
                        styles.trendOptionText,
                        trendAverageDays === days &&
                          styles.trendOptionTextActive,
                      ]}
                    >
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setSelectedLogDate(null);
              openWeightModal();
            }}
          >
            <Text style={styles.primaryButtonText}>+ Log Weight</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No weight data logged yet</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setSelectedLogDate(null);
              openWeightModal();
            }}
          >
            <Text style={styles.primaryButtonText}>+ Log Weight</Text>
          </TouchableOpacity>
        </View>
      );
    }

    case "weight_calendar":
      return (
        <UniversalCalendar
          hasDataOnDate={hasDataOnDate}
          onDatePress={(date: Date) => handleCalendarDatePress(date, "weight")}
          initialView='month'
          legendText='Weight logged · tap any day to view/add'
          dotColor={colors.accent}
        />
      );

    case "weight_history": {
      if (history.length === 0)
        return (
          <Text style={styles.widgetLineMuted}>
            Log a weight entry to see your history here.
          </Text>
        );
      return (
        <View>
          {history.slice(0, entriesShown).map((entry, index) => {
            const val =
              weightUnit === "kg"
                ? `${Number(entry.weight_kg).toFixed(1)} kg`
                : `${(Number(entry.weight_kg) * 2.20462).toFixed(1)} lbs`;
            const isLatest = index === 0;
            return (
              <View
                key={entry.id ?? index}
                style={[
                  styles.weightEntryRow,
                  index === history.slice(0, entriesShown).length - 1 &&
                    styles.weightEntryRowBorder,
                ]}
              >
                <View>
                  <Text style={styles.weightEntryDate}>
                    {new Date(entry.recorded_at).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.weightEntryTime}>
                    {new Date(entry.recorded_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <View style={styles.weightEntryRight}>
                  <View style={styles.weightEntryValueRow}>
                    <Text
                      style={[
                        styles.weightEntryValue,
                        isLatest && styles.weightEntryValueLatest,
                      ]}
                    >
                      {val}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteEntryBtn}
                      onPress={() => deleteWeightEntry(entry)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.deleteEntryBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                  {isLatest && (
                    <Text style={styles.weightEntryLatestBadge}>latest</Text>
                  )}
                </View>
              </View>
            );
          })}
          {entriesShown < history.length && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={loadMoreEntries}
            >
              <Text style={styles.loadMoreText}>
                View More ({history.length - entriesShown} more)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    case "weight_chart": {
      if (history.length <= 1)
        return (
          <Text style={styles.widgetLineMuted}>
            Log at least two weight entries to see a trend chart here.
          </Text>
        );
      return <ProgressChart data={chartData} yAxisSuffix={weightUnit} />;
    }

    default:
      return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
  }
}
