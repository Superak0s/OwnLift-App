import React from "react";
import type { ExerciseSuggestion } from "@utils/exerciseDb";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Styles } from "../PlanScreen";
import type { DayDraft } from "../types";
import { ExerciseEditBlock } from "./ExerciseEditBlock";

interface DayEditFormProps {
  readonly dayDraft: DayDraft;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly nameSuggestions: Record<number, ExerciseSuggestion[]>;
  readonly mgSuggestions: Record<number, string[]>;
  readonly focusedNameIdx: number | null;
  readonly focusedMgIdx: number | null;
  readonly isSubmitting: boolean;
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
    exerciseId?: string,
  ) => void;
  readonly onRemoveExercise: (exIdx: number) => void;
  readonly onChangeSets: (exIdx: number, person: string, value: string) => void;
  readonly onAddExercise: () => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}

export function DayEditForm({
  dayDraft,
  colors,
  styles,
  nameSuggestions,
  mgSuggestions,
  focusedNameIdx,
  focusedMgIdx,
  isSubmitting,
  onChangeField,
  onFocusName,
  onBlurName,
  onFocusMg,
  onBlurMg,
  onApplySuggestion,
  onRemoveExercise,
  onChangeSets,
  onAddExercise,
  onCancel,
  onSubmit,
}: DayEditFormProps): React.JSX.Element {
  return (
    <View>
      <Text style={styles.editModeLabel}>Editing — tap fields to change</Text>

      {dayDraft.exercises.map((draft, exIdx) => (
        <ExerciseEditBlock
          key={draft.name || `draft-${exIdx}`}
          draft={draft}
          exIdx={exIdx}
          colors={colors}
          styles={styles}
          nameSuggestions={nameSuggestions[exIdx] ?? []}
          mgSuggestions={mgSuggestions[exIdx] ?? []}
          showNameSuggestions={
            focusedNameIdx === exIdx &&
            (nameSuggestions[exIdx] ?? []).length > 0
          }
          showMgSuggestions={
            focusedMgIdx === exIdx && (mgSuggestions[exIdx] ?? []).length > 0
          }
          onChangeField={onChangeField}
          onFocusName={onFocusName}
          onBlurName={onBlurName}
          onFocusMg={onFocusMg}
          onBlurMg={onBlurMg}
          onApplySuggestion={onApplySuggestion}
          onRemove={onRemoveExercise}
          onChangeSets={onChangeSets}
        />
      ))}

      <TouchableOpacity style={styles.addExerciseBtn} onPress={onAddExercise}>
        <Text style={styles.addExerciseBtnText}>+ Add exercise</Text>
      </TouchableOpacity>

      <View style={styles.editActions}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textOnAccent} size='small' />
          ) : (
            <Text style={styles.submitBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
