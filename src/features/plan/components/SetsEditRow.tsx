import React from "react";
import { View, Text, TextInput } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Styles } from "../PlanScreen";

interface SetsEditRowProps {
  readonly personKeys: string[];
  readonly setsByPerson: Record<string, string>;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly onChange: (person: string, value: string) => void;
}

export function SetsEditRow({
  personKeys,
  setsByPerson,
  colors,
  styles,
  onChange,
}: SetsEditRowProps): React.JSX.Element {
  return (
    <View style={styles.editSetsRow}>
      {personKeys.map((person) => (
        <SetEditItem
          key={person}
          person={person}
          value={setsByPerson[person]}
          colors={colors}
          styles={styles}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

interface SetEditItemProps {
  readonly person: string;
  readonly value: string;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly onChange: (person: string, value: string) => void;
}

function SetEditItem({
  person,
  value,
  colors,
  styles,
  onChange,
}: SetEditItemProps): React.JSX.Element {
  const handleChange = (v: string) => onChange(person, v);
  return (
    <View style={styles.editSetItem}>
      <Text style={styles.editSetPersonLabel}>{person}</Text>
      <TextInput
        style={styles.editSetInput}
        value={value}
        onChangeText={handleChange}
        keyboardType='numeric'
        maxLength={3}
        placeholderTextColor={colors.textMuted}
        placeholder='0'
      />
    </View>
  );
}
