import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@shared/context/ThemeContext";
import { progressPhotoApi } from "../services";
import {
  MuscleGroup,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
} from "../types/muscleRecovery";
import ModalSheet from "@shared/components/ModalSheet";

interface LogProgressPhotoModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PHOTOSHOTS_ANGLE_OPTIONS = [
  { value: "front" as const, label: "Front", icon: "🤚" },
  { value: "back" as const, label: "Back", icon: "🔙" },
  { value: "side" as const, label: "Side", icon: "👉" },
  { value: "custom" as const, label: "Custom", icon: "📐" },
];

export const LogProgressPhotoModal: React.FC<LogProgressPhotoModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const [step, setStep] = useState<"select" | "tag">("select");
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<"front" | "back" | "side" | "custom">("front");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Reset state when modal opens/closes ─────────────────────────────
  React.useEffect(() => {
    if (visible) {
      setStep("select");
      setSelectedUri(null);
      setSelectedMuscles([]);
      setSelectedAngle("front");
      setNotes("");
      setSubmitting(false);
      setCameraError(null);
    }
  }, [visible]);

  // ─── Image picker handlers ───────────────────────────────────────────
  const pickFromCamera = async () => {
    setCameraError(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Please open Settings and enable camera access to capture photos.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedUri(result.assets[0].uri);
        setStep("tag");
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
      }
    } catch (error) {
      setCameraError("Failed to open camera. Try again.");
      console.error("Camera picker error:", error);
    }
  };

  const pickFromGallery = async () => {
    setCameraError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photo Library Permission Required",
          "Please open Settings and enable photo library access.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedUri(result.assets[0].uri);
        setStep("tag");
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
      }
    } catch (error) {
      setCameraError("Failed to open photo library. Try again.");
      console.error("Gallery picker error:", error);
    }
  };

  // ─── Muscle tag toggle ──────────────────────────────────────────────
  const toggleMuscle = (muscle: MuscleGroup) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    );
  };

  // ─── Submit handler ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedUri) {
      Alert.alert("No Photo", "Please select a photo first.");
      return;
    }

    setSubmitting(true);
    try {
      await progressPhotoApi.uploadPhoto({
        uri: selectedUri,
        muscleGroups: selectedMuscles,
        notes: notes.trim() || undefined,
        angle: selectedAngle,
        takenAt: new Date().toISOString(),
      });
      onSuccess();
      onClose();
    } catch (error) {
      Alert.alert("Upload Failed", "Could not save your progress photo. Try again.");
      console.error("Upload photo error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 1: Image selection ────────────────────────────────────────
  if (step === "select") {
    return (
      <ModalSheet
        visible={visible}
        title="Progress Photo"
        onClose={onClose}
        showConfirmButton={false}
        showCancelButton={false}
      >
        <View style={selectStep.selectContainer}>
          <Text style={[selectStep.selectTitle, { color: colors.textPrimary }]}>
            How would you like to add a photo?
          </Text>

          <TouchableOpacity
            style={[selectStep.optionButton, { backgroundColor: colors.accent }]}
            onPress={pickFromCamera}
          >
            <Text style={selectStep.optionIcon}>📷</Text>
            <Text style={[selectStep.optionLabel, { color: "#fff" }]}>
              Take Photo
            </Text>
            <Text style={[selectStep.optionSublabel, { color: "rgba(255,255,255,0.7)" }]}>
              Open camera
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[selectStep.optionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder }]}
            onPress={pickFromGallery}
          >
            <Text style={selectStep.optionIcon}>🖼️</Text>
            <Text style={[selectStep.optionLabel, { color: colors.textPrimary }]}>
              Pick from Gallery
            </Text>
            <Text style={[selectStep.optionSublabel, { color: colors.textSecondary }]}>
              Choose existing photo
            </Text>
          </TouchableOpacity>

          {cameraError && (
            <Text style={[selectStep.errorText, { color: "#FF6B6B" }]}>
              {cameraError}
            </Text>
          )}
        </View>
      </ModalSheet>
    );
  }

  // ─── Step 2: Tag & submit ──────────────────────────────────────────
  return (
    <ModalSheet
      visible={visible}
      title="Tag Your Photo"
      onClose={onClose}
      confirmText="Save"
      confirmDisabled={submitting}
      onConfirm={handleSubmit}
      cancelText="Cancel"
      scrollable
      fullHeight
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={tagStep.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preview */}
        {selectedUri && (
          <View style={tagStep.previewContainer}>
            <Image source={{ uri: selectedUri }} style={tagStep.previewImage} resizeMode="cover" />
            <TouchableOpacity
              style={[tagStep.retakeButton, { backgroundColor: "rgba(0,0,0,0.6)" }]}
              onPress={() => {
                setStep("select");
                setSelectedUri(null);
              }}
            >
              <Text style={tagStep.retakeButtonText}>📷 Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Angle Picker */}
        <Text style={[tagStep.sectionLabel, { color: colors.textSecondary }]}>
          Angle
        </Text>
        <View style={tagStep.angleRow}>
          {PHOTOSHOTS_ANGLE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                tagStep.anglePill,
                {
                  backgroundColor:
                    selectedAngle === opt.value ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    selectedAngle === opt.value ? colors.accent : colors.inputBorder,
                },
              ]}
              onPress={() => setSelectedAngle(opt.value)}
            >
              <Text style={tagStep.angleIcon}>{opt.icon}</Text>
              <Text
                style={[
                  tagStep.angleLabel,
                  {
                    color:
                      selectedAngle === opt.value ? "#fff" : colors.textPrimary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Muscle Group Multi-Select */}
        <Text style={[tagStep.sectionLabel, { color: colors.textSecondary }]}>
          Muscle Groups ({selectedMuscles.length} selected)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tagStep.muscleScroll}>
          <View style={tagStep.muscleGrid}>
            {MUSCLE_GROUPS.map((muscle) => {
              const isSelected = selectedMuscles.includes(muscle);
              return (
                <TouchableOpacity
                  key={muscle}
                  style={[
                    tagStep.musclePill,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accent : colors.inputBorder,
                    },
                  ]}
                  onPress={() => toggleMuscle(muscle)}
                >
                  <Text
                    style={[
                      tagStep.musclePillText,
                      { color: isSelected ? "#fff" : colors.textPrimary },
                    ]}
                  >
                    {MUSCLE_GROUP_LABELS[muscle]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Notes */}
        <Text style={[tagStep.sectionLabel, { color: colors.textSecondary }]}>
          Notes (optional)
        </Text>
        <TextInput
          style={[tagStep.notesInput, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder="e.g., Chest got broader after 12 weeks of incline pressing"
          placeholderTextColor={colors.textMuted ?? "#888"}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Quick actions */}
        <View style={tagStep.quickActions}>
          <TouchableOpacity
            style={[tagStep.quickActionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder }]}
            onPress={() => setSelectedMuscles([])}
          >
            <Text style={[tagStep.quickActionText, { color: colors.textSecondary }]}>
              Clear All Muscles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tagStep.quickActionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder }]}
            onPress={() => setNotes("")}
          >
            <Text style={[tagStep.quickActionText, { color: colors.textSecondary }]}>
              Clear Notes
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ModalSheet>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────

const selectStep = StyleSheet.create({
  selectContainer: {
    paddingVertical: 8,
  },
  selectTitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  optionSublabel: {
    fontSize: 13,
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});

const tagStep = StyleSheet.create({
  scrollContent: {
    paddingVertical: 4,
  },
  previewContainer: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  retakeButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  angleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  anglePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  angleIcon: {
    fontSize: 16,
  },
  angleLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  muscleScroll: {
    maxHeight: 140,
    marginBottom: 4,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingRight: 8,
  },
  musclePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  musclePillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
