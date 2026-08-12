import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Styles } from "../PlanScreen";

interface SplitDayRowProps {
  readonly index: number;
  readonly day: { dayTitle: string; muscleGroups: string };
  readonly canRemove: boolean;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly onChangeField: (
    idx: number,
    field: "dayTitle" | "muscleGroups",
    value: string,
  ) => void;
  readonly onRemove: (idx: number) => void;
}

export function SplitDayRow({
  index,
  day,
  canRemove,
  colors,
  styles,
  onChangeField,
  onRemove,
}: SplitDayRowProps): React.JSX.Element {
  const handleRemove = () => onRemove(index);
  const handleTitleChange = (v: string) => onChangeField(index, "dayTitle", v);
  const handleGroupsChange = (v: string) =>
    onChangeField(index, "muscleGroups", v);

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={styles.editFieldLabel}>Day {index + 1} title</Text>
        {canRemove && (
          <TouchableOpacity onPress={handleRemove}>
            <Text style={styles.removeExerciseBtnText}>− Remove day</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={styles.editInput}
        value={day.dayTitle}
        onChangeText={handleTitleChange}
        placeholder='e.g. Push Day'
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.editFieldLabel}>Muscle groups (comma separated)</Text>
      <TextInput
        style={styles.editInput}
        value={day.muscleGroups}
        onChangeText={handleGroupsChange}
        placeholder='Chest, Shoulders, Triceps'
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}
