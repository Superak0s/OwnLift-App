import React from "react";
import { perfLog, startTimer } from "@utils/perf";
import { View, Text, TouchableOpacity } from "react-native";
import type { Styles } from "../PlanScreen";
import type { WdDay } from "../types";
import {
  ProgramDayHeader,
  ProgramExerciseRow,
  getDayExerciseList,
  getDayLabelAndTitle,
  getSplitEntries,
} from "@shared/components/ProgramDayCardBase";

interface ProgramDayCardProps {
  readonly day: WdDay;
  readonly dayIdx: number;
  readonly displayNumber?: number;
  readonly selectedProgram: string | null;
  readonly isHidden: boolean;
  readonly styles: Styles;
  readonly onToggleHidden: (dayIdx: number) => void;
}

export function ProgramDayCard({
  day,
  dayIdx,
  displayNumber,
  selectedProgram,
  isHidden,
  styles,
  onToggleHidden,
}: ProgramDayCardProps): React.JSX.Element {
  const cardTimer = startTimer();
  const exercises = getDayExerciseList(day, selectedProgram);
  const { dayLabel, dayTitle } = getDayLabelAndTitle(day, dayIdx, displayNumber);
  const handleToggleHidden = () => onToggleHidden(dayIdx);
  perfLog("ProgramDayCard.body", cardTimer(), `day=${dayIdx} exercises=${exercises.length}`);

  return (
    <View style={styles.programDayCard}>
      <ProgramDayHeader dayLabel={dayLabel} dayTitle={dayTitle} styles={styles}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleToggleHidden}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.chevron}>{isHidden ? "›" : "‹"}</Text>
        </TouchableOpacity>
      </ProgramDayHeader>

      {!isHidden && exercises.length === 0 && (
        <Text style={styles.emptyDayText}>No exercises yet.</Text>
      )}
      {!isHidden &&
        exercises.map((exercise, exIdx) => (
          <ProgramExerciseRow
            key={exercise.name ?? `exercise-${exIdx}`}
            name={exercise.name ?? `Exercise ${exIdx + 1}`}
            muscleGroup={exercise.muscleGroup}
            splitEntries={getSplitEntries(exercise, selectedProgram)}
            styles={styles}
          />
        ))}
    </View>
  );
}
