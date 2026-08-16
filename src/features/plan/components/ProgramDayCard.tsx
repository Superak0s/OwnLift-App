import React from "react";
import type { ExerciseSuggestion } from "@utils/exerciseDb";
import { View, Text, TouchableOpacity } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import type { Styles } from "../PlanScreen";
import type { DayDraft, WdDay } from "../types";
import { DayEditForm } from "./DayEditForm";
import {
  ProgramDayHeader,
  ProgramExerciseRow,
  getDayExerciseList,
  getDayLabelAndTitle,
  getPersonEntries,
} from "@shared/components/ProgramDayCardBase";

interface ProgramDayCardProps {
  readonly day: WdDay;
  readonly dayIdx: number;
  readonly selectedProgram: string | null;
  readonly isHidden: boolean;
  readonly isEditing: boolean;
  readonly canStartEditing: boolean;
  readonly dayDraft: DayDraft | null;
  readonly colors: ThemeColors;
  readonly styles: Styles;
  readonly nameSuggestions: Record<number, ExerciseSuggestion[]>;
  readonly mgSuggestions: Record<number, string[]>;
  readonly focusedNameIdx: number | null;
  readonly focusedMgIdx: number | null;
  readonly isSubmitting: boolean;
  readonly onStartEditing: (dayIdx: number) => void;
  readonly onToggleHidden: (dayIdx: number) => void;
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
  readonly onCancelEditing: () => void;
  readonly onSubmitEdits: () => void;
}

export function ProgramDayCard({
  day,
  dayIdx,
  selectedProgram,
  isHidden,
  isEditing,
  canStartEditing,
  dayDraft,
  colors,
  styles,
  nameSuggestions,
  mgSuggestions,
  focusedNameIdx,
  focusedMgIdx,
  isSubmitting,
  onStartEditing,
  onToggleHidden,
  onChangeField,
  onFocusName,
  onBlurName,
  onFocusMg,
  onBlurMg,
  onApplySuggestion,
  onRemoveExercise,
  onChangeSets,
  onAddExercise,
  onCancelEditing,
  onSubmitEdits,
}: ProgramDayCardProps): React.JSX.Element {
  const exercises = getDayExerciseList(day, selectedProgram);
  const { dayLabel, dayTitle } = getDayLabelAndTitle(day, dayIdx);
  const handleStartEditing = () => onStartEditing(dayIdx);
  const handleToggleHidden = () => onToggleHidden(dayIdx);

  return (
    <View style={styles.programDayCard}>
      <ProgramDayHeader dayLabel={dayLabel} dayTitle={dayTitle} styles={styles}>
        {!isHidden && canStartEditing && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleStartEditing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.iconBtnText}>✏️</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleToggleHidden}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.chevron}>{isHidden ? "›" : "‹"}</Text>
        </TouchableOpacity>
      </ProgramDayHeader>

      {!isHidden && !isEditing && exercises.length === 0 && (
        <Text style={styles.emptyDayText}>
          No exercises yet — tap ✏️ to add some.
        </Text>
      )}
      {!isHidden &&
        !isEditing &&
        exercises.map((exercise, exIdx) => (
          <ProgramExerciseRow
            key={exercise.name ?? `exercise-${exIdx}`}
            name={exercise.name ?? `Exercise ${exIdx + 1}`}
            muscleGroup={exercise.muscleGroup}
            personEntries={getPersonEntries(exercise, selectedProgram)}
            styles={styles}
          />
        ))}

      {!isHidden && isEditing && dayDraft && (
        <DayEditForm
          dayDraft={dayDraft}
          colors={colors}
          styles={styles}
          nameSuggestions={nameSuggestions}
          mgSuggestions={mgSuggestions}
          focusedNameIdx={focusedNameIdx}
          focusedMgIdx={focusedMgIdx}
          isSubmitting={isSubmitting}
          onChangeField={onChangeField}
          onFocusName={onFocusName}
          onBlurName={onBlurName}
          onFocusMg={onFocusMg}
          onBlurMg={onBlurMg}
          onApplySuggestion={onApplySuggestion}
          onRemoveExercise={onRemoveExercise}
          onChangeSets={onChangeSets}
          onAddExercise={onAddExercise}
          onCancel={onCancelEditing}
          onSubmit={onSubmitEdits}
        />
      )}
    </View>
  );
}
