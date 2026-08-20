import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import ModalSheet from "@shared/components/ModalSheet";
import { SuggestionsBox } from "@shared/components/SuggestionsBox";
import { useTheme } from "@shared/context/ThemeContext";
import type { ThemeColors } from "@shared/context/ThemeContext";
import { toSuggestions } from "@utils/exerciseDb";
import type { UnresolvedExercise } from "../utils/matchProgram";

interface MatchReviewModalProps {
  readonly visible: boolean;
  readonly unresolved: readonly UnresolvedExercise[];
  readonly onResolve: (
    target: UnresolvedExercise,
    exerciseId: string | null,
  ) => void;
  readonly onClose: () => void;
}

export default function MatchReviewModal({
  visible,
  unresolved,
  onResolve,
  onClose,
}: MatchReviewModalProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  // Resolving drops the entry from the list, so the queue head is always the
  // exercise being reviewed. Rendering the whole list instead cost ~500ms a
  // frame on a program with dozens of unmatched names.
  const entry = unresolved[0];
  if (!visible || !entry) return null;

  const items =
    query.trim().length > 1
      ? toSuggestions(query, 5)
      : entry.candidates.map((c) => ({
          id: c.exercise.id,
          label: c.exercise.name,
          meta: c.exercise.primaryMuscles.join(", "),
        }));

  const resolve = (exerciseId: string | null) => {
    setQuery("");
    onResolve(entry, exerciseId);
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='Review exercises'
      subtitle={`${unresolved.length} left — pick the right one, or keep yours.`}
      scrollable={true}
      showConfirmButton={false}
      cancelText='Done'
    >
      <View style={styles.row}>
        <Text style={styles.name}>{entry.name}</Text>
        <Text style={styles.location}>
          Day {entry.dayNumber} · {entry.split}
        </Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder='Search the exercise database'
          placeholderTextColor={colors.textMuted}
        />
        {items.length > 0 && (
          <SuggestionsBox
            items={items}
            onSelect={(label) =>
              resolve(items.find((i) => i.label === label)?.id ?? null)
            }
          />
        )}
        <TouchableOpacity style={styles.keepButton} onPress={() => resolve(null)}>
          <Text style={styles.keepButtonText}>Keep as custom</Text>
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { marginBottom: 8 },
    name: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
    location: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    keepButton: { marginTop: 10, alignSelf: "flex-start" },
    keepButtonText: { fontSize: 14, color: colors.textMuted },
  });
