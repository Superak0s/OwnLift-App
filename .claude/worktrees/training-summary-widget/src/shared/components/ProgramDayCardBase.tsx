import React from "react";
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

export interface ProgramExerciseLike {
  readonly name?: string;
  readonly muscleGroup?: string;
  readonly setsByPerson?: Record<string, number | string> | null;
}

export interface ProgramDayLike<Ex extends ProgramExerciseLike = ProgramExerciseLike> {
  readonly dayNumber?: number;
  readonly dayTitle?: string;
  readonly exercises?: readonly Ex[] | null;
}

export function getDayExerciseList<Ex extends ProgramExerciseLike>(
  day: ProgramDayLike<Ex>,
  selectedProgram: string | null,
): Ex[] {
  if (!Array.isArray(day.exercises)) return [];
  if (!selectedProgram) return day.exercises as Ex[];
  return day.exercises.filter(
    (ex) => Number(ex.setsByPerson?.[selectedProgram] ?? 0) > 0,
  );
}

export function getDayLabelAndTitle(
  day: ProgramDayLike,
  dayIdx: number,
): { dayLabel: string; dayTitle: string } {
  const dayLabel = `Day ${day.dayNumber ?? dayIdx + 1}`;
  if (!day.dayTitle) return { dayLabel, dayTitle: "" };
  const dayTitle = day.dayTitle.includes("—")
    ? day.dayTitle.split("—")[1].trim()
    : day.dayTitle;
  return { dayLabel, dayTitle };
}

export function getPersonEntries(
  exercise: ProgramExerciseLike,
  selectedProgram: string | null,
): Array<[string, number]> {
  const setsByPerson = exercise.setsByPerson ?? {};
  if (!selectedProgram) {
    return Object.entries(setsByPerson).map(
      ([person, count]) => [person, Number(count)] as [string, number],
    );
  }
  return [[selectedProgram, Number(setsByPerson[selectedProgram] ?? 0)]];
}

export interface ProgramExerciseRowStyles {
  readonly programExerciseRow: StyleProp<ViewStyle>;
  readonly programExerciseLeft: StyleProp<ViewStyle>;
  readonly programExerciseName: StyleProp<TextStyle>;
  readonly programExerciseSets: StyleProp<TextStyle>;
  readonly programSetsRow: StyleProp<ViewStyle>;
  readonly programSetsBadge: StyleProp<ViewStyle>;
  readonly programSetsBadgeText: StyleProp<TextStyle>;
  readonly programSetsBadgeLabel: StyleProp<TextStyle>;
}

interface ProgramExerciseRowProps {
  readonly name: string;
  readonly muscleGroup?: string;
  readonly personEntries: Array<[string, number]>;
  readonly styles: ProgramExerciseRowStyles;
}

export function ProgramExerciseRow({
  name,
  muscleGroup,
  personEntries,
  styles,
}: ProgramExerciseRowProps): React.JSX.Element {
  return (
    <View style={styles.programExerciseRow}>
      <View style={styles.programExerciseLeft}>
        <Text style={styles.programExerciseName}>{name}</Text>
        {muscleGroup ? (
          <Text style={styles.programExerciseSets}>{muscleGroup}</Text>
        ) : null}
      </View>
      <View style={styles.programSetsRow}>
        {personEntries.map(([person, count]) => (
          <View key={person} style={styles.programSetsBadge}>
            <Text style={styles.programSetsBadgeText}>{count}</Text>
            <Text style={styles.programSetsBadgeLabel}>{person}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface ProgramDayHeaderStyles {
  readonly programDayHeader: StyleProp<ViewStyle>;
  readonly programDayNumber: StyleProp<TextStyle>;
  readonly programDayTitle: StyleProp<TextStyle>;
}

interface ProgramDayHeaderProps {
  readonly dayLabel: string;
  readonly dayTitle: string;
  readonly styles: ProgramDayHeaderStyles;
  readonly children?: React.ReactNode;
}

export function ProgramDayHeader({
  dayLabel,
  dayTitle,
  styles,
  children,
}: ProgramDayHeaderProps): React.JSX.Element {
  return (
    <View style={styles.programDayHeader}>
      <Text style={styles.programDayNumber}>{dayLabel}</Text>
      <Text style={styles.programDayTitle} numberOfLines={2}>
        {dayTitle}
      </Text>
      {children}
    </View>
  );
}
