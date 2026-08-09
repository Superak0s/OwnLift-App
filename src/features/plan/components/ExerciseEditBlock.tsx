import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Styles } from "../PlanScreen";
import type { ExerciseDraft } from "../types";
import { SuggestionsBox } from "@shared/components/SuggestionsBox";
import { SetsEditRow } from "./SetsEditRow";

interface ExerciseEditBlockProps {
  readonly draft: ExerciseDraft;
  readonly exIdx: number;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly nameSuggestions: string[];
  readonly mgSuggestions: string[];
  readonly showNameSuggestions: boolean;
  readonly showMgSuggestions: boolean;
  readonly onChangeField: (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
  ) => void;
  readonly onFocusName: (exIdx: number) => void;
  readonly onBlurName: () => void;
  readonly onFocusMg: (exIdx: number) => void;
  readonly onBlurMg: () => void;
  readonly onApplySuggestion: (
    exIdx: number,
    field: "name" | "muscleGroup",
    value: string,
  ) => void;
  readonly onRemove: (exIdx: number) => void;
  readonly onChangeSets: (exIdx: number, person: string, value: string) => void;
}

export function ExerciseEditBlock({
  draft,
  exIdx,
  colors,
  styles,
  nameSuggestions,
  mgSuggestions,
  showNameSuggestions,
  showMgSuggestions,
  onChangeField,
  onFocusName,
  onBlurName,
  onFocusMg,
  onBlurMg,
  onApplySuggestion,
  onRemove,
  onChangeSets,
}: ExerciseEditBlockProps): React.JSX.Element {
  const personKeys = Object.keys(draft.setsByPerson);

  const handleRemove = () => onRemove(exIdx);
  const handleNameChange = (v: string) => onChangeField(exIdx, "name", v);
  const handleNameFocus = () => onFocusName(exIdx);
  const handleMgChange = (v: string) => onChangeField(exIdx, "muscleGroup", v);
  const handleMgFocus = () => onFocusMg(exIdx);
  const handleSelectName = (value: string) =>
    onApplySuggestion(exIdx, "name", value);
  const handleSelectMg = (value: string) =>
    onApplySuggestion(exIdx, "muscleGroup", value);
  const handleSetsChange = (person: string, value: string) =>
    onChangeSets(exIdx, person, value);

  return (
    <View style={styles.editExerciseBlock}>
      <TouchableOpacity
        style={styles.removeExerciseBtn}
        onPress={handleRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.removeExerciseBtnText}>− Remove</Text>
      </TouchableOpacity>

      <Text style={styles.editFieldLabel}>Exercise name</Text>
      <TextInput
        style={styles.editInput}
        value={draft.name}
        onChangeText={handleNameChange}
        onFocus={handleNameFocus}
        onBlur={onBlurName}
        placeholderTextColor={colors.textMuted}
        placeholder='Exercise name'
      />
      {showNameSuggestions && (
        <SuggestionsBox
          items={nameSuggestions.map((s) => ({ label: s }))}
          onSelect={handleSelectName}
        />
      )}

      <Text style={styles.editFieldLabel}>Muscle group</Text>
      <TextInput
        style={styles.editInput}
        value={draft.muscleGroup}
        onChangeText={handleMgChange}
        onFocus={handleMgFocus}
        onBlur={onBlurMg}
        placeholderTextColor={colors.textMuted}
        placeholder='Muscle group'
      />
      {showMgSuggestions && (
        <SuggestionsBox
          items={mgSuggestions.map((s) => ({ label: s }))}
          onSelect={handleSelectMg}
        />
      )}

      <Text style={styles.editFieldLabel}>Sets</Text>
      <SetsEditRow
        personKeys={personKeys}
        setsByPerson={draft.setsByPerson}
        colors={colors}
        styles={styles}
        onChange={handleSetsChange}
      />
    </View>
  );
}
