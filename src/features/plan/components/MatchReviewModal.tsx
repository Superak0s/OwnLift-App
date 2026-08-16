import React, { useState } from "react";
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

const rowKey = (u: UnresolvedExercise) =>
  `${u.dayNumber}-${u.person}-${u.exerciseIndex}`;

export default function MatchReviewModal({
  visible,
  unresolved,
  onResolve,
  onClose,
}: MatchReviewModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [queries, setQueries] = useState<Record<string, string>>({});

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='Review exercises'
      subtitle='These names could not be matched with confidence. Pick the right one, or keep yours.'
      scrollable={true}
      showConfirmButton={false}
      cancelText='Done'
    >
      {unresolved.map((entry) => {
        const key = rowKey(entry);
        const query = queries[key] ?? "";
        const items =
          query.trim().length > 1
            ? toSuggestions(query, 5).map((s) => ({
                id: s.id,
                label: s.label,
                meta: s.meta,
              }))
            : entry.candidates.map((c) => ({
                id: c.exercise.id,
                label: c.exercise.name,
                meta: c.exercise.primaryMuscles.join(", "),
              }));

        return (
          <View key={key} style={styles.row}>
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.location}>
              Day {entry.dayNumber} · {entry.person}
            </Text>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={(t) => setQueries((prev) => ({ ...prev, [key]: t }))}
              placeholder='Search the exercise database'
              placeholderTextColor={colors.textMuted}
            />
            {items.length > 0 && (
              <SuggestionsBox
                items={items}
                onSelect={(label) =>
                  onResolve(
                    entry,
                    items.find((i) => i.label === label)?.id ?? null,
                  )
                }
              />
            )}
            <TouchableOpacity
              style={styles.keepButton}
              onPress={() => onResolve(entry, null)}
            >
              <Text style={styles.keepButtonText}>Keep as custom</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ModalSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      marginBottom: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
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
