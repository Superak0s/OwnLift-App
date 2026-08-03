import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { useTheme } from "@shared/context/ThemeContext";
import { domsApi } from "../services";
import { MuscleGroup, MUSCLE_GROUP_LABELS } from "../types/muscleRecovery";
import ModalSheet from "@shared/components/ModalSheet";

interface MuscleSorenessModalProps {
  visible: boolean;
  muscleGroup: MuscleGroup;
  onClose: () => void;
  onSuccess: () => void;
  stayOpen?: boolean;
}

const INTENSITY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const MuscleSorenessModal: React.FC<MuscleSorenessModalProps> = ({
  visible,
  muscleGroup,
  onClose,
  onSuccess,
  stayOpen,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const muscleLabel = MUSCLE_GROUP_LABELS[muscleGroup] || muscleGroup;

  const getIntensityLabel = (value: number) => {
    if (value === 0) return "No soreness";
    if (value <= 3) return "Mild";
    if (value <= 6) return "Moderate";
    if (value <= 8) return "Severe";
    return "Extreme";
  };

  const getIntensityColor = (value: number) => {
    if (value <= 2) return "#6BCB77";
    if (value <= 4) return "#FFD93D";
    if (value <= 6) return "#FFA94D";
    if (value <= 8) return "#FF8787";
    return "#FF6B6B";
  };

  const handleSubmit = async () => {
    if (intensity === 0) {
      onClose();
      return;
    }

    try {
      setSubmitting(true);
      await domsApi.logSoreness({
        muscleGroup,
        intensity,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      setIntensity(5);
      setNotes("");
      // Only close if stayOpen is false — allows multi-muscle sessions
      if (!stayOpen) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to log soreness:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      title={`Log Soreness: ${muscleLabel}`}
      onClose={onClose}
      confirmText="Save"
      confirmDisabled={submitting}
      onConfirm={handleSubmit}
      cancelText="Cancel"
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Soreness Intensity (0-10)
        </Text>

        <View style={styles.intensityDisplay}>
          <Text style={[styles.intensityValue, { color: getIntensityColor(intensity) }]}>
            {intensity}
          </Text>
          <Text style={[styles.intensityLabel, { color: colors.textPrimary }]}>
            {getIntensityLabel(intensity)}
          </Text>
        </View>

        <View style={styles.intensityPicker}>
          {INTENSITY_OPTIONS.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.intensityButton,
                {
                  backgroundColor: intensity === value ? getIntensityColor(value) : colors.surface,
                  borderColor: intensity === value ? getIntensityColor(value) : colors.inputBorder,
                },
              ]}
              onPress={() => setIntensity(value)}
            >
              <Text
                style={[
                  styles.intensityButtonText,
                  { color: intensity === value ? "white" : colors.textPrimary },
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.intensityBar}>
          <View
            style={[
              styles.intensityBarFill,
              {
                width: `${(intensity / 10) * 100}%`,
                backgroundColor: getIntensityColor(intensity),
              },
            ]}
          />
        </View>

        <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
          Notes (optional)
        </Text>
        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.inputBorder }]}
          placeholder="What were you doing when this muscle got sore?"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={[styles.tip, { color: colors.textSecondary }]}>
          💡 Tip: Log soreness soon after your workout for more accurate recovery tracking
        </Text>
      </ScrollView>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    maxHeight: 500,
  },
  contentContainer: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  intensityDisplay: {
    alignItems: "center",
    marginBottom: 16,
  },
  intensityValue: {
    fontSize: 48,
    fontWeight: "700",
  },
  intensityLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  intensityPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  intensityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  intensityButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  intensityBar: {
    height: 8,
    backgroundColor: "#00000010",
    borderRadius: 4,
    marginBottom: 16,
    overflow: "hidden",
  },
  intensityBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    marginBottom: 12,
  },
  tip: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
});

export default MuscleSorenessModal;
