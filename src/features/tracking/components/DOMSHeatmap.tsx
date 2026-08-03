import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { domsApi } from "../services";
import { DOMSStats, MuscleRecoveryStats, MuscleGroup } from "../types/muscleRecovery";
import { MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface DOMSHeatmapProps {
  dateRange?: "30d" | "90d" | "180d" | "1y";
  onSelectMuscle?: (muscle: string) => void;
}

type DayData = {
  date: string;
  severity: number;
  muscleCount: number;
};

export const DOMSHeatmap: React.FC<DOMSHeatmapProps> = ({ dateRange = "90d", onSelectMuscle }) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [stats, setStats] = useState<DOMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<DayData[]>([]);

  useEffect(() => {
    loadStats();
  }, [dateRange]);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Convert dateRange string to number of days
      const daysMap: Record<string, number> = { "30d": 30, "90d": 90, "180d": 180, "1y": 365 };
      const days = daysMap[dateRange] || 90;
      const response = await domsApi.getStats(days);
      const data = response?.data ?? response;
      setStats(data as DOMSStats);

      // Calendar data would come from a dedicated calendar API endpoint
      // For now, leave calendarData empty until the API supports it
    } catch (error) {
      console.error("Failed to load DOMS stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity === 0) return colors.surface;
    if (severity <= 2) return "#C6F6D5";
    if (severity <= 4) return "#F6E05E";
    if (severity <= 6) return "#F6AD55";
    if (severity <= 8) return "#FC8181";
    return "#F56565";
  };

  const getRecoveryTimeLabel = (days: number) => {
    const roundedDays = Math.round(days);
    if (roundedDays < 1) return "< 1 day";
    if (roundedDays === 1) return "1 day";
    return `${roundedDays} days`;
  };

  const sortedMuscles = useMemo(() => {
    if (!stats?.muscleRecoveryStats) return [];
    return [...stats.muscleRecoveryStats].sort((a, b) => b.totalEpisodes - a.totalEpisodes);
  }, [stats]);

  const topSoreMuscles = sortedMuscles.filter((m) => m.totalEpisodes > 0).slice(0, 5);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          Loading recovery stats...
        </Text>
      </View>
    );
  }

  if (!stats || !stats.muscleRecoveryStats || stats.muscleRecoveryStats.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyEmoji, { fontSize: 48 }]}>📊</Text>
        <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
          No recovery data yet
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          Start logging soreness to see your recovery patterns
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Recovery Analytics 📈
      </Text>

      {/* Summary Stats */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
          Overview
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {stats.muscleRecoveryStats.reduce((sum, m) => sum + m.totalEpisodes, 0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Total Episodes
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {stats.muscleRecoveryStats.filter((m) => m.isCurrentlySore).length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Active
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {getRecoveryTimeLabel(
                stats.muscleRecoveryStats.reduce((sum, m) => sum + (m.averageRecoveryDays || 0), 0) /
                  (stats.muscleRecoveryStats.length || 1)
              )}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Avg Recovery
            </Text>
          </View>
        </View>
      </View>

      {/* Calendar Heatmap */}
      {calendarData.length > 0 && (
        <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.calendarTitle, { color: colors.textPrimary }]}>
            Soreness Calendar
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.calendarGrid}>
              {calendarData.slice(0, 30).map((day, index) => (
                <View key={index} style={styles.calendarDay}>
                  <View
                    style={[
                      styles.calendarCell,
                      {
                        backgroundColor: getSeverityColor(day.severity),
                      },
                    ]}
                  />
                  <Text style={[styles.calendarDate, { color: colors.textSecondary }]}>
                    {new Date(day.date).getDate()}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.legend}>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
            <View style={[styles.legendCell, { backgroundColor: "#C6F6D5" }]} />
            <View style={[styles.legendCell, { backgroundColor: "#F6E05E" }]} />
            <View style={[styles.legendCell, { backgroundColor: "#F6AD55" }]} />
            <View style={[styles.legendCell, { backgroundColor: "#FC8181" }]} />
            <View style={[styles.legendCell, { backgroundColor: "#F56565" }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More</Text>
          </View>
        </View>
      )}

      {/* Top Sore Muscles */}
      {topSoreMuscles.length > 0 && (
        <View style={[styles.muscleCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.muscleCardTitle, { color: colors.textPrimary }]}>
            Most Frequently Sore
          </Text>
          {topSoreMuscles.map((muscle, index) => {
            const label = MUSCLE_GROUP_LABELS[muscle.muscleGroup] || muscle.muscleGroup;
            const percentage = stats.muscleRecoveryStats.length
              ? Math.round((muscle.totalEpisodes / stats.muscleRecoveryStats.reduce((s, m) => s + m.totalEpisodes, 0)) * 100)
              : 0;

            return (
              <TouchableOpacity
                key={muscle.muscleGroup}
                style={styles.muscleRow}
                onPress={() => {
                  setSelectedMuscle(selectedMuscle === muscle.muscleGroup ? null : muscle.muscleGroup);
                  onSelectMuscle?.(muscle.muscleGroup);
                }}
              >
                <Text style={[styles.muscleRank, { color: colors.textSecondary }]}>
                  #{index + 1}
                </Text>
                <View style={styles.muscleInfo}>
                  <Text style={[styles.muscleLabel, { color: colors.textPrimary }]}>
                    {label}
                  </Text>
                  <View style={styles.muscleBar}>
                    <View
                      style={[
                        styles.muscleBarFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.muscleStats}>
                  <Text style={[styles.muscleFrequency, { color: colors.textPrimary }]}>
                    {muscle.totalEpisodes}x
                  </Text>
                  {muscle.averageRecoveryDays && (
                    <Text style={[styles.muscleRecovery, { color: colors.textSecondary }]}>
                      {getRecoveryTimeLabel(muscle.averageRecoveryDays)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Recovery Trends */}
      {stats.severityTrend && stats.severityTrend.length > 0 && (
        <View style={[styles.trendCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.trendTitle, { color: colors.textPrimary }]}>
            Severity Trend
          </Text>
          <View style={styles.trendChart}>
            {stats.severityTrend.slice(-7).map((point, index) => {
              const maxSeverity = Math.max(...stats.severityTrend.map((p) => p.averageIntensity), 1);
              const heightPercentage = (point.averageIntensity / maxSeverity) * 100;

              return (
                <View key={index} style={styles.trendColumn}>
                  <View style={styles.trendBarContainer}>
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: `${heightPercentage}%`,
                          backgroundColor:
                            point.averageIntensity <= 3 ? "#6BCB77" : point.averageIntensity <= 6 ? "#FFD93D" : "#FF6B6B",
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.trendDate, { color: colors.textSecondary }]}>
                    {new Date(point.date).getDate()}
                  </Text>
                  <Text style={[styles.trendValue, { color: colors.textPrimary }]}>
                    {point.averageIntensity.toFixed(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyEmoji: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  calendarCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  calendarGrid: {
    flexDirection: "row",
    gap: 8,
  },
  calendarDay: {
    alignItems: "center",
  },
  calendarCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginBottom: 4,
  },
  calendarDate: {
    fontSize: 10,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  muscleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  muscleCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  muscleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#00000015",
  },
  muscleRank: {
    fontSize: 14,
    fontWeight: "600",
    width: 24,
  },
  muscleInfo: {
    flex: 1,
    marginRight: 12,
  },
  muscleLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  muscleBar: {
    height: 6,
    backgroundColor: "#00000010",
    borderRadius: 3,
  },
  muscleBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  muscleStats: {
    alignItems: "flex-end",
  },
  muscleFrequency: {
    fontSize: 14,
    fontWeight: "600",
  },
  muscleRecovery: {
    fontSize: 12,
    marginTop: 2,
  },
  trendCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  trendChart: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 150,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  trendBarContainer: {
    height: 100,
    width: 24,
    justifyContent: "flex-end",
  },
  trendBar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 4,
  },
  trendDate: {
    fontSize: 10,
    marginTop: 6,
  },
  trendValue: {
    fontSize: 10,
    fontWeight: "600",
  },
});

export default DOMSHeatmap;
