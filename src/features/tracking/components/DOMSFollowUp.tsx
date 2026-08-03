import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { domsApi } from "../services";
import { ActiveSoreness, SorenessFollowUp } from "../types/muscleRecovery";
import { MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";

const FOLLOW_UP_OPTIONS = [
  {
    label: "Still sore",
    value: "still_sore" as const,
    emoji: "😣",
    color: "#FF6B6B",
  },
  { label: "Better", value: "better" as const, emoji: "🙂", color: "#FFD93D" },
  {
    label: "Fully recovered",
    value: "recovered" as const,
    emoji: "💪",
    color: "#6BCB77",
  },
];

const INTENSITY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface DOMSFollowUpProps {
  onMuscleRecovered?: (muscle: string) => void;
  onNavigateToMuscleDashboard?: (muscle: string) => void;
}

export const DOMSFollowUp: React.FC<DOMSFollowUpProps> = ({
  onMuscleRecovered,
  onNavigateToMuscleDashboard,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [activeSoreness, setActiveSoreness] = useState<ActiveSoreness[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<
    Record<string, { status: SorenessFollowUp["status"]; intensity: number; notes: string }>
  >({});

  useEffect(() => {
    loadActiveSoreness();
  }, []);

  const loadActiveSoreness = async () => {
    try {
      setLoading(true);
      const response = await domsApi.getActiveSoreness();
      const data = response?.data ?? response;
      setActiveSoreness(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load active soreness:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async (sorenessId: number, status: SorenessFollowUp["status"]) => {
    const idKey = String(sorenessId);
    const update = pendingUpdates[idKey];
    if (!update) return;

    try {
      setSubmitting(idKey);
      await domsApi.updateSoreness({
        sorenessId,
        intensity: update.intensity,
        status,
        notes: update.notes || undefined,
      });

      if (status === "recovered") {
        onMuscleRecovered?.(
          activeSoreness.find((s) => s.id === sorenessId)?.muscleGroup || ""
        );
      }

      await loadActiveSoreness();
    } catch (error) {
      console.error("Failed to update soreness:", error);
    } finally {
      setSubmitting(null);
    }
  };

  const handleBatchFollowUp = async () => {
    const updates = Object.entries(pendingUpdates).map(([id, update]) => ({
      sorenessId: Number(id),
      intensity: update.intensity,
      status: update.status,
      notes: update.notes || undefined,
    }));

    try {
      setSubmitting("batch");
      await domsApi.batchFollowUp(updates);
      await loadActiveSoreness();
    } catch (error) {
      console.error("Failed to batch update:", error);
    } finally {
      setSubmitting(null);
    }
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return "#6BCB77";
    if (intensity <= 4) return "#FFD93D";
    if (intensity <= 6) return "#FFA94D";
    if (intensity <= 8) return "#FF8787";
    return "#FF6B6B";
  };

  const getIntensityBarWidth = (intensity: number) => {
    return (intensity / 10) * 100;
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          Loading soreness data...
        </Text>
      </View>
    );
  }

  if (activeSoreness.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.noSorenessEmoji, { fontSize: 48 }]}>🎉</Text>
        <Text style={[styles.noSorenessText, { color: colors.textPrimary }]}>
          No active soreness to follow up on!
        </Text>
        <Text style={[styles.noSorenessSubtext, { color: colors.textSecondary }]}>
          Your muscles are fully recovered
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
        Morning Recovery Check ☀️
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        How are your muscles feeling today?
      </Text>

      {activeSoreness.map((soreness) => {
        const muscleLabel = MUSCLE_GROUP_LABELS[soreness.muscleGroup] || soreness.muscleGroup;
        const update = pendingUpdates[soreness.id] || {
          status: "still_sore" as const,
          intensity: soreness.intensity,
          notes: "",
        };

        return (
          <View key={soreness.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <TouchableOpacity
                onPress={() => onNavigateToMuscleDashboard?.(soreness.muscleGroup)}
              >
                <Text style={[styles.muscleName, { color: colors.textPrimary }]}>
                  {muscleLabel}
                </Text>
              </TouchableOpacity>
              <View style={styles.intensityBadge}>
                <View
                  style={[
                    styles.intensityBar,
                    {
                      width: getIntensityBarWidth(soreness.intensity),
                      backgroundColor: getIntensityColor(soreness.intensity),
                    },
                  ]}
                />
                <Text style={[styles.intensityText, { color: colors.textPrimary }]}>
                  {soreness.intensity}/10
                </Text>
              </View>
            </View>

            {soreness.notes && (
              <Text style={[styles.originalNotes, { color: colors.textSecondary }]}>
                Original: {soreness.notes}
              </Text>
            )}

            <Text style={[styles.followUpLabel, { color: colors.textSecondary }]}>
              Update Intensity:
            </Text>
            <View style={styles.intensityPickerRow}>
              {INTENSITY_OPTIONS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.intensityPill,
                    {
                      backgroundColor: update.intensity === val ? getIntensityColor(val) : colors.background,
                      borderColor: update.intensity === val ? getIntensityColor(val) : colors.inputBorder,
                    },
                  ]}
                  onPress={() =>
                    setPendingUpdates((prev) => ({
                      ...prev,
                      [soreness.id]: { ...update, intensity: val },
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.intensityPillText,
                      { color: update.intensity === val ? "white" : colors.textPrimary },
                    ]}
                  >
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.followUpLabel, { color: colors.textSecondary }]}>
              Current Status:
            </Text>

            <View style={styles.optionsRow}>
              {FOLLOW_UP_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor:
                        update.status === option.value ? option.color + "33" : colors.background,
                      borderColor:
                        update.status === option.value ? option.color : colors.inputBorder,
                    },
                  ]}
                  onPress={() =>
                    setPendingUpdates((prev) => ({
                      ...prev,
                      [soreness.id]: { ...update, status: option.value },
                    }))
                  }
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color:
                          update.status === option.value ? option.color : colors.textSecondary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.viewDetailsButton, { marginTop: 12 }]}
              onPress={() => onNavigateToMuscleDashboard?.(soreness.muscleGroup)}
            >
              <Text style={[styles.viewDetailsText, { color: colors.accent }]}>
                View full recovery details →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 },
              ]}
              onPress={() => handleFollowUp(soreness.id, update.status)}
              disabled={!!submitting}
            >
              {submitting === String(soreness.id) ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Update Status</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      {Object.keys(pendingUpdates).length > 0 && (
        <TouchableOpacity
          style={[
            styles.batchSubmitButton,
            { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 },
          ]}
          onPress={handleBatchFollowUp}
          disabled={!!submitting}
        >
          {submitting === "batch" ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.batchSubmitButtonText}>Update All ({Object.keys(pendingUpdates).length})</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  noSorenessEmoji: {
    marginBottom: 12,
  },
  noSorenessText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  noSorenessSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  muscleName: {
    fontSize: 18,
    fontWeight: "600",
  },
  intensityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intensityBar: {
    height: 8,
    borderRadius: 4,
    minWidth: 20,
  },
  intensityText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 35,
  },
  originalNotes: {
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 12,
  },
  followUpLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  viewDetailsButton: {
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  batchSubmitButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  batchSubmitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  intensityPickerRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 8,
  },
  intensityPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  intensityPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default DOMSFollowUp;
