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
import { IntensityPicker } from "@shared/components/IntensityPicker";
import { FillBar } from "@shared/components/FillBar";
import { getSeverityColor } from "@utils/severityColor";

interface LogInjuryModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
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
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [muscleSearch, setMuscleSearch] = useState("");
  const [injuryType, setInjuryType] = useState<InjuryType | "">("");
  const [painLevel, setPainLevel] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredMuscles = MUSCLE_GROUPS.filter((muscle) =>
    MUSCLE_GROUP_LABELS[muscle].toLowerCase().includes(muscleSearch.trim().toLowerCase()),
  );

  const handleSelectMuscle = (muscle: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  };

  const handleSelectInjuryType = (type: InjuryType) => {
    setInjuryType(type);
  };

  const handleSubmit = async () => {
    if (selectedMuscles.length === 0 || !injuryType) {
      setError("Please select at least one muscle group and an injury type");
      return;
    }

    try {
      setError("");
      setSubmitting(true);
      await Promise.all(
        selectedMuscles.map((muscleGroup) =>
          injuryApi.logInjury({
            muscleGroup: muscleGroup as any,
            injuryType: injuryType as InjuryType,
            painLevel,
            startDate: new Date().toISOString(),
            notes: notes.trim() || undefined,
          }),
        ),
      );
      onSuccess();
      setSelectedMuscles([]);
      setMuscleSearch("");
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

  return (
    <ModalSheet
      visible={visible}
      title="Log Injury"
      onClose={onClose}
      confirmText="Save"
      confirmDisabled={submitting || selectedMuscles.length === 0 || !injuryType}
      onConfirm={handleSubmit}
      cancelText="Cancel"
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {error ? <Text style={[styles.error, { color: "#FF6B6B" }]}>{error}</Text> : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Affected Muscle Group{selectedMuscles.length > 1 ? "s" : ""} * {selectedMuscles.length > 0 ? `(${selectedMuscles.length} selected)` : ""}
        </Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.inputBorder }]}
          placeholder="Search muscle groups..."
          placeholderTextColor={colors.textSecondary}
          value={muscleSearch}
          onChangeText={setMuscleSearch}
        />
        <View style={styles.muscleGrid}>
          {filteredMuscles.map((muscle) => {
            const isSelected = selectedMuscles.includes(muscle);
            return (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.muscleButton,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.inputBorder,
                  },
                ]}
                onPress={() => handleSelectMuscle(muscle)}
              >
                <Text
                  style={[
                    styles.muscleButtonText,
                    { color: isSelected ? "white" : colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {MUSCLE_GROUP_LABELS[muscle]}
                </Text>
              </TouchableOpacity>
            );
          })}
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
          <FillBar
            percentage={(painLevel / 10) * 100}
            color={getSeverityColor(painLevel, 3)}
            styles={{ track: styles.painBar, fill: styles.painBarFill }}
          />
          <Text style={[styles.painLevelText, { color: colors.textPrimary }]}>
            {painLevel}/10
          </Text>
        </View>
        <IntensityPicker
          value={painLevel}
          onChange={setPainLevel}
          getColor={(level) => getSeverityColor(level, 3)}
          unselectedBackground={colors.surface}
          unselectedTextColor={colors.textPrimary}
          styles={{
            container: styles.painPicker,
            button: styles.painButton,
            buttonText: styles.painButtonText,
          }}
        />

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
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
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
