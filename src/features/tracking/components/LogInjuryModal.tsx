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
import { injuryApi } from "../services";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, InjuryType } from "../types/muscleRecovery";
import ModalSheet from "@shared/components/ModalSheet";

interface LogInjuryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export const LogInjuryModal: React.FC<LogInjuryModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [muscleGroup, setMuscleGroup] = useState<string>("");
  const [injuryType, setInjuryType] = useState<InjuryType | "">("");
  const [painLevel, setPainLevel] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSelectMuscle = (muscle: string) => {
    setMuscleGroup(muscle);
  };

  const handleSelectInjuryType = (type: InjuryType) => {
    setInjuryType(type);
  };

  const handleSubmit = async () => {
    if (!muscleGroup || !injuryType) {
      setError("Please select a muscle group and injury type");
      return;
    }

    try {
      setError("");
      setSubmitting(true);
      await injuryApi.logInjury({
        muscleGroup: muscleGroup as any,
        injuryType: injuryType as InjuryType,
        painLevel,
        startDate: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      onSuccess();
      setMuscleGroup("");
      setInjuryType("");
      setPainLevel(5);
      setNotes("");
      onClose();
    } catch (err) {
      console.error("Failed to log injury:", err);
      setError("Failed to log injury. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getPainLevelColor = (level: number) => {
    if (level <= 3) return "#6BCB77";
    if (level <= 6) return "#FFD93D";
    return "#FF6B6B";
  };

  return (
    <ModalSheet
      visible={visible}
      title="Log Injury"
      onClose={onClose}
      confirmText="Save"
      confirmDisabled={submitting || !muscleGroup || !injuryType}
      onConfirm={handleSubmit}
      cancelText="Cancel"
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {error ? <Text style={[styles.error, { color: "#FF6B6B" }]}>{error}</Text> : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Affected Muscle Group *
        </Text>
        <View style={styles.muscleGrid}>
          {MUSCLE_GROUPS.map((muscle) => (
            <TouchableOpacity
              key={muscle}
              style={[
                styles.muscleButton,
                {
                  backgroundColor: muscleGroup === muscle ? colors.accent : colors.surface,
                  borderColor: muscleGroup === muscle ? colors.accent : colors.inputBorder,
                },
              ]}
              onPress={() => handleSelectMuscle(muscle)}
            >
              <Text
                style={[
                  styles.muscleButtonText,
                  { color: muscleGroup === muscle ? "white" : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {MUSCLE_GROUP_LABELS[muscle]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
          Injury Type *
        </Text>
        <View style={styles.injuryTypeGrid}>
          {INJURY_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.injuryTypeButton,
                {
                  backgroundColor: injuryType === type.value ? colors.accent : colors.surface,
                  borderColor: injuryType === type.value ? colors.accent : colors.inputBorder,
                },
              ]}
              onPress={() => handleSelectInjuryType(type.value)}
            >
              <Text style={styles.injuryTypeIcon}>{type.icon}</Text>
              <Text
                style={[
                  styles.injuryTypeLabel,
                  { color: injuryType === type.value ? "white" : colors.textPrimary },
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
          Pain Level (0-10)
        </Text>
        <View style={styles.painLevelRow}>
          <View style={styles.painBar}>
            <View
              style={[
                styles.painBarFill,
                {
                  width: `${(painLevel / 10) * 100}%`,
                  backgroundColor: getPainLevelColor(painLevel),
                },
              ]}
            />
          </View>
          <Text style={[styles.painLevelText, { color: colors.textPrimary }]}>
            {painLevel}/10
          </Text>
        </View>
        <View style={styles.painPicker}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.painButton,
                {
                  backgroundColor: painLevel === level ? getPainLevelColor(level) : colors.surface,
                },
              ]}
              onPress={() => setPainLevel(level)}
            >
              <Text
                style={[
                  styles.painButtonText,
                  { color: painLevel === level ? "white" : colors.textPrimary },
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
          Notes (optional)
        </Text>
        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.inputBorder }]}
          placeholder="Describe how the injury occurred, symptoms, etc."
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </ScrollView>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    maxHeight: 600,
  },
  contentContainer: {
    padding: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  muscleButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
  },
  muscleButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  injuryTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  injuryTypeButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  injuryTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  injuryTypeLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  painLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  painBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#00000010",
    borderRadius: 4,
    overflow: "hidden",
  },
  painBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  painLevelText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 40,
  },
  painPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  painButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  painButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
  },
});

export default LogInjuryModal;
