import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { injuryApi } from "../services";
import {
  InjuryRecord,
  InjuryType,
  InjuryStatus,
  MUSCLE_GROUP_LABELS,
} from "../types/muscleRecovery";
import { FillBar } from "@shared/components/FillBar";
import { getSeverityColor } from "@utils/severityColor";

interface InjuryTrackerProps {
  readonly onLogInjury?: () => void;
}

const INJURY_TYPES: { value: InjuryType; label: string; icon: string }[] = [
  { value: "strain", label: "Strain", icon: "💥" },
  { value: "sprain", label: "Sprain", icon: "🤕" },
  { value: "tendonitis", label: "Tendonitis", icon: "🔥" },
  { value: "fracture", label: "Fracture", icon: "🦴" },
  { value: "dislocation", label: "Dislocation", icon: "😰" },
  { value: "tear", label: "Tear", icon: "❌" },
  { value: "overuse", label: "Overuse", icon: "⚠️" },
  { value: "surgery", label: "Surgery", icon: "🏥" },
  { value: "other", label: "Other", icon: "📝" },
];

const STATUS_CONFIG: Record<InjuryStatus, { label: string; color: string; icon: string }> = {
  active: { label: "Active", color: "#FF6B6B", icon: "🔴" },
  recovering: { label: "Recovering", color: "#FFD93D", icon: "🟡" },
  recovered: { label: "Recovered", color: "#6BCB77", icon: "🟢" },
};

export const InjuryTracker: React.FC<InjuryTrackerProps> = ({ onLogInjury }) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [activeInjuries, setActiveInjuries] = useState<InjuryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | InjuryStatus>("all");

  useEffect(() => {
    loadInjuries();
  }, []);

  const loadInjuries = async () => {
    try {
      setLoading(true);
      const allResponse = await injuryApi.getAllInjuries();
      const allData = allResponse?.data ?? allResponse;
      setInjuries(Array.isArray(allData) ? allData : []);

      const activeResponse = await injuryApi.getActiveInjuries();
      const activeData = activeResponse?.data ?? activeResponse;
      setActiveInjuries(Array.isArray(activeData) ? activeData : []);
    } catch (error) {
      console.error("Failed to load injuries:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInjuries =
    filter === "all" ? injuries : injuries.filter((i) => i.status === filter);

  const getStatusBadge = (status: InjuryStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusText}>{config.icon} {config.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          Loading injury history...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeInjuries.length > 0 && (
        <View style={styles.activeAlert}>
          <Text style={[styles.activeAlertTitle, { color: colors.textPrimary }]}>
            ⚠️ Active Injuries
          </Text>
          <Text style={[styles.activeAlertText, { color: colors.textSecondary }]}>
            You have {activeInjuries.length} active injury{activeInjuries.length > 1 ? "ies" : ""}. Proceed with caution during workouts.
          </Text>
        </View>
      )}

      <View style={[styles.header, { justifyContent: "flex-end" }]}>
        <TouchableOpacity
          style={[styles.logInjuryButton, { backgroundColor: colors.accent }]}
          onPress={onLogInjury}
        >
          <Text style={styles.logInjuryButtonText}>+ Log Injury</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {[
          { value: "all", label: "All" },
          ...Object.keys(STATUS_CONFIG).map((status) => ({
            value: status as InjuryStatus,
            label: STATUS_CONFIG[status as InjuryStatus].label,
          })),
        ].map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterButton,
              {
                backgroundColor: filter === f.value ? colors.accent : colors.surface,
              },
            ]}
            onPress={() => setFilter(f.value as "all" | InjuryStatus)}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filter === f.value ? "white" : colors.textPrimary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredInjuries}
        keyExtractor={(injury) => String(injury.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyEmoji, { fontSize: 48 }]}>🎉</Text>
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
              No injuries recorded
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Stay injury-free!
            </Text>
          </View>
        }
        renderItem={({ item: injury }) => {
          const muscleLabel =
            MUSCLE_GROUP_LABELS[injury.muscleGroup] || injury.muscleGroup;
          const injuryType = INJURY_TYPES.find((t) => t.value === injury.injuryType);

          return (
            <View style={[styles.injuryCard, { backgroundColor: colors.surface }]}>
                <View style={styles.injuryHeader}>
                  <View style={styles.injuryTitleRow}>
                    <Text style={[styles.injuryMuscle, { color: colors.textPrimary }]}>
                      {muscleLabel}
                    </Text>
                    {getStatusBadge(injury.status)}
                  </View>
                </View>

                <View style={styles.injuryDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Type:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {injuryType?.icon} {injuryType?.label || injury.injuryType}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Pain Level:
                    </Text>
                    <View style={styles.painLevelRow}>
                      <FillBar
                        percentage={(injury.painLevel / 10) * 100}
                        color={getSeverityColor(injury.painLevel, 3)}
                        styles={{ track: styles.painBar, fill: styles.painBarFill }}
                      />
                      <Text style={[styles.painLevelText, { color: colors.textPrimary }]}>
                        {injury.painLevel}/10
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Date:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {new Date(injury.startDate).toLocaleDateString()}
                    </Text>
                  </View>

                  {injury.recoveryDate && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Recovered:
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                        {new Date(injury.recoveryDate).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>

                {injury.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                      Notes:
                    </Text>
                    <Text style={[styles.notesText, { color: colors.textPrimary }]}>
                      {injury.notes}
                    </Text>
                  </View>
                )}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  activeAlert: {
    backgroundColor: "#FFF3CD",
    padding: 12,
    borderRadius: 8,
    margin: 16,
  },
  activeAlertTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  activeAlertText: {
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logInjuryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  logInjuryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
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
  injuryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  injuryHeader: {
    marginBottom: 12,
  },
  injuryTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  injuryMuscle: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  injuryDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  detailValue: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
  },
  painLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  painBar: {
    width: 60,
    height: 6,
    backgroundColor: "#00000010",
    borderRadius: 3,
    overflow: "hidden",
  },
  painBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  painLevelText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 35,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#00000015",
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default InjuryTracker;
