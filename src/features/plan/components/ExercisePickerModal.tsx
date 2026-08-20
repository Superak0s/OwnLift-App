import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import ModalSheet from "@shared/components/ModalSheet";
import { useTheme, type ThemeColors } from "@shared/context/ThemeContext";
import { filterExercises, type CanonicalExercise } from "@utils/exerciseDb";
import { MuscleChips } from "./MuscleChips";

const RESULT_LIMIT = 40;

interface ExercisePickerModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (exercise: CanonicalExercise) => void;
}

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: ExercisePickerModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [query, setQuery] = useState("");
  const [included, setIncluded] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);

  const toggleMuscle = (muscle: string) => {
    if (included.includes(muscle)) {
      setIncluded((prev) => prev.filter((m) => m !== muscle));
      setExcluded((prev) => [...prev, muscle]);
    } else if (excluded.includes(muscle)) {
      setExcluded((prev) => prev.filter((m) => m !== muscle));
    } else {
      setIncluded((prev) => [...prev, muscle]);
    }
  };

  const results = useMemo(
    () =>
      filterExercises({
        query,
        include: included,
        exclude: excluded,
        limit: RESULT_LIMIT,
      }),
    [query, included, excluded],
  );

  const handleSelect = (exercise: CanonicalExercise) => {
    onSelect(exercise);
    onClose();
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='Pick an exercise'
      subtitle='Tap a muscle to require it, again to exclude it'
      showConfirmButton={false}
      cancelText='Close'
      scrollable
      fullHeight
    >
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder='Search exercises'
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
      />

      <MuscleChips
        included={included}
        excluded={excluded}
        onToggle={toggleMuscle}
      />

      {results.length === 0 ? (
        <Text style={styles.empty}>No exercises match those filters.</Text>
      ) : (
        results.map((exercise) => (
          <TouchableOpacity
            key={exercise.id}
            style={styles.result}
            onPress={() => handleSelect(exercise)}
          >
            <Text style={styles.resultName}>{exercise.name}</Text>
            <Text style={styles.resultMeta}>
              {[exercise.primaryMuscles.join(", "), exercise.equipment]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </TouchableOpacity>
        ))
      )}
      {results.length === RESULT_LIMIT && (
        <Text style={styles.empty}>Refine your search to see more.</Text>
      )}
    </ModalSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    search: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 15,
      color: colors.textPrimary,
    },
    result: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    resultName: { fontSize: 15, color: colors.textPrimary },
    resultMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    empty: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 16,
    },
  });
