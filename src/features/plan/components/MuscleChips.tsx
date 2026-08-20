import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, type ThemeColors } from "@shared/context/ThemeContext";
import { MUSCLE_GROUPS } from "@utils/exerciseDb";

interface MuscleChipsProps {
  readonly included: readonly string[];
  readonly excluded?: readonly string[];
  readonly onToggle: (muscle: string) => void;
  readonly muscles?: readonly string[];
}

export function MuscleChips({
  included,
  excluded = [],
  onToggle,
  muscles = MUSCLE_GROUPS,
}: MuscleChipsProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.row}>
      {muscles.map((muscle) => {
        const isIncluded = included.includes(muscle);
        const isExcluded = excluded.includes(muscle);
        return (
          <TouchableOpacity
            key={muscle}
            onPress={() => onToggle(muscle)}
            style={[
              styles.chip,
              isIncluded && styles.chipIncluded,
              isExcluded && styles.chipExcluded,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                (isIncluded || isExcluded) && styles.chipTextActive,
              ]}
            >
              {isExcluded ? `− ${muscle}` : muscle}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    chip: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipIncluded: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipExcluded: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    chipText: { fontSize: 12, color: colors.textSecondary },
    chipTextActive: { color: colors.textOnAccent, fontWeight: "700" },
  });
